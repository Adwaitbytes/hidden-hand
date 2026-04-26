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

type WalletStats = {
  address: string;
  explorerUrl: string;
  balance: number;
  txCount: number;
  endpoints: { devnet: string; er: string; tee: string };
  recent: { signature: string; explorerUrl: string }[];
};

const RARITY_BORDER: Record<string, string> = {
  Common: "border-zinc-600/60",
  Uncommon: "border-emerald-500/70",
  Rare: "border-sky-500/80",
  Epic: "border-fuchsia-500/80",
  Legendary: "border-amber-400/90",
};

const RARITY_TEXT: Record<string, string> = {
  Common: "text-zinc-300",
  Uncommon: "text-emerald-300",
  Rare: "text-sky-300",
  Epic: "text-fuchsia-300",
  Legendary: "text-amber-300",
};

const RARITY_GLOW: Record<string, string> = {
  Common: "",
  Uncommon: "shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)]",
  Rare: "shadow-[0_0_50px_-10px_rgba(56,189,248,0.5)]",
  Epic: "shadow-[0_0_60px_-8px_rgba(217,70,239,0.55)]",
  Legendary: "shadow-[0_0_80px_-8px_rgba(245,158,11,0.65)]",
};

const RARITY_ACCENT: Record<string, string> = {
  Common: "from-zinc-700 to-zinc-800",
  Uncommon: "from-emerald-700/50 to-emerald-900/30",
  Rare: "from-sky-700/50 to-sky-900/30",
  Epic: "from-fuchsia-700/50 to-fuchsia-900/30",
  Legendary: "from-amber-600/50 to-amber-900/30",
};

const TX_COLOR: Record<string, string> = {
  delegate: "text-sky-400",
  submit_sealed_bid: "text-fuchsia-400",
  reveal: "text-amber-300",
  settle: "text-emerald-400",
  audit_trail: "text-violet-300",
  undelegate: "text-zinc-400",
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
  const [auditTx, setAuditTx] = useState<ERTx | null>(null);
  const [running, setRunning] = useState(false);
  const [winnerBanner, setWinnerBanner] = useState<{ agentId: AgentId | null; amount: number; item: Item } | null>(null);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchWalletStats = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet-stats", { cache: "no-store" });
      if (res.ok) setWalletStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchWalletStats();
    const t = setInterval(fetchWalletStats, 8000);
    return () => clearInterval(t);
  }, [fetchWalletStats]);

  const resetRound = useCallback(() => {
    setAgentStates({
      whale: { status: "idle" },
      hunter: { status: "idle" },
      vibes: { status: "idle" },
    });
    setWinnerBanner(null);
  }, []);

  const handleEvent = useCallback(
    (evt: AuctionEvent) => {
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
          setAuditTx(null);
          break;
        case "round_start":
          resetRound();
          setRound(evt.round);
          setItem(evt.item);
          break;
        case "er_tx":
          setErFeed((feed) => [evt.tx, ...feed].slice(0, 24));
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
          if (evt.auditTx) setAuditTx(evt.auditTx);
          setRunning(false);
          fetchWalletStats();
          break;
      }
    },
    [resetRound, fetchWalletStats]
  );

  const start = useCallback(async () => {
    setRunning(true);
    setStandings(null);
    setAuditTx(null);
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
      fetchWalletStats();
    }
  }, [handleEvent, fetchWalletStats]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="min-h-screen text-zinc-100 relative overflow-x-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid pointer-events-none opacity-40" />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 relative">
        <Header
          running={running}
          standings={!!standings}
          round={round}
          totalRounds={totalRounds}
          onStart={start}
          walletStats={walletStats}
        />

        <div className="grid grid-cols-12 gap-6 mt-8">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <ItemDisplay item={item} winnerBanner={winnerBanner} agents={agents} round={round} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents?.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  state={agentStates[a.id]}
                  balance={balances[a.id]}
                  wins={wins[a.id]}
                />
              ))}
              {!agents && <AgentCardSkeletons />}
            </div>

            {auditTx && <AuditCallout tx={auditTx} />}
            {standings && agents && <Standings standings={standings} agents={agents} />}

            <VerifyOnChain stats={walletStats} />
          </div>

          <aside className="col-span-12 lg:col-span-4 space-y-6">
            <ErFeed feed={erFeed} />
            <ArchitectureCard />
          </aside>
        </div>

        <Footer />
      </div>
    </div>
  );
}

function Header({
  running,
  standings,
  round,
  totalRounds,
  onStart,
  walletStats,
}: {
  running: boolean;
  standings: boolean;
  round: number;
  totalRounds: number;
  onStart: () => void;
  walletStats: WalletStats | null;
}) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 border-b border-zinc-800/80 pb-8">
      <div className="flex items-start gap-4">
        <Logo />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-fuchsia-400 via-amber-200 to-emerald-300 bg-clip-text text-transparent">
                HIDDEN HAND
              </span>
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
              live
            </span>
          </div>
          <p className="text-zinc-400 mt-1.5 text-sm leading-relaxed max-w-2xl">
            Three autonomous LLM agents bid against each other in sealed-bid auctions —
            <span className="text-fuchsia-300"> bids encrypted in MagicBlock&apos;s Private ER</span>,
            revealed atomically, settled on Solana.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[11px] font-mono">
            <Badge label="theme" value="agentic" tone="fuchsia" />
            <Badge label="event" value="solana blitz v4" tone="amber" />
            <Badge
              label="program"
              value="9hmucQ…hVDTg"
              tone="violet"
              href="https://solscan.io/account/9hmucQcDZ1SJDCD8oM7KV5Rngfx7ZAcwZWk3WTghVDTg?cluster=devnet"
            />
            {walletStats && (
              <Badge
                label="house"
                value={`${walletStats.balance.toFixed(3)} SOL · ${walletStats.txCount} tx`}
                tone="cyan"
                href={walletStats.explorerUrl}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right text-[11px] text-zinc-500 leading-tight font-mono uppercase tracking-widest">
          <div>round</div>
          <div className="text-zinc-100 text-3xl font-black mt-0.5 font-sans">
            {round}
            <span className="text-zinc-600">/{totalRounds}</span>
          </div>
        </div>
        <button
          onClick={onStart}
          disabled={running}
          className="relative group px-7 py-3.5 rounded-xl font-bold text-sm uppercase tracking-[0.18em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 transition overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-fuchsia-400 via-amber-300 to-emerald-300 transition group-hover:scale-105 group-disabled:opacity-60" />
          <span className="absolute inset-[1.5px] rounded-[10px] bg-gradient-to-r from-fuchsia-400 via-amber-300 to-emerald-300" />
          <span className="relative z-10 flex items-center gap-2">
            {running ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-zinc-950 animate-pulse" />
                running
              </>
            ) : standings ? (
              "Run again"
            ) : (
              <>Start auction <span className="text-base">→</span></>
            )}
          </span>
        </button>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="hidden sm:flex w-14 h-14 rounded-2xl items-center justify-center relative shrink-0">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-amber-400 to-emerald-400 opacity-90" />
      <div className="absolute inset-[2px] rounded-[14px] bg-zinc-950" />
      <div className="relative w-7 h-[3px] rounded-full bg-gradient-to-r from-fuchsia-400 via-amber-300 to-emerald-300" />
      <div className="absolute w-3.5 h-3.5 rounded-full bg-gradient-to-br from-fuchsia-400 to-amber-300 animate-glow-pulse text-fuchsia-400" />
    </div>
  );
}

function Badge({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: string;
  tone: "fuchsia" | "amber" | "emerald" | "cyan" | "violet";
  href?: string;
}) {
  const toneMap: Record<string, string> = {
    fuchsia: "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10",
    amber: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    cyan: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
    violet: "text-violet-300 border-violet-500/30 bg-violet-500/10",
  };
  const inner = (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${toneMap[tone]}`}>
      <span className="text-zinc-500 uppercase tracking-widest text-[9px]">{label}</span>
      <span>{value}</span>
    </span>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition">
      {inner}
    </a>
  ) : (
    inner
  );
}

function ItemDisplay({
  item,
  winnerBanner,
  agents,
  round,
}: {
  item: Item | null;
  winnerBanner: { agentId: AgentId | null; amount: number; item: Item } | null;
  agents: AgentMeta[] | null;
  round: number;
}) {
  if (!item) {
    return (
      <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-500 glass">
        <div className="text-7xl mb-4 animate-glow-pulse text-fuchsia-400/70">🜚</div>
        <div className="uppercase tracking-[0.4em] text-xs text-zinc-400">awaiting auction</div>
        <p className="mt-4 max-w-md mx-auto text-zinc-500 text-sm leading-relaxed">
          Three autonomous agents will compete in sealed-bid auctions for procedurally-generated
          artifacts. Bids are encrypted inside a Private Ephemeral Rollup and revealed only after
          all agents commit.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-mono text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          devnet · groq · magicblock
        </div>
      </div>
    );
  }

  const borderClass = RARITY_BORDER[item.rarity] ?? RARITY_BORDER.Common;
  const textClass = RARITY_TEXT[item.rarity] ?? RARITY_TEXT.Common;
  const glow = RARITY_GLOW[item.rarity] ?? "";
  const accent = RARITY_ACCENT[item.rarity] ?? RARITY_ACCENT.Common;
  const winnerAgent = winnerBanner?.agentId ? agents?.find((a) => a.id === winnerBanner.agentId) : null;

  return (
    <div
      key={item.id}
      className={`relative rounded-3xl border-2 ${borderClass} ${glow} bg-gradient-to-br ${accent} bg-zinc-950/80 overflow-hidden animate-fadeup`}
    >
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <div className="absolute top-4 right-4 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
        lot · #{round.toString().padStart(3, "0")}
      </div>

      <div className="relative p-8 lg:p-10 flex items-start gap-6 lg:gap-8">
        <div className="relative shrink-0">
          <div className={`absolute inset-0 blur-2xl opacity-50 ${textClass}`}>{item.emoji}</div>
          <div className="relative text-7xl lg:text-8xl leading-none animate-glow-pulse">{item.emoji}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-mono uppercase tracking-[0.4em] ${textClass}`}>
            {item.rarity}
          </div>
          <h2 className="text-3xl lg:text-5xl font-black mt-2 text-zinc-50 leading-tight">
            {item.name}
          </h2>
          <div className="flex flex-wrap gap-2 mt-4">
            {item.traits.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-900/80 text-zinc-300 border border-zinc-700/80"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-5 text-zinc-400 italic text-sm leading-relaxed max-w-2xl">
            &ldquo;{item.lore}&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-4 text-[11px] font-mono">
            <span className="text-zinc-500">
              base appraisal{" "}
              <span className="text-zinc-200 font-bold">{item.baseValue}</span>{" "}
              <span className="text-zinc-600">USDC</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">
              hash <span className="text-zinc-300">{item.id.slice(0, 8)}</span>
            </span>
          </div>
        </div>
      </div>

      {winnerBanner && (
        <div className="absolute inset-x-6 bottom-6 rounded-2xl glass border border-zinc-700/70 px-5 py-3.5 flex items-center justify-between animate-fadeup">
          {winnerBanner.agentId && winnerAgent ? (
            <>
              <div className="flex items-center gap-3">
                <div className="text-3xl animate-glow-pulse text-amber-300">{winnerAgent.emoji}</div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">Won by</div>
                  <div className="font-bold text-base text-zinc-100">{winnerAgent.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">Settled</div>
                <div className="font-black text-xl text-amber-300">{winnerBanner.amount}</div>
                <div className="text-[10px] text-zinc-500">USDC</div>
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

function AgentCardSkeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 h-44 shimmer" />
      ))}
    </>
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
  const winnerRing = state.isWinner
    ? "border-amber-400/90 shadow-[0_0_40px_-8px_rgba(245,158,11,0.6)]"
    : state.status === "thinking"
    ? "border-zinc-600/80"
    : "border-zinc-800/80";

  return (
    <div className={`relative rounded-2xl border ${winnerRing} bg-zinc-950/70 backdrop-blur p-5 transition-all duration-500`}>
      {state.isWinner && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse-ring" />}

      <div className="flex items-center gap-3">
        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-3xl bg-gradient-to-br ${agent.color}/30`}>
          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${agent.color} opacity-20`} />
          <span className="relative">{agent.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-black text-sm bg-gradient-to-r ${agent.color} bg-clip-text text-transparent`}>
            {agent.name}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
            {balance.toLocaleString()} <span className="text-zinc-700">USDC</span>
            <span className="text-zinc-700"> · </span>
            <span className="text-emerald-400">{wins}</span>
            <span className="text-zinc-600"> won</span>
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-[60px] flex items-start">
        {state.status === "idle" && (
          <div className="text-zinc-600 text-xs italic">awaiting next round…</div>
        )}
        {state.status === "thinking" && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" style={{ animationDelay: "300ms" }} />
            </span>
            <span>computing bid…</span>
          </div>
        )}
        {(state.status === "sealed" || state.status === "revealed") && state.thought && (
          <div key={state.thought} className="text-sm text-zinc-200 leading-relaxed italic animate-fadeup">
            &ldquo;{state.thought}&rdquo;
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-800/80 min-h-[36px]">
        {state.status === "sealed" && (
          <div className="font-mono text-[10px] text-zinc-500 truncate animate-fadeup">
            <span className="text-zinc-600 uppercase tracking-widest mr-1">sealed</span>
            <span className="text-fuchsia-300/80">{state.encryptedBlob}</span>
          </div>
        )}
        {state.status === "revealed" && (
          <div className="flex items-baseline justify-between animate-flip">
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">revealed bid</span>
            <span className={`font-black text-2xl ${state.isWinner ? "text-amber-300" : "text-zinc-100"}`}>
              {state.bid?.toLocaleString()}
              <span className="text-[10px] text-zinc-500 font-normal ml-1">USDC</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ErFeed({ feed }: { feed: ERTx[] }) {
  return (
    <div className="border border-zinc-800/80 rounded-2xl glass p-5 sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-400 font-mono">
            on-chain feed
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest">live</span>
        </div>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
        {feed.length === 0 && (
          <div className="text-zinc-600 text-xs italic py-8 text-center">
            no transactions yet — start the auction
          </div>
        )}
        {feed.map((tx, i) => {
          const sigShort = tx.signature && tx.signature !== "(failed)" ? tx.signature.slice(0, 24) + "…" : "";
          const colorClass = TX_COLOR[tx.type] ?? "text-zinc-300";
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span className={`font-bold uppercase tracking-wider text-[10px] ${colorClass}`}>
                  {tx.type.replace(/_/g, " ")}
                </span>
                <span className="text-[9px] text-zinc-600 font-mono">{tx.endpoint}</span>
              </div>
              {tx.error ? (
                <div className="text-[10px] text-red-400 mt-1 truncate font-mono">tx failed: {tx.error}</div>
              ) : tx.signature && tx.signature !== "(failed)" ? (
                <div className="font-mono text-zinc-500 truncate mt-1 group-hover:text-emerald-300 transition text-[10px]">
                  {sigShort} <span className="text-[9px] text-zinc-600 group-hover:text-emerald-400">↗</span>
                </div>
              ) : (
                <div className="font-mono text-zinc-600 italic mt-1 text-[10px]">submitting…</div>
              )}
              {tx.payload?.encryptedBlob ? (
                <div className="font-mono text-zinc-700 truncate mt-1 text-[9px]">
                  blob: {String(tx.payload.encryptedBlob).slice(0, 32)}…
                </div>
              ) : null}
              {tx.payload?.amount ? (
                <div className="text-emerald-400 mt-1 text-[10px] font-mono">
                  +{String(tx.payload.amount)} USDC → {String(tx.payload.winner)}
                </div>
              ) : null}
            </>
          );
          const className =
            "block group border border-zinc-800/80 rounded-lg px-3 py-2 bg-zinc-900/40 hover:border-zinc-600/80 hover:bg-zinc-900/70 transition animate-slidein";
          return tx.explorerUrl ? (
            <a
              key={tx.signature + i}
              href={tx.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
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

function ArchitectureCard() {
  const flow: { label: string; endpoint: string; tone: string }[] = [
    { label: "delegate auction", endpoint: "solana devnet", tone: "text-sky-400" },
    { label: "submit sealed bid", endpoint: "private ER (TEE)", tone: "text-fuchsia-400" },
    { label: "reveal", endpoint: "private ER (TEE)", tone: "text-amber-300" },
    { label: "settle", endpoint: "solana devnet", tone: "text-emerald-400" },
    { label: "audit trail", endpoint: "solana devnet", tone: "text-violet-300" },
  ];
  return (
    <div className="border border-zinc-800/80 rounded-2xl glass p-5">
      <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-400 font-mono mb-4">
        per-round flow
      </div>
      <ol className="space-y-2">
        {flow.map((f, i) => (
          <li key={f.label} className="flex items-center gap-3 text-[11px] font-mono">
            <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[9px] text-zinc-500">
              {i + 1}
            </span>
            <span className={`font-bold uppercase tracking-wider ${f.tone}`}>{f.label}</span>
            <span className="text-zinc-600">→</span>
            <span className="text-zinc-400">{f.endpoint}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VerifyOnChain({ stats }: { stats: WalletStats | null }) {
  return (
    <div className="border border-emerald-800/40 rounded-2xl glass p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-300 font-mono">
            verify on chain
          </div>
          <div className="text-zinc-500 text-xs mt-1">
            Every event above is a real, signed Solana transaction. Click any signature to verify.
          </div>
        </div>
        {stats && (
          <a
            href={stats.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono text-emerald-300 hover:text-emerald-200 transition"
          >
            view wallet ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="house balance" value={stats ? `${stats.balance.toFixed(4)} SOL` : "…"} />
        <Stat label="total tx" value={stats ? `${stats.txCount}` : "…"} />
        <Stat label="solana" value="devnet" mono />
        <Stat label="er endpoint" value="devnet-tee" mono />
      </div>

      {stats?.address && (
        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">house wallet</div>
          <a
            href={stats.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-zinc-300 break-all hover:text-emerald-300 transition"
          >
            {stats.address}
          </a>
        </div>
      )}

      {stats?.recent?.length ? (
        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">most recent on-chain activity</div>
          <ul className="space-y-1.5">
            {stats.recent.slice(0, 5).map((r) => (
              <li key={r.signature} className="flex items-center justify-between gap-2 text-[10px] font-mono">
                <a
                  href={r.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-emerald-300 transition truncate"
                >
                  {r.signature.slice(0, 32)}…
                </a>
                <span className="text-emerald-400 shrink-0">↗</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/80 px-3 py-2.5">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">{label}</div>
      <div className={`text-zinc-100 mt-0.5 ${mono ? "font-mono text-xs" : "font-bold text-base"}`}>
        {value}
      </div>
    </div>
  );
}

function AuditCallout({ tx }: { tx: ERTx }) {
  return (
    <div className="border border-violet-500/30 rounded-2xl bg-gradient-to-br from-violet-950/40 to-zinc-950 p-5 animate-fadeup">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-2xl">🧾</div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.3em] text-violet-300 font-mono">
              audit trail committed
            </div>
            <div className="text-zinc-300 text-sm mt-1">
              Final standings recorded on Solana devnet — permanent, verifiable, immutable.
            </div>
          </div>
        </div>
        {tx.explorerUrl && (
          <a
            href={tx.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-2 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-200 text-[11px] font-mono hover:bg-violet-500/20 transition"
          >
            verify ↗
          </a>
        )}
      </div>
    </div>
  );
}

function Standings({ standings, agents }: { standings: Standing[]; agents: AgentMeta[] }) {
  return (
    <div className="border border-amber-500/30 rounded-2xl bg-gradient-to-br from-amber-950/30 to-zinc-950 p-6 animate-fadeup">
      <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300 font-mono mb-4">
        final standings
      </div>
      <div className="space-y-3">
        {standings.map((s, i) => {
          const agent = agents.find((a) => a.id === s.agentId)!;
          const placeColor = i === 0 ? "text-amber-300" : i === 1 ? "text-zinc-300" : "text-amber-700";
          return (
            <div
              key={s.agentId}
              className={`flex items-center gap-4 border rounded-xl p-4 ${
                i === 0
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-zinc-800/80 bg-zinc-900/40"
              }`}
            >
              <div className={`text-3xl font-black w-8 text-center ${placeColor}`}>
                {i + 1}
              </div>
              <div className="text-3xl">{agent.emoji}</div>
              <div className="flex-1">
                <div className={`font-black bg-gradient-to-r ${agent.color} bg-clip-text text-transparent`}>
                  {agent.name}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {s.wins} wins · {s.balance.toLocaleString()} USDC remaining
                </div>
                {s.haul.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.haul.map((h) => (
                      <span
                        key={h.id}
                        title={`${h.name} (${h.rarity})`}
                        className="text-lg leading-none"
                      >
                        {h.emoji}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 pt-8 border-t border-zinc-800/80">
      <div className="grid md:grid-cols-2 gap-4 text-[11px] font-mono text-zinc-500">
        <div>
          <div className="text-zinc-600 uppercase tracking-widest text-[9px] mb-1">endpoints</div>
          <div className="text-zinc-400">api.devnet.solana.com</div>
          <div className="text-fuchsia-300">devnet-tee.magicblock.app</div>
        </div>
        <div>
          <div className="text-zinc-600 uppercase tracking-widest text-[9px] mb-1">programs</div>
          <a
            href="https://solscan.io/account/9hmucQcDZ1SJDCD8oM7KV5Rngfx7ZAcwZWk3WTghVDTg?cluster=devnet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-300 hover:text-violet-200 transition block"
          >
            hidden_hand: 9hmucQcDZ1SJDCD8oM7KV5Rngfx7ZAcwZWk3WTghVDTg
          </a>
          <div className="text-zinc-400">delegation: DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh</div>
        </div>
      </div>
      <div className="mt-3 text-center text-[10px] text-zinc-600">
        built for solana blitz v4 · agentic theme · april 2026
      </div>
    </footer>
  );
}
