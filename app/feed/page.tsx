"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Pet } from "@/components/Pet";
import { useGo } from "@/components/nav";
import { useFeed, useRealPortfolio, type FeedState } from "@/lib/account";
import { IS_TESTNET, TOKENS, txUrl } from "@/lib/chain";
import { nameOf } from "@/lib/stocks";
import { nm, useStore, type Tok } from "@/lib/store";
import { useBalances, useWallet } from "@/lib/wallet";

const TOKS: Tok[] = ["USDC", "ETH", "cbBTC"];
type SampleDone = { amt: number; tok: Tok; n: number; night: boolean; at: number };

function Back() {
  const go = useGo();
  return <div className="top"><button className="icon-btn" onClick={() => go("home")} aria-label="Back"><Icon name="back" size={24} /></button></div>;
}

/** Progress, refusal, confirmation and receipt screens for a real onchain feed. */
function RealFeedStatus({ f, amt, onYes, onNo, onReset }: { f: FeedState; amt: number; onYes: () => void; onNo: () => void; onReset: () => void }) {
  const s = useStore();
  const go = useGo();
  const busy: Partial<Record<FeedState["step"], string>> = {
    checking: "Checking your rules…",
    pricing: "Getting today's prices…",
    signing: "Confirm with your passkey",
    settling: "Waiting for Base to confirm…",
  };
  if (busy[f.step])
    return (
      <section className="scr" aria-label="Feeding" aria-busy="true">
        <Back />
        <div className="grow" />
        <div className="petwrap"><Pet mood="think" size={160} /></div>
        <h1 className="t-heading center mt-6" aria-live="polite">{busy[f.step]}</h1>
        {f.step === "signing" && f.legs && <p className="t-small muted center mt-2">{f.legs.map((l) => `${nameOf(l.ticker)} $${l.usd.toFixed(2)}`).join(" · ")}</p>}
        {f.step === "signing" && <p className="t-small muted center mt-1">Network fee covered.</p>}
        <div className="grow" />
      </section>
    );

  if (f.step === "confirm")
    return (
      <section className="scr" aria-label="Quick check">
        <Back />
        <div className="grow" />
        <div className="petwrap"><Pet mood="idle" size={140} /></div>
        <h1 className="t-heading center mt-6">Quick check</h1>
        <p className="muted center mt-2">Feed ${amt}?{amt > s.ask ? ` That's more than the $${s.ask} you said to check on.` : ""}</p>
        {f.notes?.map((n) => <p className="t-small muted center mt-1" key={n}>{n}</p>)}
        <div className="grow" />
        <button className="btn" onClick={onYes}>Yes, feed ${amt}</button>
        <button className="btn ghost mt-1" onClick={onNo}>Hold on</button>
      </section>
    );

  if (f.step === "done")
    return (
      <section className="scr" aria-label="Fed">
        <Back />
        <div className="grow" />
        <div style={{ position: "relative" }} className="drop"><div className="coin" aria-hidden="true">$</div><div className="petwrap"><Pet mood="happy" size={170} /></div></div>
        <h1 className="t-title center mt-6" aria-live="polite">Yum.</h1>
        <p className="t-lead muted center mt-2">${amt} of USDC is now {f.legs?.length ?? ""} stocks, confirmed on Base.</p>
        {f.txHash && (
          <a className="link mt-3" href={txUrl(f.txHash)} target="_blank" rel="noreferrer">View on Basescan <Icon name="external" size={14} /></a>
        )}
        <div className="grow" />
        <button className="btn" onClick={() => { onReset(); go("home"); }}>Done</button>
      </section>
    );

  const sad = f.step === "refused" || f.step === "error";
  return (
    <section className="scr" aria-label="Feed result">
      <Back />
      <div className="grow" />
      <div className="petwrap"><Pet mood={sad ? "sad" : "sleep"} size={150} /></div>
      <h1 className="t-heading center mt-6">{f.step === "queued" ? "Saved for the open" : f.step === "refused" ? "I can't do that one" : "That didn't work"}</h1>
      <p className="muted center mt-2" role={sad ? "alert" : undefined}>
        {f.step === "queued" ? `The market's closed, so ${nm(s)} will eat this when it opens. Nothing's been spent yet.` : f.message}
      </p>
      <div className="grow" />
      <button className="btn" onClick={() => { onReset(); go("home"); }}>Back home</button>
    </section>
  );
}

export default function Feed() {
  const s = useStore();
  const go = useGo();
  const wallet = useWallet();
  const bal = useBalances(wallet.address);
  const rp = useRealPortfolio();
  const real = rp.signedIn && !!rp.data?.tradingLive;
  const feed = useFeed();
  const [done, setDone] = useState<SampleDone | null>(null);
  const [chomp, setChomp] = useState(false);
  const night = s.wx === "night";

  // Signed in: real balances in USD (ETH via Chainlink). Otherwise sample money.
  const avail = (k: Tok): number | null => {
    if (!wallet.connected) return s.wallet[k] ?? 0;
    if (k === "USDC") return bal.USDC;
    if (k === "ETH") return bal.ETHusd;
    return null;
  };
  const unsupported = (wallet.connected && s.tok === "cbBTC" && !TOKENS.cbBTC) || (real && s.tok !== "USDC");
  const left = (k: Tok) => { const v = avail(k); return v === null ? (bal.loading ? "checking…" : "price unavailable") : "$" + v.toFixed(2) + " left"; };

  const finishSample = () => {
    const st = useStore.getState();
    setDone({ amt: st.amt, tok: st.tok, n: Object.keys(st.plan!.w).length, night: st.wx === "night", at: Date.now() });
    setChomp(true);
    setTimeout(() => setChomp(false), 900);
  };
  useEffect(() => {
    const on = () => finishSample();
    window.addEventListener("stonkpet:fed", on);
    return () => window.removeEventListener("stonkpet:fed", on);
  }, []);

  if (feed.state.step !== "idle")
    return <RealFeedStatus f={feed.state} amt={s.amt} onYes={() => void feed.approve()} onNo={() => void feed.decline()} onReset={feed.reset} />;

  if (done)
    return (
      <section className="scr" aria-label="Feed">
        <Back />
        <div className="grow" />
        <div style={{ position: "relative" }} className="drop" key={done.at}>
          <div className="coin" aria-hidden="true">$</div>
          <div className="petwrap"><Pet mood={chomp ? "chomp" : "happy"} size={170} /></div>
        </div>
        <h1 className="t-title center mt-6" aria-live="polite">{wallet.connected ? "Practice run" : "Yum."}</h1>
        <p className="t-lead muted center mt-2">
          {wallet.connected
            ? `${nm(s)} pretended to eat $${done.amt} of ${done.tok}. Your wallet wasn't touched.`
            : done.night ? `${nm(s)} will eat it when the market opens.` : `That was $${done.amt} of ${done.tok}. Now it's ${done.n} stocks.`}
        </p>
        <p className="t-small up center mt-3">5 weeks in a row.</p>
        <div className="grow" />
        <button className="btn" onClick={() => go("home")}>Done</button>
      </section>
    );

  return (
    <section className="scr" aria-label="Feed">
      <Back />
      <div className="seg mt-3" role="radiogroup" aria-label="Pay with">
        {TOKS.map((k) => <button key={k} role="radio" aria-checked={k === s.tok} onClick={() => s.set({ tok: k })}>{k}</button>)}
      </div>
      <p className="t-small muted center mt-3">
        {real && s.tok !== "USDC" ? "Real buys use USDC for now. Paying with ETH or cbBTC comes later."
          : unsupported ? "cbBTC isn't on Base Sepolia. Try USDC or ETH."
          : s.tok === "USDC" ? `From your USDC · ${left("USDC")}` : `${nm(s)} swaps your ${s.tok} for stocks · ${left(s.tok)}`}
        {!wallet.connected && " · sample money"}
        {real && IS_TESTNET && " · testnet"}
      </p>
      <p className="num t-amount center mt-6" aria-live="polite">${s.amt}</p>
      <div className="amt mt-6" role="radiogroup" aria-label="Amount">
        {[10, 20, 50, 100].map((v) => <button key={v} role="radio" aria-checked={v === s.amt} onClick={() => s.set({ amt: v })}>${v}</button>)}
      </div>
      <div className="grow" />
      <button className="link" onClick={() => s.open("basket")}>What will {nm(s)} eat?</button>
      <button className="btn mt-2" disabled={unsupported || avail(s.tok) === null} onClick={() => {
        if (real) return void feed.start(s.amt);
        const have = avail(s.tok);
        if (have === null) return;
        if (s.amt > have) return s.open(wallet.connected ? "deposit" : "short");
        if (s.amt > s.ask) return s.open("confirm");
        s.doFeed(); finishSample();
      }}>
        {night ? `Save $${s.amt} for the morning` : `Feed $${s.amt}`}
      </button>
    </section>
  );
}
