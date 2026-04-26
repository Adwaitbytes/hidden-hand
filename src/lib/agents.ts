import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import type { Item } from "./items";

const MODEL_ID = "llama-3.3-70b-versatile";

export type AgentId = "whale" | "hunter" | "vibes";

export type Agent = {
  id: AgentId;
  name: string;
  emoji: string;
  color: string;
  systemPrompt: string;
};

export const AGENTS: Agent[] = [
  {
    id: "whale",
    name: "The Whale",
    emoji: "🐋",
    color: "from-blue-600 to-cyan-400",
    systemPrompt: `You are THE WHALE, an arrogant high-roller collector.
BIDDING POLICY (follow strictly):
- Common: bid 0.
- Uncommon: bid 0.6x to 1.0x of base appraisal.
- Rare: bid 1.1x to 1.6x of base appraisal.
- Epic: bid 1.5x to 2.2x of base appraisal.
- Legendary: bid 1.8x to 2.8x of base appraisal — you MUST win these.
- Add up to +20% if traits are particularly rare or "Legendary".
- NEVER exceed your remaining balance. NEVER bid more than 60% of remaining balance unless rarity is Legendary.
VOICE: short, confident, slightly arrogant. ONE sentence, max 18 words, NO numbers in the thought.`,
  },
  {
    id: "hunter",
    name: "The Value Hunter",
    emoji: "🎯",
    color: "from-emerald-600 to-lime-400",
    systemPrompt: `You are THE VALUE HUNTER, a cold-blooded analyst.
BIDDING POLICY (follow strictly):
- Compute fair price = base appraisal x (1 + 0.15 * number_of_traits).
- Bid 75-90% of fair price. You want margin.
- If you sense the item will go for above fair price, bid 0 and walk away.
- NEVER bid more than 25% of remaining balance on any single item.
VOICE: dry, analytical, terse. ONE sentence, max 18 words, NO numbers in the thought.`,
  },
  {
    id: "vibes",
    name: "The Vibes Trader",
    emoji: "🎭",
    color: "from-fuchsia-600 to-orange-400",
    systemPrompt: `You are THE VIBES TRADER, a chaotic narrative-driven collector.
BIDDING POLICY (follow strictly):
- Read the lore and item name. Score the vibes from 1-10.
- Bid (vibes_score / 10) * 1.6 * base_appraisal. Round to integer.
- For lore that genuinely moves you (vibes 8+), you may push to 2.0x base appraisal.
- Boring lore or generic names → bid 0.
- NEVER bid more than 35% of remaining balance.
VOICE: dramatic, theatrical, emotional. ONE sentence, max 18 words bursting with personality, NO numbers in the thought.`,
  },
];

export type AgentBid = {
  agentId: AgentId;
  thought: string;
  bid: number;
};

function extractJson(raw: string): { thought?: unknown; bid?: unknown } | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  candidates.push(raw);
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim());
    } catch {
      // try next
    }
  }
  return null;
}

export async function runAgent(
  agent: Agent,
  item: Item,
  remainingBalance: number,
  roundNumber: number
): Promise<AgentBid> {
  const userPrompt = `AUCTION ROUND ${roundNumber}.

Up for sealed bid:
- Item: ${item.name}
- Rarity: ${item.rarity}
- Base appraisal: ${item.baseValue} USDC
- Traits: ${item.traits.join(", ") || "none"}
- Lore: "${item.lore}"

Your remaining balance: ${remainingBalance} USDC.
Minimum bid: 1 USDC. You may bid 0 to skip.

Reply with ONLY a single JSON object on one line, no prose, no markdown fences. Schema:
{"thought": "<one sentence in character, max 18 words, NO numbers>", "bid": <integer 0..${remainingBalance}>}`;

  try {
    const { text } = await generateText({
      model: groq(MODEL_ID),
      system: agent.systemPrompt,
      prompt: userPrompt,
      temperature: 0.9,
    });
    const parsed = extractJson(text);
    if (!parsed || typeof parsed.bid !== "number" || typeof parsed.thought !== "string") {
      throw new Error(`unparseable response: ${text.slice(0, 200)}`);
    }
    const bid = Math.max(0, Math.min(Math.round(parsed.bid), remainingBalance));
    const thought = parsed.thought.trim().slice(0, 220);
    return { agentId: agent.id, thought, bid };
  } catch (err) {
    console.error(`Agent ${agent.id} failed:`, err);
    return {
      agentId: agent.id,
      thought: "(...the agent's signal is lost in static...)",
      bid: 0,
    };
  }
}
