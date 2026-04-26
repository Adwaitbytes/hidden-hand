"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuctionEvent } from "@/lib/auction";
import type { AgentId } from "@/lib/agents";
import type { Item } from "@/lib/items";
import type { ERTx } from "@/lib/er";

type AgentMeta = { id: AgentId; name: string; emoji: string; color: string; balance: number };

type AgentRoundState = {
  status: "idle" | "thinking" | "sealed" | "revealed";
  thought?: string;
  encryptedBlob?: string;
  bid?: number;
  isWinner?: boolean;
};

type Standing = { agentId: AgentId; balance: number; wins: number; haul: Item[] };

const RARITY_COLOR: Record<string, string> = {
  Common: "text-zinc-300 border-zinc-600",
  Uncommon: "text-emerald-300 border-emerald-500",
  Rare: "text-sky-300 border-sky-500",
  Epic: "text-fuchsia-300 border-fuchsia-500",
  Legendary: "text-amber-300 border-amber-400",
};

const RARITY_GLOW: Record<string, string> = {
  Common: "",
  Uncommon: "shadow-[0_0_30px_rgba(16,185,129,0.25)]",
  Rare: "shadow-[0_0_40px_rgba(56,189,248,0.35)]",
  Epic: "shadow-[0_0_55px_rgba(217,70,239,0.45)]",
  Legendary: "shadow-[0_0_70px_rgba(245,158,11,0.55)]",
};

export default function Home() {
  const [agents, setAgents] = useState<AgentMeta[] | null>(null);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [item, setItem] = useState<Item | null>(null);
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentRoundState>>({
    whale: { status: "idle" },
    hunter: { status: "idle" },
    vibes: { status: "idle" },
  });
  const [balances, setBalances] = useState<Record<AgentId, number>>({ whale: 5000, hunter: 5000, vibes: 5000 });
  const [wins, setWins] = useState<Record<AgentId, number>>({ whale: 0, hunter: 0, vibes: 0 });
  const [erFeed, setErFeed] = useState<ERTx[]>([]);
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [running, setRunning] = useState(false);
  const [winnerBanner, setWinnerBanner] = useState<{ agentId: AgentId | null; amount: number; item: Item } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetRound = useCallback(() => {
    setAgentStates({
      whale: { status: "idle" },
      hunter: { status: "idle" },
      vibes: { status: "idle" },
    });
    setWinnerBanner(null);
  }, []);

  const handleEvent = useCallback((evt: AuctionEvent) => {
    switch (evt.type) {
      case "session_start":
        setAgents(evt.agents);
        setTotalRounds(evt.totalRounds);
        setBalances({
          whale: evt.agents.find((a) => a.id === "whale")!.balance,
          hunter: evt.agents.find((a) => a.id === "hunter")!.balance,
          vibes: evt.agents.find((a) => a.id === "vibes")!.balance,
        });
        setWins({ whale: 0, hunter: 0, vibes: 0 });
        setErFeed([]);
        setStandings(null);
        break;
      case "round_start":
        resetRound();
        setRound(evt.round);
        setItem(evt.item);
        break;
      case "er_tx":
        setErFeed((feed) => [evt.tx, ...feed].slice(0, 18));
        break;
      case "agent_thinking":
        setAgentStates((s) => ({ ...s, [evt.agentId]: { ...s[evt.agentId], status: "thinking" } }));
        break;
      case "agent_sealed":
        setAgentStates((s) => ({
          ...s,
          [evt.agentId]: {
            ...s[evt.agentId],
            status: "sealed",
            thought: evt.thought,
            encryptedBlob: evt.encryptedBlob,
          },
        }));
        break;
      case "reveal":
        setAgentStates((s) => {
          const next = { ...s };
          for (const b of evt.bids) {
            next[b.agentId] = { ...next[b.agentId], status: "revealed", bid: b.bid, encryptedBlob: b.encryptedBlob };
          }
          return next;
        });
        break;
      case "winner":
        if (evt.agentId) {
          const winnerId = evt.agentId;
          setAgentStates((s) => ({
            ...s,
            [winnerId]: { ...s[winnerId], isWinner: true },
          }));
        }
        setWinnerBanner({ agentId: evt.agentId, amount: evt.amount, item: evt.item });
        break;
      case "balances":
        setBalances(evt.balances);
        setWins(evt.wins);
        break;
      case "session_end":
        setStandings(evt.standings);
        setRunning(false);
        break;
    }
  }, [resetRound]);

  const start = useCallback(async () => {
    setRunning(true);
    setStandings(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/auction?rounds=5`, { signal: ac.signal });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            handleEvent(JSON.parse(line) as AuctionEvent);
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setRunning(false);
    }
  }, [handleEvent]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 font-mono">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <header className="flex items-end justify-between mb-10 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-fuchsia-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
              HIDDEN HAND
            </h1>
            <p className="text-zinc-400 mt-2 text-sm">
              Sealed-bid agent auctions on{" "}
              <span className="text-fuchsia-400">MagicBlock Private Ephemeral Rollups</span> · Solana Blitz v4
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-zinc-500 leading-tight">
              <div>round</div>
              <div className="text-zinc-200 text-2xl font-bold">
                {round}/{totalRounds}
              </div>
            </div>
            <button
              onClick={start}
              disabled={running}
              className="px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-fuchsia-600 to-amber-500 hover:from-fuchsia-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-fuchsia-900/40"
            >
              {running ? "Running…" : standings ? "Run Again" : "Start Auction"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <ItemDisplay item={item} winnerBanner={winnerBanner} agents={agents} />

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents?.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  state={agentStates[a.id]}
                  balance={balances[a.id]}
                  wins={wins[a.id]}
                />
              ))}
            </div>

            {standings && <Standings standings={standings} agents={agents!} />}
          </div>

          <aside className="col-span-12 lg:col-span-4">
            <ErFeed feed={erFeed} />
          </aside>
        </div>

        <footer className="mt-12 text-center text-xs text-zinc-600">
          ER endpoint: <span className="text-zinc-400">devnet-tee.magicblock.app</span> · Delegation:{" "}
          <span className="text-zinc-400">DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh</span>
        </footer>
      </div>
    </div>
  );
}

function ItemDisplay({
  item,
  winnerBanner,
  agents,
}: {
  item: Item | null;
  winnerBanner: { agentId: AgentId | null; amount: number; item: Item } | null;
  agents: AgentMeta[] | null;
}) {
  if (!item) {
    return (
      <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
        <div className="text-7xl mb-4">🜚</div>
        <div className="uppercase tracking-widest text-xs">Awaiting Auction</div>
        <p className="mt-3 max-w-md mx-auto text-zinc-600 text-sm leading-relaxed">
          Three autonomous agents will compete in sealed-bid auctions for procedurally-generated artifacts. Bids are
          encrypted in a Private ER and revealed only after all agents commit.
        </p>
      </div>
    );
  }

  const rarityClass = RARITY_COLOR[item.rarity] ?? RARITY_COLOR.Common;
  const glow = RARITY_GLOW[item.rarity] ?? "";
  const winnerAgent = winnerBanner?.agentId ? agents?.find((a) => a.id === winnerBanner.agentId) : null;

  return (
    <div
      className={`relative border-2 rounded-2xl p-8 bg-gradient-to-br from-zinc-900 to-zinc-950 ${rarityClass} ${glow} transition-all duration-500`}
    >
      <div className="flex items-start gap-6">
        <div className="text-8xl drop-shadow-[0_0_25px_currentColor] leading-none">{item.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs uppercase tracking-[0.3em] ${rarityClass.split(" ")[0]}`}>{item.rarity}</div>
          <h2 className="text-4xl font-black mt-1 text-zinc-50">{item.name}</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {item.traits.map((t) => (
              <span
                key={t}
                className="px-2 py-1 rounded text-xs bg-zinc-800/70 text-zinc-300 border border-zinc-700"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 text-zinc-400 italic text-sm leading-relaxed">&ldquo;{item.lore}&rdquo;</p>
          <div className="mt-3 text-xs text-zinc-500">
            base appraisal: <span className="text-zinc-300">{item.baseValue} USDC</span>
          </div>
        </div>
      </div>

      {winnerBanner && (
        <div className="absolute inset-x-6 bottom-6 rounded-xl bg-black/70 backdrop-blur border border-zinc-700 px-5 py-3 flex items-center justify-between">
          {winnerBanner.agentId && winnerAgent ? (
            <>
              <div className="flex items-center gap-3">
                <div className="text-3xl">{winnerAgent.emoji}</div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">Won by</div>
                  <div className="font-bold text-lg text-zinc-100">{winnerAgent.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 uppercase tracking-widest">Settled</div>
                <div className="font-bold text-lg text-amber-300">{winnerBanner.amount} USDC</div>
              </div>
            </>
          ) : (
            <div className="text-zinc-400 text-sm">No bids placed — item returned to the vault.</div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  state,
  balance,
  wins,
}: {
  agent: AgentMeta;
  state: AgentRoundState;
  balance: number;
  wins: number;
}) {
  return (
    <div
      className={`relative rounded-xl border bg-zinc-900/60 p-4 transition-all duration-300 ${
        state.isWinner
          ? "border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)]"
          : state.status === "thinking"
          ? "border-zinc-600 animate-pulse"
          : "border-zinc-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">{agent.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold bg-gradient-to-r ${agent.color} bg-clip-text text-transparent`}>{agent.name}</div>
          <div className="text-xs text-zinc-500">
            {balance} USDC · {wins} won
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-[80px]">
        {state.status === "idle" && <div className="text-zinc-600 text-xs italic">awaiting next round…</div>}
        {state.status === "thinking" && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
            <span>computing bid…</span>
          </div>
        )}
        {(state.status === "sealed" || state.status === "revealed") && state.thought && (
          <div className="text-sm text-zinc-300 leading-relaxed italic">&ldquo;{state.thought}&rdquo;</div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800">
        {state.status === "sealed" && (
          <div className="font-mono text-[10px] text-zinc-500 truncate">
            <span className="text-zinc-600">sealed:</span> {state.encryptedBlob}
          </div>
        )}
        {state.status === "revealed" && (
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">bid</span>
            <span className={`font-black text-2xl ${state.isWinner ? "text-amber-300" : "text-zinc-200"}`}>
              {state.bid} <span className="text-xs text-zinc-500 font-normal">USDC</span>
            </span>
          </div>
        )}
        {state.status === "idle" && <div className="h-6" />}
        {state.status === "thinking" && <div className="h-6" />}
      </div>
    </div>
  );
}

function ErFeed({ feed }: { feed: ERTx[] }) {
  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-950/80 p-4 sticky top-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-widest text-zinc-500">Onchain Feed</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400">LIVE</span>
        </div>
      </div>
      <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
        {feed.length === 0 && <div className="text-zinc-600 text-xs italic">no transactions yet</div>}
        {feed.map((tx, i) => {
          const sigShort = tx.signature && tx.signature !== "(failed)" ? tx.signature.slice(0, 32) + "…" : "";
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`font-bold uppercase tracking-wider ${
                    tx.type === "submit_sealed_bid"
                      ? "text-fuchsia-400"
                      : tx.type === "reveal"
                      ? "text-amber-400"
                      : tx.type === "settle"
                      ? "text-emerald-400"
                      : "text-sky-400"
                  }`}
                >
                  {tx.type.replace(/_/g, " ")}
                </span>
                <span className="text-[9px] text-zinc-600">{tx.endpoint}</span>
              </div>
              {tx.error ? (
                <div className="text-[10px] text-red-400 mt-0.5 truncate">tx failed: {tx.error}</div>
              ) : tx.signature && tx.signature !== "(failed)" ? (
                <div className="font-mono text-zinc-500 truncate mt-0.5 group-hover:text-emerald-400">
                  {sigShort} <span className="text-[9px] text-zinc-600">↗</span>
                </div>
              ) : (
                <div className="font-mono text-zinc-600 italic mt-0.5">submitting…</div>
              )}
              {tx.payload?.encryptedBlob ? (
                <div className="font-mono text-zinc-600 truncate mt-0.5">
                  blob: {String(tx.payload.encryptedBlob).slice(0, 40)}…
                </div>
              ) : null}
              {tx.payload?.amount ? (
                <div className="text-emerald-400 mt-0.5">
                  +{String(tx.payload.amount)} USDC → {String(tx.payload.winner)}
                </div>
              ) : null}
            </>
          );
          const className = "block group border border-zinc-800 rounded-lg px-3 py-2 bg-zinc-900/40 text-[11px] hover:border-zinc-600 transition";
          return tx.explorerUrl ? (
            <a key={tx.signature + i} href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className={className}>
              {inner}
            </a>
          ) : (
            <div key={tx.signature + i} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Standings({ standings, agents }: { standings: Standing[]; agents: AgentMeta[] }) {
  return (
    <div className="mt-8 border border-amber-500/40 rounded-2xl p-6 bg-gradient-to-br from-amber-950/30 to-zinc-950">
      <div className="text-xs uppercase tracking-[0.3em] text-amber-400 mb-4">Final Standings</div>
      <div className="space-y-3">
        {standings.map((s, i) => {
          const agent = agents.find((a) => a.id === s.agentId)!;
          return (
            <div key={s.agentId} className="flex items-center gap-4 border border-zinc-800 rounded-lg p-3 bg-zinc-900/40">
              <div className="text-2xl font-black text-zinc-500 w-6">{i + 1}</div>
              <div className="text-3xl">{agent.emoji}</div>
              <div className="flex-1">
                <div className={`font-bold bg-gradient-to-r ${agent.color} bg-clip-text text-transparent`}>{agent.name}</div>
                <div className="text-xs text-zinc-500">
                  {s.wins} wins · {s.balance} USDC remaining
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.haul.map((h) => (
                    <span key={h.id} title={h.name} className="text-base">
                      {h.emoji}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
