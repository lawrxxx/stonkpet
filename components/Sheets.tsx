"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DIETS } from "@/lib/plan";
import { clock, opensWhen, pct, planDayChange, priceOf } from "@/lib/prices";
import { money, nm, useStore, type SheetKey } from "@/lib/store";
import { nameOf } from "@/lib/stocks";
import { useWallet } from "@/lib/wallet";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { Pet } from "./Pet";
import { useGo } from "./nav";
import { Deposit, SignIn } from "./WalletSheets";

const SAMPLE_ADDR = "0x7a3F…9C1e";
const SAMPLE_ADDR_FULL = "0x7a3F000000000000000000000000000000009C1e";
/** Sheets whose main action lives in the body: closing them means "Cancel", not "Done". */
const HAS_ACTION: SheetKey[] = ["confirm", "cashout", "short", "bio", "eligible", "wallet"];

/** Sheet title + optional one-line subtitle. */
function Head({ title, sub }: { title: string; sub?: ReactNode }) {
  return (<><h2 id="sheetT">{title}</h2>{sub && <p className="t-small muted">{sub}</p>}</>);
}

/** Label on the left, value on the right. */
function KV({ k, v, cls }: { k: string; v: ReactNode; cls?: string }) {
  return <div className="row"><span className="grow">{k}</span><span className={cls ?? "strong"}>{v}</span></div>;
}

function Switch({ id, on, label, onToggle }: { id: string; on: boolean; label: string; onToggle: () => void }) {
  return (
    <div className="row">
      <span className="grow" id={id + "L"}>{label}</span>
      <button className="sw" role="switch" aria-checked={on} aria-labelledby={id + "L"} onClick={onToggle}><span /></button>
    </div>
  );
}

function Body({ k, onSettled }: { k: SheetKey; onSettled: () => void }) {
  const s = useStore();
  const go = useGo();
  const wallet = useWallet();
  const name = nm(s);
  const p = s.plan;
  const [added, setAdded] = useState(false);
  const [bioDone, setBioDone] = useState<number | null>(null);

  useEffect(() => {
    if (k !== "bio") return;
    setBioDone(null);
    const t = setTimeout(() => { setBioDone(useStore.getState().cashOut()); onSettled(); }, 1300);
    return () => clearTimeout(t);
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps

  switch (k) {
    case "eligible":
      return <Eligible />;
    case "wallet":
      return <SignIn />;

    case "deposit":
      if (wallet.connected) return <Deposit />;
      return (<>
        <Head title="Add money" sub={`Send crypto to your ${name} wallet, then feed it.`} />
        <div className="list mt-4">
          <div className="row blk">
            <p className="t-small muted">Your wallet on Base</p>
            <div className="between mt-1" style={{ alignItems: "center" }}>
              <span className="num t-heading">{SAMPLE_ADDR}</span><CopyButton text={SAMPLE_ADDR_FULL} />
            </div>
            <span className="src">Sample address for this demo</span>
          </div>
          <KV k="Accepts" v="USDC · ETH · cbBTC" />
          <KV k="Buy with card" v="Coming soon" cls="t-small muted" />
        </div>
        <div className="note mt-3"><b>Only send on Base</b>Sending on another network can lose your money.</div>
        <p className="t-small muted mt-4">Wallet: {(["USDC", "ETH", "cbBTC"] as const).map((x) => x + " " + money(s.wallet[x])).join(" · ")}</p>
        <button className="btn mt-3" disabled={added}
          onClick={() => { s.set({ wallet: { ...s.wallet, USDC: s.wallet.USDC + 50 } }); s.addLog("Added money", "$50 USDC arrived in your wallet on Base.", 50); setAdded(true); }}>
          {added ? <><Icon name="check" />$50 added</> : "Add $50 test USDC (demo)"}
        </button>
      </>);

    case "short":
      return (<>
        <Head title={`Not enough ${s.tok}`} />
        <p className="muted mt-1">You&apos;ve got {money(s.wallet[s.tok])} of {s.tok}. Add money, or feed a smaller amount.</p>
        <button className="btn mt-5" onClick={() => s.open("deposit")}>Add money</button>
      </>);

    case "cashout":
      return (<>
        <Head title="Cash out" sub={`${name} sells stocks back to USDC in your wallet.`} />
        <div className="list pad mt-4">
          <p className="t-small muted" id="coL">How much?</p>
          <div className="pick mt-2" role="radiogroup" aria-labelledby="coL">
            {[25, 50, 100].map((f) => <button key={f} role="radio" aria-checked={f === s.co} onClick={() => s.set({ co: f })}>{f === 100 ? "All" : f + "%"}</button>)}
          </div>
          <div className="between mt-4" style={{ alignItems: "center" }}><span>You get</span><span className="num t-heading">{money((s.total * s.co) / 100)}</span></div>
          <span className="src">In USDC, in your wallet. Network fee covered.</span>
        </div>
        {s.wx === "night" && <div className="note mt-3"><b>Market&apos;s closed</b>Your sale goes through when the market opens.</div>}
        <button className="btn mt-4" onClick={() => s.open("bio")}>Confirm with fingerprint</button>
      </>);

    case "bio":
      return (
        <div className="center stack" style={{ alignItems: "center" }}>
          <h2 id="sheetT">Confirm it&apos;s you</h2>
          <svg className="mt-4" width="88" height="88" viewBox="0 0 24 24" fill="none" stroke={bioDone !== null ? "var(--leaf)" : "var(--accent)"} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 11v2.5c0 2.5-.8 4.6-2.2 6.3M8.5 7.6A5 5 0 0 1 17 11v1.5c0 1.6-.2 3.2-.7 4.6M7 11a5 5 0 0 1 .3-1.7M7 14c0 1.6-.4 3-1.1 4.2M14.5 11a2.5 2.5 0 0 0-5 0v1c0 2.3-.6 4.5-1.7 6.3M14.5 14.3c-.2 1.9-.8 3.6-1.7 5.2M4.5 12a7.5 7.5 0 0 1 12.8-5.3M19.5 12c0 1-.1 2-.3 3" />
          </svg>
          <div className="t-small muted mt-4" aria-live="polite">
            {bioDone === null
              ? <>Touch the sensor… <span className="t-caption">(simulated)</span></>
              : <><p className="up row-x gap-1" style={{ justifyContent: "center", fontSize: 18 }}><Icon name="check" stroke={2.6} />Done</p><p className="mt-1">{money(bioDone)} is in your USDC.</p></>}
          </div>
        </div>
      );

    case "receipt": {
      const r = s.log[s.rc];
      if (!r) return <Head title="Receipt" />;
      return (<>
        <Head title="Receipt" />
        <div className="list mt-3">
          <KV k="What" v={r.what} />
          {r.amount ? <KV k="Amount" v={money(r.amount)} /> : null}
          <KV k="When" v={`Today, ${r.time}`} cls="" />
          <KV k="Network" v="Base" cls="" />
          <KV k="Status" v="Confirmed" cls="up" />
          <div className="row blk">
            <div className="between"><span>Transaction</span><span className="t-small" style={{ fontFamily: "ui-monospace, monospace" }}>{r.tx}</span></div>
            <span className="src" style={{ textAlign: "right" }}>Sample ID: this demo makes no real transactions</span>
          </div>
        </div>
        <p className="t-small muted mt-3">{r.detail}</p>
      </>);
    }

    case "basket":
      return (<>
        <Head title={`What ${name} will eat`} sub="Split the way you agreed" />
        <div className="list mt-4">
          {p && Object.keys(p.w).map((x) => <KV key={x} k={nameOf(x)} v={<span className="num">${(s.amt * p.w[x]).toFixed(2)}</span>} />)}
          {p && p.cash > 0.005 && <KV k="Stays in USDC" v={<span className="num">${(s.amt * p.cash).toFixed(2)}</span>} />}
        </div>
      </>);

    case "confirm":
      return (<>
        <Head title="Quick check" />
        <p className="muted mt-1">That&apos;s more than the ${s.ask} you said to check on. Still good?</p>
        <button className="btn mt-5" onClick={() => { s.doFeed(); window.dispatchEvent(new Event("stonkpet:fed")); }}>Yes, feed ${s.amt}</button>
      </>);

    case "note":
      return (<>
        <Head title="This morning" sub={`From ${name}, 7:30am`} />
        <div className="list mt-4">
          <NoteMood />
          <div className="row blk">
            <span className="tag">Your rules</span>
            <p className="mt-1">{p && nameOf(p.lead)} grew past your {s.cap}% max. {s.trimmed ? "You okayed a trim, so we're back in line." : "I asked about selling a bit."}</p>
            <LeadPrice ticker={p?.lead} />
          </div>
          <NoteMovers />
        </div>
        <button className="btn secondary mt-4" onClick={() => go("chat")}>Open chat</button>
      </>);

    case "share": {
      const d = p ? planDayChange(s.board, p.w) : null;
      return (<>
        <Head title={`Share ${name}`} />
        <div className="share mt-3">
          <div className="petwrap"><Pet mood="happy" size={104} /></div>
          <p className="num t-heading mt-2">{d === null ? name : `${name} is ${pct(d)} today`}</p>
          <p className="t-small muted mt-1">Level 3 · {p ? DIETS[p.diet].label : ""} diet</p>
          <p className="t-caption muted mt-4">stonkpet · built on Base</p>
        </div>
        <p className="t-small muted center mt-3">Only shows %, never how much you have.</p>
        <CopyButton className="btn mt-3" label="Copy link" text={`https://stonkpet.app/p/${encodeURIComponent(name.toLowerCase())}`} />
      </>);
    }

    case "auto":
      return (<>
        <Head title="Autopilot" sub={`Things ${name} handles on its own. Always inside your rules.`} />
        <div className="list mt-4">
          <Switch id="reb" on={s.auto.reb} label="Fix the mix when one stock gets too big" onToggle={() => s.set({ auto: { ...s.auto, reb: !s.auto.reb } })} />
          <Switch id="weekly" on={s.auto.weekly} label={`Feed $${s.weekly} every Friday`} onToggle={() => s.set({ auto: { ...s.auto, weekly: !s.auto.weekly } })} />
          <Switch id="tp" on={s.auto.tp} label="When ETH is up 20%, move 10% of the gain into stocks" onToggle={() => s.set({ auto: { ...s.auto, tp: !s.auto.tp } })} />
        </div>
        <p className="t-small muted mt-4">Goal: $1,000 by June. {name} will nudge you if you fall behind.</p>
      </>);

    case "mandate":
      return (<>
        <Head title="What you asked for" sub={`${name} only acts inside these.`} />
        <div className="list mt-4">
          <div className="row blk"><p className="t-small muted">In your words</p><p className="mt-1">{p?.brief}</p></div>
          <KV k="Most in one company" v={`${s.cap}%`} />
          <KV k="Check with me above" v={`$${s.ask}`} />
          <KV k="Never buy" v={p?.excl.length ? p.excl.map(nameOf).join(", ") : "Nothing"} />
        </div>
        <button className="btn secondary mt-4" onClick={() => go("brief")}>Change it</button>
      </>);

    case "activity":
      return (<>
        <Head title={`What ${name}'s been up to`} />
        <div className="list mt-4">
          {s.log.length === 0 && (
            <div className="row blk"><p className="strong">Quiet so far</p><p className="t-small muted mt-1">Say yes to a plan and I&apos;ll get going.</p></div>
          )}
          {s.log.map((a, i) => (
            <button className="row blk" key={i} onClick={() => { s.set({ rc: i }); s.open("receipt"); }}>
              <div className="between"><span className="strong">{a.what}</span><span className="t-caption muted row-x gap-1">{a.when}{a.tx && <> · Receipt <Icon name="chevron" size={12} /></>}</span></div>
              <p className="t-small muted mt-1">{a.detail}</p>
            </button>
          ))}
        </div>
      </>);
  }
}

/** Mood from the real plan-weighted move. No number if we don't have one. */
function NoteMood() {
  const b = useStore((s) => s.board);
  const plan = useStore((s) => s.plan);
  const d = plan ? planDayChange(b, plan.w) : null;
  const when = b && !b.market.open ? "last session" : "today";
  const text = d === null ? "Couldn't get live prices just now, so no mood report." : d >= 0 ? `Pretty good. Your stocks are ${pct(d)} ${when}.` : `A bit gloomy. Your stocks are ${pct(d)} ${when}. Holding steady.`;
  return (
    <div className="row blk">
      <span className="tag">Mood</span>
      <p className="mt-1">{text}</p>
      {d !== null && <span className="src">Source: Chainlink price feeds on Base</span>}
    </div>
  );
}

/** Biggest real mover across every stock on Base with a price feed. */
function NoteMovers() {
  const b = useStore((s) => s.board);
  const moved = (b?.prices ?? []).filter((x) => x.dayChangePct !== null).sort((x, y) => Math.abs(y.dayChangePct!) - Math.abs(x.dayChangePct!));
  if (!b || !moved.length) return null;
  const top = moved[0];
  return (
    <div className="row blk">
      <span className="tag">Keeping an eye on</span>
      <p className="mt-1">Biggest mover on Base {b.market.open ? "today" : "last session"}: {nameOf(top.ticker)}, {pct(top.dayChangePct!)}.{b.market.open ? "" : ` Market opens ${opensWhen(b)}.`}</p>
      <span className="src">Source: Chainlink price feeds on Base</span>
    </div>
  );
}

/** Real price line for the note, with its source and time. Says nothing rather than inventing one. */
function LeadPrice({ ticker }: { ticker?: string }) {
  const b = useStore((s) => s.board);
  const q = ticker ? priceOf(b, ticker) : null;
  if (!ticker || !q || q.price === null || !q.updatedAt) return <span className="src">Live price unavailable right now.</span>;
  return (
    <span className="src">
      {nameOf(ticker)} is ${q.price.toFixed(2)}{q.dayChangePct !== null ? `, ${pct(q.dayChangePct)} today` : ""}. Source: Chainlink price feed on Base, {clock(q.updatedAt)}
    </span>
  );
}

/** 18+ and region check. Coinbase tokenized stocks are only for eligible people outside the US. */
function Eligible() {
  const [age, setAge] = useState(false);
  const [region, setRegion] = useState(false);
  const go = useGo();
  return (<>
    <Head title="Quick check first" sub="Tokenized stocks on Base are only for adults outside the US." />
    <div className="list mt-4">
      <label className="row chk"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /><span>I&apos;m 18 or older</span></label>
      <label className="row chk"><input type="checkbox" checked={region} onChange={(e) => setRegion(e.target.checked)} /><span>I don&apos;t live in the US, and I&apos;m in a country where Coinbase tokenized stocks are allowed</span></label>
    </div>
    <button className="btn mt-4" disabled={!age || !region}
      onClick={() => {
        const next = useStore.getState().next;
        useStore.setState({ eligible: true });
        if (next === "home") useStore.getState().open("wallet");
        else go("name");
      }}>
      Continue
    </button>
  </>);
}

export function Sheets() {
  const sheet = useStore((s) => s.sheet);
  const close = useStore((s) => s.close);
  const [shown, setShown] = useState<SheetKey | null>(null);
  const [opens, setOpens] = useState(0);
  const [settled, setSettled] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (sheet) { setShown(sheet); setSettled(false); setOpens((n) => n + 1); requestAnimationFrame(() => closeRef.current?.focus()); }
  }, [sheet]);
  const k = sheet ?? shown;
  const cancel = !!k && HAS_ACTION.includes(k) && !settled;
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT" aria-hidden={!sheet} inert={!sheet}
      onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
      <div className="grab" />
      {k && <Body key={k + opens} k={k} onSettled={() => setSettled(true)} />}
      <div className="sheet-actions">
        {/* Always quiet, so the sheet's own action is the one that leads. */}
        <button className="btn ghost" ref={closeRef} onClick={close}>{cancel ? "Cancel" : "Done"}</button>
      </div>
    </div>
  );
}
