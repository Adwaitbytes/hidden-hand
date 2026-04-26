/**
 * MagicBlock Ephemeral Rollup integration shape.
 *
 * For the live demo we emit "transaction" events with the exact shape that
 * a Private ER tx would carry. To wire to a real Anchor program deployed on
 * MagicBlock devnet, swap the bodies of these functions for:
 *
 *   import * as anchor from "@coral-xyz/anchor";
 *   const erConnection = new anchor.web3.Connection(
 *     "https://devnet-as.magicblock.app/",
 *     { wsEndpoint: "wss://devnet-as.magicblock.app/", commitment: "confirmed" }
 *   );
 *   const erProvider = new anchor.AnchorProvider(erConnection, wallet, {});
 *   await program.methods.submitSealedBid(encryptedBlob)
 *     .accounts({ auction, bidder })
 *     .rpc();  // routed via erProvider
 *
 * Private ER endpoint (TEE): https://devnet-tee.magicblock.app
 * Delegation program:        DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
 * Validator (Asia):          MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57
 */

export type ERTx = {
  signature: string;
  type: "delegate" | "submit_sealed_bid" | "reveal" | "settle" | "undelegate";
  endpoint: "solana-devnet" | "magicblock-er" | "magicblock-private-er";
  account: string;
  payload?: Record<string, unknown>;
};

function fakeSig(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 88; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function fakePubkey(seed: string): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  for (let i = 0; i < 44; i++) {
    h = (h * 1103515245 + 12345) | 0;
    s += chars[Math.abs(h) % chars.length];
  }
  return s;
}

export function encryptBid(bid: number, agentId: string): string {
  const payload = `${agentId}:${bid}:${Date.now()}`;
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  const seed = Math.abs(hash).toString(16);
  let blob = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < 64; i++) {
    const c = (Math.abs(hash) + i * 2654435761) >>> 0;
    blob += chars[c % 16];
  }
  return `0x${blob.slice(0, 60)}…${seed}`;
}

export function txDelegateAuction(auctionId: string): ERTx {
  return {
    signature: fakeSig(),
    type: "delegate",
    endpoint: "solana-devnet",
    account: fakePubkey(`auction-${auctionId}`),
    payload: { delegationProgram: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh" },
  };
}

export function txSubmitBid(auctionId: string, agentId: string, encryptedBlob: string): ERTx {
  return {
    signature: fakeSig(),
    type: "submit_sealed_bid",
    endpoint: "magicblock-private-er",
    account: fakePubkey(`bid-${auctionId}-${agentId}`),
    payload: { encryptedBlob },
  };
}

export function txReveal(auctionId: string): ERTx {
  return {
    signature: fakeSig(),
    type: "reveal",
    endpoint: "magicblock-private-er",
    account: fakePubkey(`auction-${auctionId}`),
  };
}

export function txSettle(auctionId: string, winnerAgent: string, amount: number): ERTx {
  return {
    signature: fakeSig(),
    type: "settle",
    endpoint: "solana-devnet",
    account: fakePubkey(`settle-${auctionId}-${winnerAgent}`),
    payload: { winner: winnerAgent, amount },
  };
}
