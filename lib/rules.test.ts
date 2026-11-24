import { describe, expect, it } from "vitest";
import { check, type Action, type Snapshot } from "./rules";

const base = (): Snapshot => ({
  rules: { maxPct: 30, askAboveUsd: 25, excluded: ["TSLA"], paused: false },
  // $300 portfolio: NVDA 30%, MSFT 25%, GOOGL 25%, META 20%
  holdings: { NVDA: 90, MSFT: 75, GOOGL: 75, META: 60 },
  planCashUsd: 0,
  weights: { NVDA: 0.3, MSFT: 0.25, GOOGL: 0.25, META: 0.2 },
  walletUsdc: 120,
  feeds: { NVDA: "live", MSFT: "live", GOOGL: "live", META: "live", TSLA: "live", AAPL: "live" },
  listed: new Set(["NVDA", "MSFT", "GOOGL", "META", "TSLA", "AAPL", "NFLX"]),
  tradable: new Set(["NVDA", "MSFT", "GOOGL", "META", "TSLA", "AAPL"]),
  names: { NVDA: "NVIDIA", TSLA: "Tesla", NFLX: "Netflix" },
});
const with_ = (p: (s: Snapshot) => void) => { const s = base(); p(s); return s; };
const refused = (a: Action, s: Snapshot) => {
  const v = check(a, s);
  if (v.ok) throw new Error("expected a refusal, got ok");
  return v;
};

describe("max % per company", () => {
  it("refuses buying more of a stock already at the max (the NVIDIA demo)", () => {
    const v = refused({ type: "buy", ticker: "NVDA", amountUsd: 10 }, base());
    expect(v.code).toBe("OVER_MAX");
    expect(v.reason).toMatch(/already at 30%.*max is 30%/);
  });
  it("refuses a buy that would push a stock over the max and says how much fits", () => {
    const s = with_((s) => { s.holdings.MSFT = 60; s.holdings.META = 75; }); // MSFT 20%
    const v = refused({ type: "buy", ticker: "MSFT", amountUsd: 50 }, s);
    expect(v.code).toBe("OVER_MAX");
    expect(v.reason).toMatch(/most I can add is about \$42\.86/);
  });
  it("allows a buy that stays under the max", () => {
    const s = with_((s) => { s.holdings.MSFT = 60; s.holdings.META = 75; });
    expect(check({ type: "buy", ticker: "MSFT", amountUsd: 20 }, s).ok).toBe(true);
  });
  it("refuses a feed whose split would push a holding over the max", () => {
    const s = with_((s) => { s.holdings.NVDA = 100; s.weights = { NVDA: 1 }; });
    expect(refused({ type: "feed", amountUsd: 50 }, s).code).toBe("OVER_MAX");
  });
  it("refuses adding a stock at more than the max", () => {
    expect(refused({ type: "add", ticker: "AAPL", pct: 40 }, base()).code).toBe("OVER_MAX");
  });
});

describe("excluded stocks", () => {
  it("never buys an excluded stock", () => {
    const v = refused({ type: "add", ticker: "TSLA", pct: 10 }, base());
    expect(v.code).toBe("EXCLUDED");
    expect(v.reason).toMatch(/never to buy Tesla/);
  });
  it("blocks a feed that would buy an excluded stock", () => {
    const s = with_((s) => { s.weights = { NVDA: 0.5, TSLA: 0.5 }; });
    expect(refused({ type: "feed", amountUsd: 10 }, s).code).toBe("EXCLUDED");
  });
  it("still lets you sell an excluded stock you hold", () => {
    const s = with_((s) => { s.holdings.TSLA = 20; });
    expect(check({ type: "sell", ticker: "TSLA", amountUsd: 10 }, s).ok).toBe(true);
  });
});

describe("trading paused", () => {
  it("refuses every trade while paused", () => {
    const s = with_((s) => { s.rules.paused = true; });
    for (const a of [
      { type: "feed", amountUsd: 10 }, { type: "sell", ticker: "MSFT", amountUsd: 5 },
      { type: "buy", ticker: "MSFT", amountUsd: 5 }, { type: "rebalance" },
    ] as Action[]) expect(refused(a, s).code).toBe("PAUSED");
  });
  it("still allows changing settings while paused", () => {
    const s = with_((s) => { s.rules.paused = true; });
    expect(check({ type: "setMax", pct: 35 }, s).ok).toBe(true);
  });
});

describe("market closed and frozen feeds", () => {
  it("refuses a sell when the market is closed", () => {
    const s = with_((s) => { s.feeds.MSFT = "closed"; });
    expect(refused({ type: "sell", ticker: "MSFT", amountUsd: 5 }, s).code).toBe("MARKET_CLOSED");
  });
  it("queues a feed until the open instead of settling on a closed price", () => {
    const s = with_((s) => { for (const k in s.feeds) s.feeds[k] = "closed"; });
    const v = check({ type: "feed", amountUsd: 10 }, s);
    expect(v.ok && v.queueUntilOpen).toBe(true);
  });
  it("never trades on a frozen feed, even a feed", () => {
    const s = with_((s) => { s.feeds.NVDA = "stale"; });
    expect(refused({ type: "feed", amountUsd: 10 }, s).code).toBe("PRICE_FROZEN");
    expect(refused({ type: "sell", ticker: "NVDA", amountUsd: 5 }, s).code).toBe("PRICE_FROZEN");
  });
  it("treats paused or missing feeds as frozen", () => {
    expect(refused({ type: "sell", ticker: "MSFT", amountUsd: 5 }, with_((s) => { s.feeds.MSFT = "paused"; })).code).toBe("PRICE_FROZEN");
    expect(refused({ type: "sell", ticker: "MSFT", amountUsd: 5 }, with_((s) => { delete s.feeds.MSFT; })).code).toBe("PRICE_FROZEN");
  });
});

describe("ask-me threshold", () => {
  it("allows amounts at or under the threshold without approval", () => {
    const v = check({ type: "feed", amountUsd: 25 }, base());
    expect(v.ok && v.needsApproval).toBe(false);
  });
  it("requires explicit approval above the threshold", () => {
    const v = check({ type: "feed", amountUsd: 26 }, base());
    expect(v.ok && v.needsApproval).toBe(true);
  });
  it("always asks before adding or dropping a stock, and before changing settings", () => {
    for (const a of [{ type: "add", ticker: "AAPL", pct: 10 }, { type: "drop", ticker: "META" }, { type: "setMax", pct: 35 }, { type: "setWeeklyFeed", amountUsd: 5 }] as Action[]) {
      const v = check(a, base());
      expect(v.ok && v.needsApproval).toBe(true);
    }
  });
});

describe("wallet balance", () => {
  it("refuses spending more USDC than the wallet holds", () => {
    const v = refused({ type: "feed", amountUsd: 121 }, base());
    expect(v.code).toBe("INSUFFICIENT_FUNDS");
    expect(v.reason).toMatch(/\$120\.00/);
  });
  it("refuses to spend when the balance can't be read", () => {
    expect(refused({ type: "feed", amountUsd: 5 }, with_((s) => { s.walletUsdc = null; })).code).toBe("BALANCE_UNKNOWN");
  });
  it("refuses selling more than you hold", () => {
    expect(refused({ type: "sell", ticker: "META", amountUsd: 61 }, base()).code).toBe("NOT_ENOUGH_HELD");
  });
});

describe("stock exists on Base", () => {
  it("refuses a stock that isn't listed", () => {
    expect(refused({ type: "add", ticker: "SPOT", pct: 10 }, base()).code).toBe("NOT_LISTED");
  });
  it("refuses a listed stock with no price feed", () => {
    const v = refused({ type: "add", ticker: "NFLX", pct: 10 }, base());
    expect(v.code).toBe("NO_PRICE_FEED");
    expect(v.reason).toMatch(/Netflix is listed on Base/);
  });
});

describe("other guards", () => {
  it("rejects zero or negative amounts", () => {
    expect(refused({ type: "feed", amountUsd: 0 }, base()).code).toBe("INVALID_AMOUNT");
    expect(refused({ type: "sell", ticker: "MSFT", amountUsd: -5 }, base()).code).toBe("INVALID_AMOUNT");
  });
  it("keeps the max between 10% and 60%", () => {
    expect(refused({ type: "setMax", pct: 5 }, base()).code).toBe("OUT_OF_RANGE");
    expect(refused({ type: "setMax", pct: 75 }, base()).code).toBe("OUT_OF_RANGE");
  });
  it("won't drop down to a single stock", () => {
    const s = with_((s) => { s.holdings = { NVDA: 50, MSFT: 50 }; });
    expect(refused({ type: "drop", ticker: "MSFT" }, s).code).toBe("TOO_CONCENTRATED");
  });
  it("won't add a stock you already hold, or buy one you don't", () => {
    expect(refused({ type: "add", ticker: "NVDA", pct: 10 }, base()).code).toBe("ALREADY_HELD");
    expect(refused({ type: "buy", ticker: "AAPL", amountUsd: 5 }, base()).code).toBe("NOT_HELD");
  });
});
