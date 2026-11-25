/**
 * The rules engine. Every money-moving action (from chat, autopilot or the UI)
 * goes through check() before anything is sent onchain, and again on the
 * approve route. Rules live here in code, not in the model's prompt, so the
 * agent can't talk its way past them.
 *
 * Pure and synchronous: callers pass a snapshot of everything it needs.
 */
import { canTrade, type FeedStatus } from "./market";

export type Action =
  | { type: "feed"; amountUsd: number } // invest wallet USDC, split by plan weights
  | { type: "buy"; ticker: string; amountUsd: number } // buy more of one stock
  | { type: "sell"; ticker: string; amountUsd: number }
  | { type: "add"; ticker: string; pct: number } // add a new stock to the plan at pct of the portfolio
  | { type: "drop"; ticker: string }
  | { type: "rebalance" }
  | { type: "setMax"; pct: number }
  | { type: "setWeeklyFeed"; amountUsd: number };

export type Rules = {
  maxPct: number; // most in one company, % of the portfolio
  askAboveUsd: number; // amounts above this need an explicit yes
  excluded: string[]; // tickers the user never wants
  paused: boolean;
  /** Opt-in: trade while the US market is closed, at live exchange prices (never on a frozen feed). */
  tradeAfterHours?: boolean;
};

export type Snapshot = {
  rules: Rules;
  /** Current USD value of each holding. */
  holdings: Record<string, number>;
  /** USDC already inside the plan (not in the wallet). */
  planCashUsd: number;
  /** Plan weights (0..1) used to split a feed. */
  weights: Record<string, number>;
  /** Spendable wallet USDC; null if it couldn't be read. */
  walletUsdc: number | null;
  /** Feed status per ticker from lib/market (live / closed / stale / paused / missing). */
  feeds: Record<string, FeedStatus>;
  /** Every ticker listed on Base, and the ones with a price feed. */
  listed: ReadonlySet<string>;
  tradable: ReadonlySet<string>;
  /** Display names for messages. */
  names?: Record<string, string>;
  /** Where each tradable stock's price comes from. Missing = "chainlink". */
  priceSource?: Record<string, "chainlink" | "dex">;
  /** DEX pool liquidity in USD, for dex-priced stocks. */
  poolLiquidityUsd?: Record<string, number>;
  /**
   * After hours: the live exchange price for each stock, and the last official close
   * (Chainlink) it's compared against. ref is null for stocks with no official feed.
   */
  afterHours?: Record<string, { price: number; ref: number | null }>;
};

/** After hours, an exchange price this far from the last official close is refused. */
export const MAX_AFTER_HOURS_GAP = 0.02;

/** A single trade in a DEX-priced stock may be at most this share of its pool. */
export const MAX_POOL_SHARE = 0.01;

export type Code =
  | "INVALID_AMOUNT" | "NOT_LISTED" | "NO_PRICE_FEED" | "EXCLUDED" | "PAUSED"
  | "MARKET_CLOSED" | "PRICE_FROZEN" | "OVER_MAX" | "INSUFFICIENT_FUNDS" | "BALANCE_UNKNOWN"
  | "NOT_HELD" | "NOT_ENOUGH_HELD" | "ALREADY_HELD" | "TOO_CONCENTRATED" | "OUT_OF_RANGE" | "TOO_BIG_FOR_POOL"
  | "AFTER_HOURS_GAP" | "NO_AFTER_HOURS_PRICE";

export type Verdict =
  | {
      ok: true;
      /** Above the "check with me" threshold: must not run without the user's explicit yes. */
      needsApproval: boolean;
      /** Valid, but has to wait for the market to open (feeds only). Never settles on a closed or frozen price. */
      queueUntilOpen: boolean;
      /** Runs now while the market is closed, at live exchange prices (the user opted in). */
      afterHours: boolean;
      notes: string[];
    }
  | { ok: false; code: Code; reason: string };

export const MAX_RANGE = { min: 10, max: 60 } as const;
const EPS = 1e-6;
const usd = (v: number) => "$" + v.toFixed(2);

function refuse(code: Code, reason: string): Verdict {
  return { ok: false, code, reason };
}

export function check(a: Action, s: Snapshot): Verdict {
  const name = (t: string) => s.names?.[t] ?? t;
  const total = Object.values(s.holdings).reduce((x, y) => x + y, 0) + s.planCashUsd;
  const r = s.rules;
  const notes: string[] = [];

  // --- settings changes: no market or money checks ---
  if (a.type === "setMax") {
    if (!Number.isFinite(a.pct) || a.pct < MAX_RANGE.min || a.pct > MAX_RANGE.max)
      return refuse("OUT_OF_RANGE", `Your max has to be between ${MAX_RANGE.min}% and ${MAX_RANGE.max}%. Lower and I can't build a plan, higher and one stock could sink you.`);
    return { ok: true, needsApproval: true, queueUntilOpen: false, afterHours: false, notes };
  }
  if (a.type === "setWeeklyFeed") {
    if (!(a.amountUsd > 0)) return refuse("INVALID_AMOUNT", "The weekly amount has to be more than $0.");
    return { ok: true, needsApproval: true, queueUntilOpen: false, afterHours: false, notes };
  }

  // --- every trade from here on ---
  if (r.paused) return refuse("PAUSED", `Trading is paused. Say "resume" and I'll pick it back up.`);

  if ("amountUsd" in a && !(a.amountUsd > 0)) return refuse("INVALID_AMOUNT", "The amount has to be more than $0.");

  // Which stocks does this touch, and do they exist and have a price?
  const touched: string[] =
    a.type === "feed" ? Object.keys(s.weights).filter((t) => s.weights[t] > EPS)
    : a.type === "rebalance" ? Object.keys(s.holdings)
    : [a.ticker];
  for (const t of touched) {
    if (!s.listed.has(t)) return refuse("NOT_LISTED", `${name(t)} isn't on Base, so I can't trade it.`);
    if (!s.tradable.has(t)) return refuse("NO_PRICE_FEED", `${name(t)} is listed on Base, but it has no live price feed, so I can't check it against your rules.`);
  }

  // Buying an excluded stock, directly or through a feed.
  const buys = a.type === "buy" || a.type === "add" || a.type === "feed";
  if (buys) {
    const bad = touched.find((t) => r.excluded.includes(t));
    if (bad) return refuse("EXCLUDED", `You told me never to buy ${name(bad)}. Take it off your "never buy" list first if you've changed your mind.`);
  }

  // Market hours and frozen feeds. A frozen feed always stops the trade. A closed market
  // queues feeds (and blocks other trades), unless the user opted into after-hours trading:
  // then it runs at the live exchange price, within a gap of the last official close.
  let queueUntilOpen = false;
  let afterHours = false;
  for (const t of touched) {
    const st = s.feeds[t] ?? "missing";
    if (canTrade(st)) continue;
    if (st !== "closed")
      return refuse("PRICE_FROZEN", `${name(t)}'s price feed is ${st === "missing" ? "missing" : "frozen"} right now, maybe for a corporate action. I never trade on a frozen price.`);
    if (r.tradeAfterHours) {
      const q = s.afterHours?.[t];
      if (!q || !(q.price > 0)) return refuse("NO_AFTER_HOURS_PRICE", `There's no live exchange price for ${name(t)} right now, so I'll wait for the open.`);
      if (q.ref !== null) {
        const gap = q.price / q.ref - 1;
        if (Math.abs(gap) > MAX_AFTER_HOURS_GAP + EPS)
          return refuse("AFTER_HOURS_GAP", `After hours, ${name(t)} is trading ${Math.abs(gap * 100).toFixed(1)}% ${gap > 0 ? "above" : "below"} its last close. That's too far from the official price, so I'll wait for the open.`);
      }
      afterHours = true;
      continue;
    }
    if (a.type === "feed") { queueUntilOpen = true; continue; }
    return refuse("MARKET_CLOSED", `The market's closed, so I can't trade ${name(t)} right now. Prices freeze until it opens.`);
  }
  if (queueUntilOpen) notes.push("Market's closed. This waits for the open.");
  if (afterHours) {
    const gaps = touched.map((t) => s.afterHours?.[t]).filter((q): q is { price: number; ref: number } => !!q && q.ref !== null);
    const worst = gaps.reduce((m, q) => Math.max(m, Math.abs(q.price / q.ref - 1)), 0);
    notes.push(`Market's closed, so I'll buy at the exchange price${gaps.length ? `, at most ${(worst * 100).toFixed(1)}% from the last close` : ""}.`);
  }

  // Per-action checks.
  switch (a.type) {
    case "feed": {
      if (s.walletUsdc === null) return refuse("BALANCE_UNKNOWN", "I can't read your wallet balance right now, so I won't spend anything.");
      if (a.amountUsd > s.walletUsdc + EPS) return refuse("INSUFFICIENT_FUNDS", `You've got ${usd(s.walletUsdc)} of USDC. That's not enough for ${usd(a.amountUsd)}.`);
      const after = total + a.amountUsd;
      for (const t of touched) {
        const pct = (((s.holdings[t] ?? 0) + a.amountUsd * s.weights[t]) / after) * 100;
        if (pct > r.maxPct + EPS) return refuse("OVER_MAX", `That would put ${name(t)} at ${Math.round(pct)}%, over your ${r.maxPct}% max.`);
      }
      break;
    }
    case "buy": {
      if (!(a.ticker in s.holdings)) return refuse("NOT_HELD", `${name(a.ticker)} isn't in your plan. Ask me to add it instead.`);
      if (s.walletUsdc === null) return refuse("BALANCE_UNKNOWN", "I can't read your wallet balance right now, so I won't spend anything.");
      if (a.amountUsd > s.walletUsdc + EPS) return refuse("INSUFFICIENT_FUNDS", `You've got ${usd(s.walletUsdc)} of USDC. That's not enough for ${usd(a.amountUsd)}.`);
      const now = total > 0 ? (s.holdings[a.ticker] / total) * 100 : 0;
      const pct = ((s.holdings[a.ticker] + a.amountUsd) / (total + a.amountUsd)) * 100;
      if (now >= r.maxPct - EPS)
        return refuse("OVER_MAX", `${name(a.ticker)}'s already at ${Math.round(now)}% and your max is ${r.maxPct}%. You set that rule, so I'm sticking to it. You can change it, like "change my max to ${Math.min(MAX_RANGE.max, r.maxPct + 5)}%".`);
      if (pct > r.maxPct + EPS) {
        const room = Math.max(0, (r.maxPct / 100) * total - s.holdings[a.ticker]) / (1 - r.maxPct / 100);
        return refuse("OVER_MAX", `That would put ${name(a.ticker)} at ${Math.round(pct)}%, over your ${r.maxPct}% max. The most I can add is about ${usd(room)}.`);
      }
      break;
    }
    case "add": {
      if (a.ticker in s.holdings) return refuse("ALREADY_HELD", `You already own ${name(a.ticker)}.`);
      if (!(a.pct > 0)) return refuse("INVALID_AMOUNT", "The share has to be more than 0%.");
      if (a.pct > r.maxPct + EPS) return refuse("OVER_MAX", `${a.pct}% is over your ${r.maxPct}% max.`);
      break;
    }
    case "sell": {
      const have = s.holdings[a.ticker];
      if (!have) return refuse("NOT_HELD", `You don't own any ${name(a.ticker)}.`);
      if (a.amountUsd > have + EPS) return refuse("NOT_ENOUGH_HELD", `You only have ${usd(have)} of ${name(a.ticker)}.`);
      break;
    }
    case "drop": {
      if (!(a.ticker in s.holdings)) return refuse("NOT_HELD", `You don't own any ${name(a.ticker)}, so there's nothing to drop.`);
      if (Object.keys(s.holdings).length <= 2) return refuse("TOO_CONCENTRATED", "That would leave you with one stock. Too risky for me. Add something else first?");
      break;
    }
    case "rebalance":
      break;
  }

  // DEX-priced stocks: keep each trade small next to the pool, and always ask.
  const dexTouched = touched.filter((t) => s.priceSource?.[t] === "dex");
  for (const t of dexTouched) {
    const size =
      a.type === "feed" ? a.amountUsd * (s.weights[t] ?? 0)
      : a.type === "buy" || a.type === "sell" ? a.amountUsd
      : a.type === "add" ? (a.pct / 100) * total
      : a.type === "drop" ? s.holdings[t] ?? 0
      : 0;
    const pool = s.poolLiquidityUsd?.[t] ?? 0;
    if (size > pool * MAX_POOL_SHARE + EPS)
      return refuse("TOO_BIG_FOR_POOL", `${name(t)} only trades in a small pool on Base (about ${usd(pool)}), so I keep each trade under ${usd(pool * MAX_POOL_SHARE)} to avoid a bad price.`);
  }
  if (dexTouched.length) notes.push(`${dexTouched.map(name).join(", ")} ${dexTouched.length > 1 ? "have" : "has"} no official price feed, so I'll check with you first.`);

  // Money above the user's threshold always needs an explicit yes. Sells and drops move money too.
  const amount =
    "amountUsd" in a ? a.amountUsd
    : a.type === "add" ? (a.pct / 100) * total
    : a.type === "drop" ? s.holdings[a.ticker] ?? 0
    : 0;
  const needsApproval = amount > r.askAboveUsd + EPS || a.type === "add" || a.type === "drop" || dexTouched.length > 0 || afterHours;
  return { ok: true, needsApproval, queueUntilOpen, afterHours, notes };
}
