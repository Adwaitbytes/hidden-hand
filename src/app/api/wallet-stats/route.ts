import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getEndpoints, getHouseAddress } from "@/lib/er";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const address = getHouseAddress();
    const endpoints = getEndpoints();
    const conn = new Connection(endpoints.devnet, "confirmed");
    const pk = new PublicKey(address);

    const [balanceLamports, sigList] = await Promise.all([
      conn.getBalance(pk).catch(() => 0),
      conn
        .getSignaturesForAddress(pk, { limit: 25 })
        .catch(() => [] as Awaited<ReturnType<Connection["getSignaturesForAddress"]>>),
    ]);

    const recent = sigList.slice(0, 8).map((s) => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime ?? null,
      err: !!s.err,
      memo: s.memo ?? null,
      explorerUrl: `https://solscan.io/tx/${s.signature}?cluster=devnet`,
    }));

    return Response.json({
      address,
      explorerUrl: `https://solscan.io/account/${address}?cluster=devnet`,
      balance: balanceLamports / LAMPORTS_PER_SOL,
      txCount: sigList.length,
      endpoints,
      recent,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
