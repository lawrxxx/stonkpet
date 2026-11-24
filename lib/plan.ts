/**
 * Deterministic portfolio maths, ported from the demo's buildPlan() and fit().
 * The model never picks weights; it only picks themes and candidates.
 */
export type Weights = Record<string, number>;

export type Plan = {
  diet: DietKey;
  theme: string;
  excl: string[];
  w: Weights; // fractions of the portfolio, 0..1
  cash: number; // fraction left in USDC because nothing else fits under the max
  lead: string;
  robot: boolean;
  brief: string;
};

export type DietKey = "ai" | "big" | "spicy";
export const DIETS: Record<DietKey, { label: string; text: string; theme: string; pool: [string, number][] }> = {
  ai: { label: "AI growth", text: "AI and robots. Skip Tesla.", theme: "AI", pool: [["NVDA", 30], ["MSFT", 25], ["GOOGL", 25], ["META", 20]] },
  big: { label: "Big tech", text: "The big apps I use every day.", theme: "big tech", pool: [["AAPL", 30], ["MSFT", 25], ["AMZN", 25], ["GOOGL", 20]] },
  spicy: { label: "Spicy", text: "Spicy stuff. Fast movers.", theme: "fast movers", pool: [["TSLA", 40], ["MSTR", 35], ["SNDK", 25]] },
};

const EPS = 1e-9;

/**
 * Normalise raw theme weights, clamp each to `capPct`, and push the excess onto
 * holdings that still have room, in proportion to their size. Anything that
 * can't fit anywhere is left unallocated (it stays in USDC).
 */
export function fit(raw: Weights, capPct: number, rounds = 8): Weights {
  const cap = capPct / 100;
  const tot = Object.values(raw).reduce((a, b) => a + b, 0);
  const w: Weights = {};
  if (tot <= 0) return w;
  for (const k in raw) w[k] = raw[k] / tot;
  for (let i = 0; i < rounds; i++) {
    let extra = 0;
    const free: string[] = [];
    for (const k in w) {
      if (w[k] > cap) { extra += w[k] - cap; w[k] = cap; }
      else if (w[k] < cap - EPS) free.push(k);
    }
    if (extra < EPS || !free.length) break;
    const fs = free.reduce((a, k) => a + w[k], 0);
    for (const k of free) w[k] += (extra * w[k]) / fs;
  }
  return w;
}

export const cashOf = (w: Weights) => Math.max(0, 1 - Object.values(w).reduce((a, b) => a + b, 0));
export const leadOf = (w: Weights) => Object.keys(w).sort((a, b) => w[b] - w[a])[0];

/** Keyword brief parser from the demo. Milestone 3 replaces parsing with Claude structured output. */
export function buildPlan(brief: string, capPct: number): Plan {
  const t = brief.toLowerCase();
  const diet: DietKey = /spicy|fast/.test(t) ? "spicy" : /big tech|every day|apple|amazon/.test(t) ? "big" : "ai";
  const excl: string[] = [];
  if (/(no|not|without|exclude|skip)\s+tesla/.test(t)) excl.push("TSLA");
  if (/(no|skip) crypto/.test(t)) excl.push("MSTR");
  const pool = DIETS[diet].pool.filter((p) => !excl.includes(p[0]));
  const w = fit(Object.fromEntries(pool), capPct, 6);
  return { diet, theme: DIETS[diet].theme, excl, w, cash: cashOf(w), lead: pool[0][0], robot: /robot/.test(t), brief: brief.trim() };
}
