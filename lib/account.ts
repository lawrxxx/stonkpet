"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { useConfig, type Config } from "wagmi";
import { getCallsStatus } from "wagmi/actions";
import { useStore } from "./store";
import { useSponsoredCalls, useWallet } from "./wallet";

/** Server session (set by Sign-In with Ethereum). null address = signed out. */
export function useSession() {
  return useQuery<{ address: string | null }>({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/auth/me", { cache: "no-store" })).json(),
    staleTime: 60_000,
  });
}

export type RealHolding = { ticker: string; token: string; units: number; priceUsd: number | null; valueUsd: number | null; source: "chainlink" | "dex" | null };
export type Receipt = { id: string; title: string; detail: string | null; amount_usd: number | null; tx_hash: string | null; created_at: string; explorer: string | null };
export type RealPortfolio = { tradingLive: boolean; holdings: RealHolding[]; stocksUsd: number; walletUsdc: number | null; activity: Receipt[]; tradeAfterHours: boolean };

/** Real holdings and receipts for the signed-in wallet. Disabled (data undefined) when signed out. */
export function useRealPortfolio() {
  const w = useWallet();
  const s = useSession();
  const signedIn = w.connected && !!s.data?.address && s.data.address === w.address?.toLowerCase();
  const q = useQuery<RealPortfolio>({
    queryKey: ["portfolio", w.address],
    enabled: signedIn,
    queryFn: async () => {
      const r = await fetch("/api/portfolio", { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? "portfolio " + r.status);
      return r.json();
    },
    refetchInterval: 30_000,
  });
  return { ...q, signedIn };
}

/** Save the approved plan to the database (no-op when signed out). */
export async function savePlan(): Promise<boolean> {
  const s = useStore.getState();
  const p = s.plan;
  if (!p) return false;
  const r = p.research;
  const send = () => fetch("/api/plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brief: p.brief || s.brief,
      pet: { name: s.name.trim() || "Mochi", personality: s.pers },
      rules: { maxPct: s.cap, askAboveUsd: s.ask, excluded: p.excl },
      plan: {
        theme: p.theme, weights: p.w, cash: p.cash, lead: p.lead, priceSource: r?.priceSource ?? {},
        flags: r?.flags ?? [], facts: r?.facts ?? [], assumptions: r?.assumptions ?? [], opinions: r?.opinions ?? [], reasons: r?.reasons ?? {}, model: r?.model ?? null,
      },
    }),
  }).catch(() => null);
  // Right after sign-in the session cookie can land a moment after the wallet connects.
  for (let i = 0; i < 4; i++) {
    const res = await send();
    if (res?.ok) return true;
    if (res && res.status !== 401) return false;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export type FeedStep = "idle" | "checking" | "confirm" | "pricing" | "signing" | "settling" | "done" | "queued" | "refused" | "error";
export type FeedState = { step: FeedStep; message?: string; txHash?: Hex; legs?: { ticker: string; usd: number; price: number }[]; actionId?: string; notes?: string[] };

/**
 * A real feed, end to end:
 *  1. propose → server runs the rules on onchain balances and live prices
 *  2. if it needs a yes, wait for the user (step "confirm")
 *  3. approve → server re-checks, copies live prices to the exchange, returns the calls
 *  4. passkey → gas-free batch with the Builder Code
 *  5. confirm → server verifies the purchase onchain; only then "done"
 */
export function useFeed() {
  const [state, setState] = useState<FeedState>({ step: "idle" });
  const tx = useSponsoredCalls();
  const qc = useQueryClient();
  const config = useConfig();

  const approve = useCallback(async (actionId: string) => {
    setState((s) => ({ ...s, step: "pricing" }));
    const a = await (await fetch(`/api/actions/${actionId}/approve`, { method: "POST" })).json();
    if (!a.ok) return setState({ step: a.queued ? "queued" : "refused", message: a.reason, notes: a.notes, actionId });
    if (a.queued) return setState({ step: "queued", notes: a.notes, actionId });
    setState((s) => ({ ...s, step: "signing", legs: a.legs }));
    let callsId: string;
    try {
      callsId = (await tx.sendCalls(a.calls.map((c: { to: `0x${string}`; data: Hex }) => ({ to: c.to, data: c.data })))).id;
    } catch (e) {
      await fetch(`/api/actions/${actionId}/reject`, { method: "POST" });
      const msg = (e as Error)?.message ?? "";
      return setState({ step: "error", message: /reject|denied|cancel/i.test(msg) ? "No worries, nothing was sent." : "Your wallet couldn't send that. Nothing was bought.", actionId });
    }
    setState((s) => ({ ...s, step: "settling" }));
    const txHash = await waitForTxHash(config, callsId);
    if (!txHash) return setState({ step: "error", message: "I couldn't confirm that on Base yet. Check your activity in a minute.", actionId });
    const c = await (await fetch(`/api/actions/${actionId}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash }) })).json();
    if (!c.ok) return setState({ step: "error", message: c.reason ?? "That didn't go through.", txHash, actionId });
    await qc.invalidateQueries({ queryKey: ["portfolio"] });
    setState((s) => ({ ...s, step: "done", txHash }));
  }, [tx, qc, config]);

  const start = useCallback(async (amountUsd: number) => {
    setState({ step: "checking" });
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "feed", amountUsd }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setState({ step: "error", message: j.message ?? "Something went wrong." });
    if (!j.ok) return setState({ step: "refused", message: j.reason, actionId: j.id });
    if (j.queueUntilOpen) return setState({ step: "queued", notes: j.notes, actionId: j.id });
    if (j.needsApproval) return setState({ step: "confirm", actionId: j.id, notes: j.notes });
    await approve(j.id);
  }, [approve]);

  const decline = useCallback(async () => {
    if (state.actionId) await fetch(`/api/actions/${state.actionId}/reject`, { method: "POST" });
    setState({ step: "idle" });
  }, [state.actionId]);

  return { state, start, approve: () => state.actionId && approve(state.actionId), decline, reset: () => setState({ step: "idle" }) };
}

/** Poll the wallet for the bundle's transaction hash (EIP-5792 wallet_getCallsStatus). */
async function waitForTxHash(config: Config, callsId: string): Promise<Hex | null> {
  for (let i = 0; i < 60; i++) {
    try {
      const st = await getCallsStatus(config, { id: callsId });
      const h = st.receipts?.[0]?.transactionHash;
      if (st.status === "success" && h) return h;
      if (st.status === "failure") return null;
    } catch { /* not indexed yet */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}
