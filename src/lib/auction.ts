import { AGENTS, runAgent, type AgentBid, type AgentId } from "./agents";
import { generateItem, type Item } from "./items";
import {
  encryptBid,
  txAuditTrail,
  txDelegateAuction,
  txReveal,
  txSettle,
  txSubmitBid,
  type ERTx,
} from "./er";

export type AuctionEvent =
  | { type: "session_start"; agents: { id: AgentId; name: string; emoji: string; color: string; balance: number }[]; totalRounds: number }
  | { type: "round_start"; round: number; item: Item; auctionId: string }
  | { type: "er_tx"; round: number; tx: ERTx }
  | { type: "agent_thinking"; round: number; agentId: AgentId }
  | { type: "agent_sealed"; round: number; agentId: AgentId; thought: string; encryptedBlob: string }
  | { type: "reveal"; round: number; bids: { agentId: AgentId; bid: number; encryptedBlob: string }[] }
  | { type: "winner"; round: number; agentId: AgentId | null; amount: number; item: Item }
  | { type: "balances"; balances: Record<AgentId, number>; wins: Record<AgentId, number> }
  | { type: "session_end"; standings: { agentId: AgentId; balance: number; wins: number; haul: Item[] }[]; auditTx?: ERTx };

const STARTING_BALANCE = 5000;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function* runAuctionSession(totalRounds = 5): AsyncGenerator<AuctionEvent> {
  const balances: Record<AgentId, number> = { whale: STARTING_BALANCE, hunter: STARTING_BALANCE, vibes: STARTING_BALANCE };
  const wins: Record<AgentId, number> = { whale: 0, hunter: 0, vibes: 0 };
  const haul: Record<AgentId, Item[]> = { whale: [], hunter: [], vibes: [] };

  yield {
    type: "session_start",
    agents: AGENTS.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, color: a.color, balance: STARTING_BALANCE })),
    totalRounds,
  };

  for (let round = 1; round <= totalRounds; round++) {
    const item = generateItem();
    const auctionId = item.id;

    yield { type: "round_start", round, item, auctionId };
    const delegateTx = await txDelegateAuction(auctionId);
    yield { type: "er_tx", round, tx: delegateTx };

    await delay(150);

    for (const a of AGENTS) {
      yield { type: "agent_thinking", round, agentId: a.id };
    }

    const bidResults = await Promise.all(
      AGENTS.map(async (agent): Promise<AgentBid & { encryptedBlob: string }> => {
        const bid = await runAgent(agent, item, balances[agent.id], round);
        const encryptedBlob = encryptBid(bid.bid, agent.id);
        return { ...bid, encryptedBlob };
      })
    );

    for (const r of bidResults) {
      yield {
        type: "agent_sealed",
        round,
        agentId: r.agentId,
        thought: r.thought,
        encryptedBlob: r.encryptedBlob,
      };
    }

    const bidTxs = await Promise.all(
      bidResults.map((r) => txSubmitBid(auctionId, r.agentId, r.encryptedBlob))
    );
    for (const tx of bidTxs) {
      yield { type: "er_tx", round, tx };
      await delay(80);
    }

    await delay(400);

    const revealTx = await txReveal(auctionId);
    yield { type: "er_tx", round, tx: revealTx };
    yield {
      type: "reveal",
      round,
      bids: bidResults.map((r) => ({ agentId: r.agentId, bid: r.bid, encryptedBlob: r.encryptedBlob })),
    };

    await delay(700);

    const valid = bidResults.filter((r) => r.bid > 0 && r.bid <= balances[r.agentId]);
    let winner: (AgentBid & { encryptedBlob: string }) | null = null;
    if (valid.length > 0) {
      const maxBid = Math.max(...valid.map((r) => r.bid));
      const top = valid.filter((r) => r.bid === maxBid);
      winner = top[Math.floor(Math.random() * top.length)];
    }

    if (winner) {
      balances[winner.agentId] -= winner.bid;
      wins[winner.agentId] += 1;
      haul[winner.agentId].push(item);
      const settleTx = await txSettle(auctionId, winner.agentId, winner.bid);
      yield { type: "er_tx", round, tx: settleTx };
      yield { type: "winner", round, agentId: winner.agentId, amount: winner.bid, item };
    } else {
      yield { type: "winner", round, agentId: null, amount: 0, item };
    }

    yield { type: "balances", balances: { ...balances }, wins: { ...wins } };
    await delay(900);
  }

  const standings = AGENTS.map((a) => ({
    agentId: a.id,
    balance: balances[a.id],
    wins: wins[a.id],
    haul: haul[a.id],
  })).sort((a, b) => b.wins - a.wins || b.balance - a.balance);

  const totalSettled = AGENTS.reduce((s, a) => s + (STARTING_BALANCE - balances[a.id]), 0);
  const championAgent = standings[0]?.agentId ?? null;
  const auditTx = await txAuditTrail({
    rounds: totalRounds,
    winner: championAgent,
    totalSettled,
    ts: Date.now(),
  });
  yield { type: "er_tx", round: totalRounds, tx: auditTx };
  yield { type: "session_end", standings, auditTx };
}
