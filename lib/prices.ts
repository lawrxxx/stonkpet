"use client";
import { useQuery } from "@tanstack/react-query";
import type { Price, PriceBoard } from "./server/prices";
import type { Weights } from "./plan";
import type { Wx } from "./store";

export type { Price, PriceBoard };

/** Live prices + market state from /api/prices (Chainlink on Base mainnet). Shared cache, refreshed every minute. */
export function usePriceBoard() {
  return useQuery<PriceBoard>({
    queryKey: ["prices"],
    queryFn: async () => {
      const r = await fetch("/api/prices");
      if (!r.ok) throw new Error("prices " + r.status);
      return r.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export const priceOf = (b: PriceBoard | null | undefined, ticker: string) => b?.prices.find((p) => p.ticker === ticker) ?? null;

/** Plan-weighted move today, from real feed prices. null if no data for any holding. */
export function planDayChange(b: PriceBoard | null | undefined, w: Weights): number | null {
  if (!b) return null;
  let sum = 0, wsum = 0;
  for (const k in w) {
    const p = priceOf(b, k);
    if (p?.dayChangePct == null) continue;
    sum += w[k] * p.dayChangePct;
    wsum += w[k];
  }
  return wsum > 0 ? sum / wsum : null;
}

/** The weather is the market: night when closed, rain on a down day, sun otherwise. */
export function marketWeather(b: PriceBoard | null | undefined, w: Weights | undefined): Wx | null {
  if (!b) return null;
  if (!b.market.open) return "night";
  const d = w ? planDayChange(b, w) : null;
  return d !== null && d < 0 ? "rain" : "sun";
}

export const pct = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";

/** "2:14pm" in the viewer's time zone. */
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** When the market next opens, in plain words. */
export function opensWhen(b: PriceBoard): string {
  const t = new Date(b.market.next);
  const sameDay = t.toDateString() === new Date().toDateString();
  return (sameDay ? "today" : t.toLocaleDateString([], { weekday: "long" })) + " at " + clock(b.market.next);
}
