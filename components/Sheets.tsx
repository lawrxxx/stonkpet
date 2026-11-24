"use client";
import { useEffect, useRef, useState } from "react";
import { DIETS } from "@/lib/plan";
import { money, nm, useStore, type SheetKey } from "@/lib/store";
import { nameOf } from "@/lib/stocks";
import { Pet } from "./Pet";
import { useGo } from "./nav";
import { useWallet } from "@/lib/wallet";
import { clock, opensWhen, pct, planDayChange, priceOf } from "@/lib/prices";
import { Deposit, SignIn } from "./WalletSheets";

const ADDR = "0x7a3F…9C1e";
const ADDR_FULL = "0x7a3F000000000000000000000000000000009C1e";

function Switch({ id, on, label, onToggle }: { id: string; on: boolean; label: string; onToggle: () => void }) {
  return (
    <div className="row">
      <span className="grow" id={id + "L"}>{label}</span>
      <button className="sw" role="switch" aria-checked={on} aria-labelledby={id + "L"} onClick={onToggle}><span /></button>
    </div>
  );
}

function Copy({ text, label = "Copy", className = "chip", id }: { text: string; label?: string; className?: string; id?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={className} id={id} style={className === "btn" ? { marginTop: 12 } : undefined}
      onClick={async () => { try { await navigator.clipboard.writeText(text); } catch {} setDone(true); }}>
      {done ? "Copied" : label}
    </button>
  );
}

function Body({ k, onSettled }: { k: SheetKey; onSettled: () => void }) {
  const s = useStore();
  const go = useGo();
  const name = nm(s);
  const p = s.plan;
  const [added, setAdded] = useState(false);
  const [bioDone, setBioDone] = useState<number | null>(null);
  const wallet = useWallet();

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
        <h2 id="sheetT">Add money</h2>
        <p className="mut sm">Send crypto to your {name} wallet, then feed it.</p>
        <div className="list" style={{ marginTop: 14 }}>
          <div className="row blk">
            <p className="mut sm">Your wallet on Base</p>
            <div className="sp" style={{ alignItems: "center", marginTop: 4 }}><b style={{ font: "600 20px Fredoka,system-ui,sans-serif" }}>{ADDR}</b><Copy text={ADDR_FULL} /></div>
            <p className="src">Sample address for this demo</p>
          </div>
          <div className="row"><span className="grow">Accepts</span><b style={{ fontWeight: 700 }}>USDC · ETH · cbBTC</b></div>
          <div className="row"><span className="grow">Buy with card</span><span className="mut sm">Coming soon</span></div>
        </div>
        <div className="note" style={{ marginTop: 12 }}><b>Only send on Base</b>Sending on another network can lose your money.</div>
        <p className="mut sm" style={{ marginTop: 14 }}>Wallet: {(["USDC", "ETH", "cbBTC"] as const).map((x) => x + " " + money(s.wallet[x])).join(" · ")}</p>
        <button className="btn" style={{ marginTop: 12 }} disabled={added}
          onClick={() => { s.set({ wallet: { ...s.wallet, USDC: s.wallet.USDC + 50 } }); s.addLog("Added money", "$50 USDC arrived in your wallet on Base.", 50); setAdded(true); }}>
          {added ? "✓ $50 added" : "Add $50 test USDC (demo)"}
        </button>
      </>);
    case "short":
      return (<>
        <h2 id="sheetT">Not enough {s.tok}</h2>
        <p className="mut">You&apos;ve got {money(s.wallet[s.tok])} of {s.tok}. Add money, or feed a smaller amount.</p>
        <button className="btn" style={{ marginTop: 18 }} onClick={() => s.open("deposit")}>Add money</button>
      </>);
    case "cashout":
      return (<>
        <h2 id="sheetT">Cash out</h2>
        <p className="mut sm">{name} sells stocks back to USDC in your wallet.</p>
        <div className="list" style={{ marginTop: 14, padding: "16px 18px" }}>
          <p className="mut sm" id="coL">How much?</p>
          <div className="pick" role="radiogroup" aria-labelledby="coL" style={{ marginTop: 10 }}>
            {[25, 50, 100].map((f) => <button key={f} role="radio" aria-checked={f === s.co} onClick={() => s.set({ co: f })}>{f === 100 ? "All" : f + "%"}</button>)}
          </div>
          <div className="sp" style={{ marginTop: 16 }}><span>You get</span><b style={{ font: "600 22px Fredoka,system-ui,sans-serif" }}>{money((s.total * s.co) / 100)}</b></div>
          <p className="src">In USDC, in your wallet. Network fee covered.</p>
        </div>
        {s.wx === "night" && <div className="note" style={{ marginTop: 12 }}><b>Market&apos;s closed</b>Your sale goes through when the market opens.</div>}
        <button className="btn" style={{ marginTop: 16 }} onClick={() => s.open("bio")}>Confirm with fingerprint</button>
      </>);
    case "bio":
      return (
        <div className="c" style={{ padding: "10px 0" }}>
          <h2 id="sheetT">Confirm it&apos;s you</h2>
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke={bioDone !== null ? "var(--leaf)" : "var(--green)"} strokeWidth="1.6" strokeLinecap="round" style={{ margin: "18px auto", display: "block" }} aria-hidden="true">
            <path d="M12 11v2.5c0 2.5-.8 4.6-2.2 6.3M8.5 7.6A5 5 0 0 1 17 11v1.5c0 1.6-.2 3.2-.7 4.6M7 11a5 5 0 0 1 .3-1.7M7 14c0 1.6-.4 3-1.1 4.2M14.5 11a2.5 2.5 0 0 0-5 0v1c0 2.3-.6 4.5-1.7 6.3M14.5 14.3c-.2 1.9-.8 3.6-1.7 5.2M4.5 12a7.5 7.5 0 0 1 12.8-5.3M19.5 12c0 1-.1 2-.3 3" />
          </svg>
          <p className="mut sm" aria-live="polite">
            {bioDone === null ? <>Touch the sensor… <span style={{ opacity: 0.7 }}>(simulated)</span></> : <><b className="up" style={{ fontSize: 18 }}>✓ Done</b><br />{money(bioDone)} is in your USDC.</>}
          </p>
        </div>
      );
    case "receipt": {
      const r = s.log[s.rc];
      if (!r) return <h2 id="sheetT">Receipt</h2>;
      return (<>
        <h2 id="sheetT">Receipt</h2>
        <div className="list" style={{ marginTop: 12 }}>
          <div className="row"><span className="grow">What</span><b style={{ fontWeight: 700 }}>{r.what}</b></div>
          {r.amount ? <div className="row"><span className="grow">Amount</span><b style={{ fontWeight: 700 }}>{money(r.amount)}</b></div> : null}
          <div className="row"><span className="grow">When</span><span>Today, {r.time}</span></div>
          <div className="row"><span className="grow">Network</span><span>Base</span></div>
          <div className="row"><span className="grow">Status</span><span className="up">Confirmed</span></div>
          <div className="row blk">
            <span className="sp"><span>Transaction</span><span style={{ fontFamily: "ui-monospace,monospace", fontSize: 14 }}>{r.tx}</span></span>
            <p className="src" style={{ textAlign: "right" }}>Sample ID: this demo makes no real transactions</p>
          </div>
        </div>
        <p className="mut sm" style={{ marginTop: 10 }}>{r.detail}</p>
        <button className="btn alt" disabled style={{ marginTop: 14, opacity: 0.6 }}>View on Basescan · in the live app</button>
      </>);
    }
    case "basket":
      return (<>
        <h2 id="sheetT">What {name} will eat</h2>
        <p className="mut sm">Split the way you agreed</p>
        <div className="list" style={{ marginTop: 16 }}>
          {p && Object.keys(p.w).map((x) => <div className="row" key={x}><span className="grow">{nameOf(x)}</span><b style={{ fontWeight: 600 }}>${(s.amt * p.w[x]).toFixed(2)}</b></div>)}
          {p && p.cash > 0.005 && <div className="row"><span className="grow">Stays in USDC</span><b style={{ fontWeight: 600 }}>${(s.amt * p.cash).toFixed(2)}</b></div>}
        </div>
      </>);
    case "confirm":
      return (<>
        <h2 id="sheetT">Quick check</h2>
        <p className="mut">That&apos;s more than the ${s.ask} you said to check on. Still good?</p>
        <button className="btn" style={{ marginTop: 18 }} onClick={() => { s.doFeed(); window.dispatchEvent(new Event("stonkpet:fed")); }}>Yes, feed ${s.amt}</button>
      </>);
    case "note":
      return (<>
        <h2 id="sheetT">Morning!</h2>
        <p className="mut sm">{name}, 7:30am</p>
        <div className="list" style={{ marginTop: 14 }}>
          <NoteMood />
          <div className="row blk">
            <span className="tag">Your rules</span>
            <p>{p && nameOf(p.lead)} grew past your {s.cap}% max. {s.trimmed ? "You okayed a trim, so we're back in line." : "I asked about selling a bit."}</p>
            <LeadPrice ticker={p?.lead} />
          </div>
          <NoteMovers />
        </div>
        <button className="btn alt" style={{ marginTop: 14 }} onClick={() => go("chat")}>Open chat</button>
      </>);
    case "share":
      return (<>
        <h2 id="sheetT">Show off {name}</h2>
        <div className="share" style={{ marginTop: 12 }}>
          <div className="petwrap"><Pet mood="happy" size={110} /></div>
          <p style={{ font: "600 26px Fredoka,system-ui,sans-serif", marginTop: 8 }}>{name} is up 8.0%</p>
          <p style={{ opacity: 0.85, fontSize: 14, marginTop: 2 }}>Level 3 · {p ? DIETS[p.diet].label : ""} diet · this month</p>
          <p style={{ opacity: 0.7, fontSize: 12, marginTop: 14 }}>stonkpet · built on Base</p>
        </div>
        <p className="mut sm c" style={{ marginTop: 10 }}>Only shows %, never how much you have.</p>
        <Copy className="btn" label="Copy link" text={`https://stonkpet.app/p/${encodeURIComponent(name.toLowerCase())}`} />
      </>);
    case "auto":
      return (<>
        <h2 id="sheetT">Autopilot</h2>
        <p className="mut sm">Stuff {name} handles on its own. Always inside your rules.</p>
        <div className="list" style={{ marginTop: 14 }}>
          <Switch id="reb" on={s.auto.reb} label="Fix the mix when one stock gets too big" onToggle={() => s.set({ auto: { ...s.auto, reb: !s.auto.reb } })} />
          <Switch id="weekly" on={s.auto.weekly} label={`Feed $${s.weekly} every Friday`} onToggle={() => s.set({ auto: { ...s.auto, weekly: !s.auto.weekly } })} />
          <Switch id="tp" on={s.auto.tp} label="When ETH is up 20%, move 10% of the gain into stocks" onToggle={() => s.set({ auto: { ...s.auto, tp: !s.auto.tp } })} />
        </div>
        <p className="mut sm" style={{ marginTop: 14 }}>Goal: $1,000 by June. {name} will nudge you if you fall behind.</p>
      </>);
    case "mandate":
      return (<>
        <h2 id="sheetT">What you asked for</h2>
        <p className="mut sm">{name} only acts inside these.</p>
        <div className="list" style={{ marginTop: 14 }}>
          <div className="row blk"><p className="mut sm">In your words</p><p>{p?.brief}</p></div>
          <div className="row"><span className="grow">Most in one company</span><b style={{ fontWeight: 600 }}>{s.cap}%</b></div>
          <div className="row"><span className="grow">Check with me above</span><b style={{ fontWeight: 600 }}>${s.ask}</b></div>
          <div className="row"><span className="grow">Never buy</span><b style={{ fontWeight: 600 }}>{p?.excl.length ? p.excl.map(nameOf).join(", ") : "Nothing"}</b></div>
        </div>
        <button className="btn alt" style={{ marginTop: 14 }} onClick={() => go("brief")}>Change it</button>
      </>);
    case "activity":
      return (<>
        <h2 id="sheetT">What {name}&apos;s been up to</h2>
        <div className="list" style={{ marginTop: 14 }}>
          {s.log.length === 0 && <div className="row blk"><span className="sp"><b style={{ fontWeight: 700 }}>Quiet so far</b></span><p className="mut sm" style={{ marginTop: 2 }}>Say yes to a plan and I&apos;ll get going.</p></div>}
          {s.log.map((a, i) => (
            <button className="row blk" key={i} onClick={() => { s.set({ rc: i }); s.open("receipt"); }}>
              <span className="sp"><b style={{ fontWeight: 700 }}>{a.what}</b><span className="mut" style={{ fontSize: 13 }}>{a.when}{a.tx ? " · Receipt ›" : ""}</span></span>
              <p className="mut sm" style={{ marginTop: 2 }}>{a.detail}</p>
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
  return <div className="row blk"><span className="tag">Mood</span><p>{text}</p>{d !== null && <p className="src">Source: Chainlink price feeds on Base</p>}</div>;
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
      <p>Biggest mover on Base {b.market.open ? "today" : "last session"}: {nameOf(top.ticker)}, {pct(top.dayChangePct!)}.{b.market.open ? "" : ` Market opens ${opensWhen(b)}.`}</p>
      <p className="src">Source: Chainlink price feeds on Base</p>
    </div>
  );
}

/** Real price line for the note, with its source and time. Says nothing rather than inventing one. */
function LeadPrice({ ticker }: { ticker?: string }) {
  const b = useStore((s) => s.board);
  const q = ticker ? priceOf(b, ticker) : null;
  if (!ticker || !q || q.price === null || !q.updatedAt) return <p className="src">Live price unavailable right now.</p>;
  return (
    <p className="src">
      {nameOf(ticker)} is ${q.price.toFixed(2)}{q.dayChangePct !== null ? `, ${pct(q.dayChangePct)} today` : ""}. Source: Chainlink price feed on Base, {clock(q.updatedAt)}
    </p>
  );
}

/** 18+ and region check. Coinbase tokenized stocks are only for eligible people outside the US. */
function Eligible() {
  const [age, setAge] = useState(false);
  const [region, setRegion] = useState(false);
  const go = useGo();
  return (<>
    <h2 id="sheetT">Quick check first</h2>
    <p className="mut sm">Tokenized stocks on Base are only for adults outside the US.</p>
    <div className="list" style={{ marginTop: 14 }}>
      <label className="row chk"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /><span>I&apos;m 18 or older</span></label>
      <label className="row chk"><input type="checkbox" checked={region} onChange={(e) => setRegion(e.target.checked)} /><span>I don&apos;t live in the US, and I&apos;m in a country where Coinbase tokenized stocks are allowed</span></label>
    </div>
    <button className="btn" style={{ marginTop: 16 }} disabled={!age || !region}
      onClick={() => {
        const next = useStore.getState().next;
        useStore.setState({ eligible: true });
        if (next === "home") useStore.getState().open("wallet");
        else go("name");
      }}>
      Let&apos;s go
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
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT" aria-hidden={!sheet} inert={!sheet}
      onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
      <div className="grab" />
      {k && <Body key={k + opens} k={k} onSettled={() => setSettled(true)} />}
      <button className="btn" ref={closeRef} style={{ marginTop: 22 }} onClick={close}>
        {k && !settled && ["confirm", "cashout", "short", "bio", "eligible", "wallet"].includes(k) ? "Cancel" : "Done"}
      </button>
    </div>
  );
}
