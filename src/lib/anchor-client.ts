/**
 * Anchor client for the Hidden Hand on-chain program.
 *
 * - getProgram()    -> Program<HiddenHand> connected to Solana devnet
 * - getErProgram()  -> Program<HiddenHand> connected to MagicBlock ER (devnet-as)
 *
 * Both load the house keypair from `process.env.HOUSE_KEYPAIR_BS58` (bs58 encoded
 * 64-byte secret key). This is server-side only — never bundle for the browser.
 */

import { AnchorProvider, BN, Program, Wallet, web3 } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

import idl from "@/lib/idl/hidden_hand.json";

// The IDL `address` field is the deployed program ID on devnet.
export const HIDDEN_HAND_PROGRAM_ID = new PublicKey(
  (idl as { address: string }).address
);

// Minimal type alias — the IDL JSON works at runtime; the TS definitions in
// `hidden_hand.ts` are also exported for callers that want stronger typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HiddenHandProgram = Program<any>;

const SOLANA_DEVNET_RPC =
  process.env.SOLANA_DEVNET_RPC || "https://api.devnet.solana.com";
const MAGICBLOCK_ER_RPC =
  process.env.MAGICBLOCK_ER_RPC || "https://devnet-as.magicblock.app";

export const AUCTION_SEED = Buffer.from("auction");

let _devnetProgram: HiddenHandProgram | null = null;
let _erProgram: HiddenHandProgram | null = null;
let _keypair: Keypair | null = null;

function houseKeypair(): Keypair {
  if (_keypair) return _keypair;
  const secret = process.env.HOUSE_KEYPAIR_BS58;
  if (!secret) throw new Error("HOUSE_KEYPAIR_BS58 not set");
  _keypair = Keypair.fromSecretKey(bs58.decode(secret));
  return _keypair;
}

function buildProgram(rpcUrl: string): HiddenHandProgram {
  const connection = new Connection(rpcUrl, { commitment: "confirmed" });
  const wallet: Wallet = {
    publicKey: houseKeypair().publicKey,
    payer: houseKeypair(),
    signTransaction: async <T extends Transaction | web3.VersionedTransaction>(
      tx: T
    ) => {
      if ("partialSign" in tx) {
        (tx as Transaction).partialSign(houseKeypair());
      } else {
        (tx as web3.VersionedTransaction).sign([houseKeypair()]);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | web3.VersionedTransaction>(
      txs: T[]
    ) => {
      for (const tx of txs) {
        if ("partialSign" in tx) {
          (tx as Transaction).partialSign(houseKeypair());
        } else {
          (tx as web3.VersionedTransaction).sign([houseKeypair()]);
        }
      }
      return txs;
    },
  };
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}

export function getProgram(): HiddenHandProgram {
  if (!_devnetProgram) _devnetProgram = buildProgram(SOLANA_DEVNET_RPC);
  return _devnetProgram;
}

export function getErProgram(): HiddenHandProgram {
  if (!_erProgram) _erProgram = buildProgram(MAGICBLOCK_ER_RPC);
  return _erProgram;
}

export function getHousePubkey(): PublicKey {
  return houseKeypair().publicKey;
}

/**
 * Convert an auction id (any string) into the canonical 8-byte seed expected
 * by the program. Pads / truncates to exactly 8 bytes.
 */
export function auctionIdBytes(auctionId: string): Buffer {
  const buf = Buffer.alloc(8);
  Buffer.from(auctionId).copy(buf, 0, 0, 8);
  return buf;
}

/** Derive the auction PDA from the (8-byte) auction id. */
export function deriveAuctionPda(auctionId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [AUCTION_SEED, auctionIdBytes(auctionId)],
    HIDDEN_HAND_PROGRAM_ID
  );
}

// ---------------------------------------------------------------------------
// thin instruction wrappers
// ---------------------------------------------------------------------------

export async function initAuction(params: {
  auctionId: string;
  itemHash: Uint8Array; // 32 bytes
}): Promise<{ signature: string; auctionPda: string }> {
  const program = getProgram();
  const idBytes = auctionIdBytes(params.auctionId);
  const [pda] = deriveAuctionPda(params.auctionId);
  const signature = await program.methods
    .initAuction(Array.from(idBytes), Array.from(params.itemHash))
    .accountsPartial({
      auction: pda,
      payer: getHousePubkey(),
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
  return { signature, auctionPda: pda.toBase58() };
}

export async function submitSealedBid(params: {
  auctionId: string;
  encryptedBlob: Uint8Array | Buffer;
  bidder?: Keypair; // defaults to house keypair
  useEr?: boolean; // route via ER endpoint when true
}): Promise<{ signature: string; auctionPda: string }> {
  const program = params.useEr ? getErProgram() : getProgram();
  const [pda] = deriveAuctionPda(params.auctionId);
  const bidder = params.bidder ?? houseKeypair();
  const blob = Buffer.from(params.encryptedBlob);

  const builder = program.methods
    .submitSealedBid(blob)
    .accountsPartial({
      bidder: bidder.publicKey,
      auction: pda,
    });

  // If the bidder is not the provider wallet, attach as additional signer.
  if (!bidder.publicKey.equals(getHousePubkey())) {
    builder.signers([bidder]);
  }

  const signature = await builder.rpc();
  return { signature, auctionPda: pda.toBase58() };
}

export async function revealAndSettle(params: {
  auctionId: string;
  winner: PublicKey;
  amount: number | bigint;
  useEr?: boolean;
}): Promise<{ signature: string; auctionPda: string }> {
  const program = params.useEr ? getErProgram() : getProgram();
  const [pda] = deriveAuctionPda(params.auctionId);
  const signature = await program.methods
    .revealAndSettle(params.winner, new BN(params.amount.toString()))
    .accountsPartial({
      payer: getHousePubkey(),
      auction: pda,
    })
    .rpc();
  return { signature, auctionPda: pda.toBase58() };
}

export async function fetchAuction(auctionId: string, useEr = false) {
  const program = useEr ? getErProgram() : getProgram();
  const [pda] = deriveAuctionPda(auctionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (program.account as any).auction.fetch(pda);
}
