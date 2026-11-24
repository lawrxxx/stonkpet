"use client";
import { useEffect, useState } from "react";
import { Pet } from "@/components/Pet";
import { useGo } from "@/components/nav";
import { IS_TESTNET, TOKENS } from "@/lib/chain";
import { nm, useStore, type Tok } from "@/lib/store";
import { useBalances, useWallet } from "@/lib/wallet";

const TOKS: Tok[] = ["USDC", "ETH", "cbBTC"];
type Done = { amt: number; tok: Tok; n: number; night: boolean; at: number; practice: boolean };

export default function Feed() {
  const s = useStore();
  const go = useGo();
  const [done, setDone] = useState<Done | null>(null);
  const [chomp, setChomp] = useState(false);
  const night = s.wx === "night";
  const wallet = useWallet();
  const bal = useBalances(wallet.address);
  // Signed in: real balances in USD (ETH via Chainlink). Not signed in: sample money.
  const avail = (k: Tok): number | null => {
    if (!wallet.connected) return s.wallet[k] ?? 0;
    if (k === "USDC") return bal.USDC;
    if (k === "ETH") return bal.ETHusd;
    return null;
  };
  const unsupported = wallet.connected && s.tok === "cbBTC" && !TOKENS.cbBTC;
  const left = (k: Tok) => {
    const v = avail(k);
    return v === null ? (bal.loading ? "checking…" : "price unavailable") : "$" + v.toFixed(2) + " left";
  };
  // Real buys arrive with onchain execution. Until then, signed-in feeds are practice runs.
  const practice = wallet.connected;

  const finish = () => {
    const st = useStore.getState();
    setDone({ amt: st.amt, tok: st.tok, n: Object.keys(st.plan!.w).length, night: st.wx === "night", at: Date.now(), practice });
    setChomp(true);
    setTimeout(() => setChomp(false), 900);
  };
  useEffect(() => {
    const on = () => finish();
    window.addEventListener("stonkpet:fed", on);
    return () => window.removeEventListener("stonkpet:fed", on);
  }, []);

  if (done)
    return (
      <section className="scr on" aria-label="Feed">
        <div className="top"><button className="back" onClick={() => go("home")} aria-label="Back">‹</button></div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div className="grow" />
          {/* key restarts the coin-drop animation */}
          <div style={{ position: "relative" }} className="drop" key={done.at}>
            <div className="coin" aria-hidden="true">$</div>
            <div className="petwrap"><Pet mood={chomp ? "chomp" : "happy"} size={170} /></div>
          </div>
          <h1 className="c" style={{ marginTop: 24 }} aria-live="polite">{done.practice ? "Practice yum!" : "Yum!"}</h1>
          <p className="mut c" style={{ marginTop: 8, fontSize: 17 }}>
            {done.practice
              ? `${nm(s)} pretended to eat $${done.amt} of ${done.tok}. Your wallet wasn't touched. Real buys are on the way.`
              : done.night ? `${nm(s)} will eat it when the market opens.` : `That was $${done.amt} of ${done.tok}. Now it's ${done.n} stocks.`}
          </p>
          <p className="up c sm" style={{ marginTop: 14 }}>5 weeks in a row. Nice.</p>
          <div className="grow" />
          <button className="btn" onClick={() => go("home")}>Done</button>
        </div>
      </section>
    );

  return (
    <section className="scr on" aria-label="Feed">
      <div className="top"><button className="back" onClick={() => go("home")} aria-label="Back">‹</button></div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div className="seg" role="radiogroup" aria-label="Pay with" style={{ marginTop: 12 }}>
          {TOKS.map((k) => <button key={k} role="radio" aria-checked={k === s.tok} onClick={() => s.set({ tok: k })}>{k}</button>)}
        </div>
        <p className="mut c sm" style={{ marginTop: 10 }}>
          {unsupported ? "cbBTC isn't on Base Sepolia. Try USDC or ETH."
            : s.tok === "USDC" ? `From your USDC · ${left("USDC")}` : `${nm(s)} swaps your ${s.tok} for stocks · ${left(s.tok)}`}
          {!wallet.connected && " · sample money"}
          {wallet.connected && IS_TESTNET && " · testnet"}
        </p>
        <p className="big c bigamt" style={{ lineHeight: 1, marginTop: 26 }} aria-live="polite">${s.amt}</p>
        <div className="amt" role="radiogroup" aria-label="Amount" style={{ marginTop: 28 }}>
          {[10, 20, 50, 100].map((v) => <button key={v} role="radio" aria-checked={v === s.amt} onClick={() => s.set({ amt: v })}>${v}</button>)}
        </div>
        <div className="grow" />
        <button className="link" style={{ alignSelf: "center" }} onClick={() => s.open("basket")}>What will {nm(s)} eat?</button>
        <button className="btn" style={{ marginTop: 12 }} disabled={unsupported || avail(s.tok) === null} onClick={() => {
          const have = avail(s.tok);
          if (have === null) return;
          if (s.amt > have) return s.open(wallet.connected ? "deposit" : "short");
          if (s.amt > s.ask) return s.open("confirm");
          s.doFeed(); finish();
        }}>
          {night ? `Save $${s.amt} for the morning` : `Feed $${s.amt}`}
        </button>
      </div>
    </section>
  );
}
