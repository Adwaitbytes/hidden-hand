export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export type Item = {
  id: string;
  name: string;
  rarity: Rarity;
  emoji: string;
  traits: string[];
  lore: string;
  baseValue: number;
};

const NOUNS = ["Tome", "Blade", "Crown", "Amulet", "Sigil", "Chalice", "Orb", "Mask", "Lantern", "Relic", "Scroll", "Idol", "Mirror", "Dagger", "Compass"];
const ADJ = ["Frostbound", "Sunken", "Whispering", "Forgotten", "Cursed", "Radiant", "Ember", "Voidtouched", "Tideborn", "Ashen", "Gilded", "Hollow"];
const TRAITS = ["+Frost Aura", "+Soulbound", "+Void Resonance", "+Sunforged", "+Ancient", "+Bloodlinked", "+Phasing", "+Lightweave", "+Stormcaller", "+Dreamspun", "+Ironclad", "+Silent"];
const EMOJIS: Record<Rarity, string[]> = {
  Common: ["🪨", "🔩", "🪵"],
  Uncommon: ["🗡️", "🛡️", "📜"],
  Rare: ["💎", "🔮", "⚔️"],
  Epic: ["👑", "🌌", "🜂"],
  Legendary: ["🐉", "☄️", "🜚"],
};
const RARITY_BASE: Record<Rarity, number> = {
  Common: 50,
  Uncommon: 120,
  Rare: 280,
  Epic: 600,
  Legendary: 1400,
};
const RARITY_WEIGHTS: [Rarity, number][] = [
  ["Common", 35],
  ["Uncommon", 30],
  ["Rare", 20],
  ["Epic", 11],
  ["Legendary", 4],
];
const LORES = [
  "Recovered from a sunken tower beneath the Black Mire.",
  "Said to whisper the names of those who will die in the coming year.",
  "Forged in a star that fell during the second age.",
  "The last artifact of a civilization that mapped the moon.",
  "Pulsing faintly, as if it remembers a wielder long gone.",
  "Stolen from the dream of a sleeping god.",
  "Etched with a language no living scholar can read.",
  "Reportedly causes mild hallucinations in dim light.",
  "Carried by a queen who outlived three kingdoms.",
  "Cold to the touch even in summer.",
];

function pickWeighted(): Rarity {
  const total = RARITY_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [rar, w] of RARITY_WEIGHTS) {
    if ((r -= w) <= 0) return rar;
  }
  return "Common";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

export function generateItem(): Item {
  const rarity = pickWeighted();
  const numTraits = rarity === "Legendary" ? 3 : rarity === "Epic" ? 2 : rarity === "Rare" ? 2 : 1;
  const baseValue = Math.round(RARITY_BASE[rarity] * (0.85 + Math.random() * 0.4));
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: `${pick(ADJ)} ${pick(NOUNS)}`,
    rarity,
    emoji: pick(EMOJIS[rarity]),
    traits: pickN(TRAITS, numTraits),
    lore: pick(LORES),
    baseValue,
  };
}
