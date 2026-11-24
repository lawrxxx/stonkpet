"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildPlan, cashOf, fit, leadOf, type Plan, type Weights } from "./plan";
import { ABOUT, nameOf } from "./stocks";
import type { PriceBoard } from "./server/prices";

/**
 * Client state for milestone 1 (mock data, no chain). Same shape as the demo's `st`
 * so the port stays faithful; later milestones move money-related fields to the
 * server (Supabase + chain reads) and keep this for UI-only state.
 */
export type Wx = "sun" | "rain" | "night";
export type Tok = "USDC" | "ETH" | "cbBTC";
export type Pers = "calm" | "balanced" | "spicy";
export type SheetKey =
  | "deposit" | "short" | "cashout" | "bio" | "receipt" | "basket" | "confirm"
  | "note" | "share" | "auto" | "mandate" | "activity" | "eligible" | "wallet";

export type LogEntry = { what: string; when: string; detail: string; tx: string | null; amount: number | null; time: string };

export type CardAction =
  | { type: "trim" }
  | { type: "feed"; amount: number }
  | { type: "sell"; ticker: string; amount: number }
  | { type: "add"; ticker: string }
  | { type: "drop"; ticker: string }
  | { type: "buyMore"; ticker: string }
  | { type: "setMax"; pct: number }
  | { type: "weekly"; amount: number };

export type Card = { title: string; body: string; yes: string; action: CardAction; noMsg?: string; status: "pending" | "yes" | "no" };
export type Msg = { id: string; from: "me" | "pet"; html: string; tag?: string; card?: Card; live?: boolean };

export const PERS: [Pers, string, string, number, number][] = [
  ["calm", "Calm", "Slow and steady wins", 25, 10],
  ["balanced", "Balanced", "Some ups, some downs", 30, 25],
  ["spicy", "Spicy", "Lives for the swings", 35, 50],
];

/** Sample month-to-date moves, mock mode only. */
export const CHG: Record<string, number> = { NVDA: 14.2, MSFT: 5.1, GOOGL: 6.8, META: -2.3, AAPL: 3.4, AMZN: 4.0, TSLA: 9.5, MSTR: -6.1, SNDK: 7.7 };

export const money = (v: number) => "$" + v.toFixed(2);
const uid = () => Math.random().toString(36).slice(2, 10);
const fakeTx = () => {
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return "0x" + h(8) + "…" + h(4);
};

type State = {
  ready: boolean;
  eligible: boolean;
  name: string;
  pers: Pers;
  cap: number;
  ask: number;
  brief: string;
  diet: string | null;
  skipCrypto: boolean;
  amt: number;
  tok: Tok;
  why: "facts" | "assume" | "opinion";
  trimmed: boolean | null; // null = the "trim NVIDIA?" card is still waiting
  /** Effective weather. Derived from live market data by the Shell unless the user is previewing. */
  wx: Wx;
  wxPreview: Wx | null;
  /** Latest price board (not persisted). */
  board: PriceBoard | null;
  total: number;
  wallet: Record<Tok, number>;
  paused: boolean;
  weekly: number;
  auto: { reb: boolean; weekly: boolean; tp: boolean };
  log: LogEntry[];
  plan: Plan | null;
  co: number;
  rc: number;
  msgs: Msg[];
  guess: string[] | null;
  ci: number;
  sheet: SheetKey | null;
  /** where to go after the eligibility check / passkey sign-in */
  next: "name" | "signin" | "approve" | "home" | null;
};

type Actions = {
  set: (p: Partial<State>) => void;
  ensurePlan: () => Plan;
  rebuild: () => void;
  approve: () => void;
  addLog: (what: string, detail: string, amount?: number | null) => void;
  runAction: (a: CardAction) => string;
  answer: (msgId: string, yes: boolean) => void;
  push: (m: Omit<Msg, "id">) => string;
  patchMsg: (id: string, p: Partial<Msg>) => void;
  doFeed: () => void;
  cashOut: () => number;
  open: (k: SheetKey) => void;
  close: () => void;
};

export type Store = State & Actions;

const initial: State = {
  ready: false, eligible: false, name: "Mochi", pers: "balanced", cap: 30, ask: 25,
  brief: "AI and robots. Skip Tesla.", diet: "ai", skipCrypto: false, amt: 20, tok: "USDC", why: "facts",
  trimmed: null, wx: "sun", wxPreview: null, board: null, total: 248.6, wallet: { USDC: 120, ETH: 340, cbBTC: 90 }, paused: false, weekly: 10,
  auto: { reb: true, weekly: true, tp: false }, log: [], plan: null, co: 25, rc: 0, msgs: [], guess: null, ci: 0, sheet: null, next: null,
};

/** Current holdings as fractions. Before the trim is answered, the lead sits 6 points over plan (the demo's scripted drift). */
export function held(s: Pick<State, "plan" | "trimmed">): Weights {
  const p = s.plan!;
  const o: Weights = {};
  if (s.trimmed) { for (const k in p.w) o[k] = p.w[k]; return o; }
  const inv = 1 - p.cash, others = inv - p.w[p.lead];
  for (const k in p.w) o[k] = k === p.lead ? p.w[k] + 0.06 : (p.w[k] * (others - 0.06)) / others;
  return o;
}

export const nm = (s: Pick<State, "name">) => s.name.trim() || "Mochi";

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const withPlan = (fn: (p: Plan) => void, extra: Partial<State> = {}) => {
        const p = structuredClone(get().plan!);
        fn(p);
        set({ plan: p, ...extra });
      };
      const setW = (w: Weights) =>
        withPlan((p) => { p.w = w; p.cash = cashOf(w); p.lead = leadOf(w); }, { trimmed: true });

      return {
        ...initial,
        set: (p) => set(p),
        ensurePlan: () => {
          const s = get();
          if (s.plan) return s.plan;
          const plan = buildPlan(s.brief, s.cap);
          set({ plan });
          return plan;
        },
        rebuild: () => { const s = get(); set({ plan: buildPlan(s.brief, s.cap) }); },
        approve: () => {
          const s = get();
          const p = s.plan!;
          const lead = nameOf(p.lead);
          const leadNow = Math.round((p.w[p.lead] + 0.06) * 100);
          set({
            log: [], trimmed: null,
            msgs: [
              { id: uid(), from: "pet", html: `${lead} has grown to ${leadNow}% of everything, and your max is ${s.cap}%.` },
              {
                id: uid(), from: "pet", html: "",
                card: { title: `Mind if I sell $14.92 of ${lead}?`, body: "Puts it back where we planned. The money goes into your other stocks.", yes: "Go for it", action: { type: "trim" }, status: "pending" },
              },
            ],
          });
          get().addLog("Made your plan", "You said it looked good.");
        },
        addLog: (what, detail, amount = null) => {
          const t = new Date();
          set((s) => ({ log: [{ what, when: "Today", detail, tx: fakeTx(), amount: amount || null, time: t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }, ...s.log] }));
        },
        push: (m) => { const id = uid(); set((s) => ({ msgs: [...s.msgs, { ...m, id }] })); return id; },
        patchMsg: (id, p) => set((s) => ({ msgs: s.msgs.map((m) => (m.id === id ? { ...m, ...p } : m)) })),
        runAction: (a) => {
          const s = get();
          const p = s.plan!;
          const h = held(s);
          const log = get().addLog;
          switch (a.type) {
            case "trim": {
              set({ trimmed: true });
              log("Sold a bit of " + nameOf(p.lead), `It got too big (over ${s.cap}%). Moved $14.92 into your other stocks.`);
              return `Done. ${nameOf(p.lead)}'s back in line.`;
            }
            case "feed": {
              const n = a.amount;
              if (n > s.wallet.USDC) return `You only have ${money(s.wallet.USDC)} of USDC. Add money from Portfolio first.`;
              set({ wallet: { ...s.wallet, USDC: s.wallet.USDC - n }, total: s.total + n });
              log("Bought " + Object.keys(p.w).length + " stocks", `You fed ${money(n)} from chat.`, n);
              return s.wx === "night" ? "Saved. I'll eat it when the market opens." : `Yum. ${money(n)} is now stocks.`;
            }
            case "sell": {
              const k = a.ticker;
              withPlan((q) => {
                q.w[k] = Math.max(0, h[k] - a.amount / s.total);
                for (const x in q.w) if (x !== k) q.w[x] = h[x];
                q.cash = cashOf(q.w);
              }, { trimmed: true });
              log("Sold some " + nameOf(k), `You asked in chat. ${money(a.amount)} went back to USDC.`);
              return `Sold. ${money(a.amount)} is back in your USDC.`;
            }
            case "add": {
              const k = a.ticker;
              const raw = { ...p.w };
              for (const x in raw) raw[x] *= 0.9;
              raw[k] = 0.1;
              withPlan((q) => { q.excl = q.excl.filter((x) => x !== k); });
              setW(fit(raw, s.cap));
              log("Added " + nameOf(k), "You asked in chat. Took a little from the rest.");
              return `${nameOf(k)}'s in. ${ABOUT[k] ?? ""}`.trim();
            }
            case "drop": {
              const k = a.ticker;
              const raw = { ...p.w };
              delete raw[k];
              withPlan((q) => { q.excl.push(k); });
              setW(fit(raw, s.cap));
              log("Dropped " + nameOf(k), "You asked in chat.");
              return `${nameOf(k)}'s gone. The money's spread across your other stocks.`;
            }
            case "buyMore": {
              const raw = { ...p.w };
              raw[a.ticker] = s.cap / 100;
              setW(raw);
              log("Bought more " + nameOf(a.ticker), "You asked in chat.");
              return `Done. ${nameOf(a.ticker)} is at your max now.`;
            }
            case "setMax": {
              set({ cap: a.pct });
              setW(fit(p.w, a.pct));
              log("Changed your max", `From your chat: max is now ${a.pct}%.`);
              const cash = get().plan!.cash;
              return `Done. Your max is ${a.pct}% now.${cash > 0.005 ? ` ${Math.round(cash * 100)}% sits in USDC because there isn't room for it.` : " Everything fits."}`;
            }
            case "weekly": {
              set({ auto: { ...s.auto, weekly: true }, weekly: a.amount });
              log("Set a weekly feed", `$${a.amount} every Friday.`);
              return `Done. $${a.amount} every Friday. I'll tell you if we fall behind.`;
            }
          }
        },
        answer: (id, yes) => {
          const m = get().msgs.find((x) => x.id === id);
          if (!m?.card || m.card.status !== "pending") return;
          get().patchMsg(id, { card: { ...m.card, status: yes ? "yes" : "no" } });
          const a = m.card.action;
          if (a.type === "trim" && !yes) set({ trimmed: false });
          setTimeout(() => {
            const text = yes
              ? get().runAction(a)
              : a.type === "trim"
                ? `Cool, I'll wait. I won't buy any more ${nameOf(get().plan!.lead)} while it's over your max, though.`
                : m.card!.noMsg || "No problem. Nothing changed.";
            get().push({ from: "pet", html: text });
          }, 300);
        },
        doFeed: () => {
          const s = get();
          const n = Object.keys(s.plan!.w).length;
          set({ sheet: null, wallet: { ...s.wallet, [s.tok]: s.wallet[s.tok] - s.amt }, total: s.total + s.amt });
          const night = s.wx === "night";
          get().addLog(
            night ? "Saved a feed" : "Bought " + n + " stocks",
            `You fed $${s.amt} of ${s.tok}${s.tok !== "USDC" ? ". Swapped it for stocks on Base and" : ","} split it the way we planned.${night ? " Buying in the morning." : ""}`,
            s.amt,
          );
        },
        cashOut: () => {
          const s = get();
          const f = s.co / 100, amt = +(s.total * f).toFixed(2);
          set({ total: +(s.total - amt).toFixed(2), wallet: { ...s.wallet, USDC: s.wallet.USDC + amt } });
          get().addLog(
            f === 1 ? "Cashed out everything" : "Cashed out " + Math.round(f * 100) + "%",
            `Sold ${money(amt)} of stocks back to USDC. You confirmed with your fingerprint.${s.wx === "night" ? " Goes through when the market opens." : ""}`,
            amt,
          );
          return amt;
        },
        open: (k) => set({ sheet: k }),
        close: () => set({ sheet: null }),
      };
    },
    {
      name: "stonkpet-mock",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sheet, ready, next, board, wx, wxPreview, ...rest }) => rest,
      skipHydration: true,
    },
  ),
);
