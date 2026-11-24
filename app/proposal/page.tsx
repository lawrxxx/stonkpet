"use client";
import { useGo } from "@/components/nav";
import { useWallet } from "@/lib/wallet";
import { nm, useStore } from "@/lib/store";
import { nameOf, ROBOT_TICKERS, TRADABLE_COUNT, LISTED_COUNT } from "@/lib/stocks";

const whyTabs = [["facts", "Facts"], ["assume", "Assuming"], ["opinion", "My take"]] as const;

export default function Proposal() {
  const s = useStore();
  const go = useGo();
  const wallet = useWallet();
  const p = s.plan;
  if (!p) return <section className="scr on" />;
  const n = Object.keys(p.w).length, lead = nameOf(p.lead);
  const robots = ROBOT_TICKERS.slice(0, 2).map(nameOf).join(" and ");
  const data = {
    facts: [[`All ${n} are live on Base right now, with a Chainlink price feed.`, "Base Tokenized Stocks API"], [`Each one fits what you asked for: ${p.theme}.`, "Company earnings reports"], ...(p.excl.length ? [[p.excl.map(nameOf).join(" and ") + "'s off the list.", "You said so"]] : [])],
    assume: [["You're in this for a year or more, not a week.", ""], [`People keep spending big on ${p.theme}.`, ""], ["You're okay with these moving together. Same theme, same mood swings.", ""]],
    opinion: [[`${lead} fits best, so it gets the biggest bite. Never over your max, though.`, ""], [`Heads up: it's all one theme. When ${p.theme} has a bad week, so will I.`, ""]],
  }[s.why];
  return (
    <section className="scr on" aria-label="Plan">
      <p className="mut sm" style={{ marginTop: 4 }}>The plan</p>
      <h1 style={{ marginTop: 4 }}>What {nm(s)} came up with</h1>
      {(p.robot || p.cash > 0.005) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
          {p.robot && (
            <div className="note">
              <b>No robot stocks I can buy yet</b>
              There are {LISTED_COUNT} stocks on Base, and robot makers like {robots} are listed. But none of them has a live price yet, so I can&apos;t check them against your rules. Only {TRADABLE_COUNT} stocks do. {p.diet === "ai" ? "NVIDIA makes the chips robots run on, so that's the closest I could get." : "So I left robots out for now."}
            </div>
          )}
          {p.cash > 0.005 && (
            <div className="note"><b>{Math.round(p.cash * 100)}% sits in USDC for now</b>Only {n} stocks match what you asked for, and none can go over {s.cap}%. I&apos;d rather hold cash than break your rule.</div>
          )}
        </div>
      )}
      <div className="list" style={{ marginTop: 16 }}>
        {Object.keys(p.w).map((k) => (
          <div className="row blk" key={k}>
            <span className="sp"><span style={{ fontWeight: 600 }}>{nameOf(k)}</span><span style={{ fontWeight: 600 }}>{Math.round(p.w[k] * 100)}%</span></span>
            <div className="bar"><i style={{ width: p.w[k] * 100 + "%" }} /></div>
          </div>
        ))}
        {p.cash > 0.005 && (
          <div className="row blk">
            <span className="sp"><span style={{ fontWeight: 600 }}>Stays in USDC</span><span style={{ fontWeight: 600 }}>{Math.round(p.cash * 100)}%</span></span>
            <div className="bar"><i style={{ width: p.cash * 100 + "%", background: "var(--mut)" }} /></div>
          </div>
        )}
      </div>
      <p className="mut sm" style={{ marginTop: 10 }}>{(p.excl.length ? p.excl.map(nameOf).join(" and ") + "'s out, like you asked. " : "") + `Nothing over ${s.cap}%.`}</p>
      <div className="seg" role="tablist" aria-label="Reasoning" style={{ marginTop: 22 }}>
        {whyTabs.map(([k, l]) => <button key={k} role="tab" aria-selected={k === s.why} aria-controls="whyBody" onClick={() => s.set({ why: k })}>{l}</button>)}
      </div>
      <div id="whyBody" role="tabpanel" style={{ marginTop: 12 }}>
        <div className="list">
          {data.map(([t, src]) => (
            <div className="row blk" key={t}><p style={{ fontSize: 15 }}>{t}</p>{src && <p className="src">Source: {src}</p>}</div>
          ))}
        </div>
      </div>
      <p className="mut" style={{ fontSize: 12, marginTop: 14 }}>Sample data for this demo.</p>
      <div style={{ minHeight: 24 }} />
      <button className="btn" onClick={() => {
        if (wallet.connected) { s.approve(); go("home"); return; }
        useStore.setState({ next: "approve" }); s.open("wallet");
      }}>Looks good</button>
      <button className="link" style={{ alignSelf: "center", marginTop: 4 }} onClick={() => go("brief")}>Change what I said</button>
    </section>
  );
}
