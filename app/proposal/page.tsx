"use client";
import { useGo } from "@/components/nav";
import { nm, useStore } from "@/lib/store";
import { LISTED_COUNT, nameOf, ROBOT_TICKERS, TRADABLE_COUNT } from "@/lib/stocks";
import { useWallet } from "@/lib/wallet";

const WHY = [["facts", "Facts"], ["assume", "Assuming"], ["opinion", "My take"]] as const;

export default function Proposal() {
  const s = useStore();
  const go = useGo();
  const wallet = useWallet();
  const p = s.plan;
  if (!p) return <section className="scr" />;

  const n = Object.keys(p.w).length, lead = nameOf(p.lead);
  const robots = ROBOT_TICKERS.slice(0, 2).map(nameOf).join(" and ");
  const excl = p.excl.map(nameOf).join(" and ");
  const reasons = {
    facts: [
      [`All ${n} are live on Base right now, with a Chainlink price feed.`, "Base Tokenized Stocks API"],
      [`Each one fits what you asked for: ${p.theme}.`, "Company earnings reports"],
      ...(p.excl.length ? [[`${excl}'s off the list.`, "You said so"]] : []),
    ],
    assume: [["You're in this for a year or more, not a week.", ""], [`People keep spending big on ${p.theme}.`, ""], ["You're okay with these moving together. Same theme, same mood swings.", ""]],
    opinion: [[`${lead} fits best, so it gets the biggest bite. Never over your max, though.`, ""], [`It's all one theme. When ${p.theme} has a bad week, so will I.`, ""]],
  }[s.why];

  const approve = () => {
    if (wallet.connected) { s.approve(); go("home"); return; }
    useStore.setState({ next: "approve" });
    s.open("wallet");
  };

  return (
    <section className="scr" aria-label="Plan">
      <p className="t-small muted">The plan</p>
      <h1 className="t-title mt-1">What {nm(s)} came up with</h1>

      {(p.robot || p.cash > 0.005) && (
        <div className="stack gap-2 mt-5">
          {p.robot && (
            <div className="note">
              <b>No robot stocks I can buy yet</b>
              Robot makers like {robots} are listed on Base, but none has a live price yet, so I can&apos;t check them against your rules. Only {TRADABLE_COUNT} of the {LISTED_COUNT} stocks on Base do.{" "}
              {p.diet === "ai" ? "NVIDIA makes the chips robots run on, so that's the closest I could get." : "So I left robots out for now."}
            </div>
          )}
          {p.cash > 0.005 && (
            <div className="note">
              <b>{Math.round(p.cash * 100)}% stays in USDC for now</b>
              Only {n} stocks match what you asked for, and none can go over {s.cap}%. I&apos;d rather hold cash than break your rule.
            </div>
          )}
        </div>
      )}

      <div className="list mt-4">
        {Object.keys(p.w).map((k) => (
          <div className="row blk" key={k}>
            <div className="between strong"><span>{nameOf(k)}</span><span className="num">{Math.round(p.w[k] * 100)}%</span></div>
            <div className="bar"><i style={{ width: p.w[k] * 100 + "%" }} /></div>
          </div>
        ))}
        {p.cash > 0.005 && (
          <div className="row blk">
            <div className="between strong"><span>Stays in USDC</span><span className="num">{Math.round(p.cash * 100)}%</span></div>
            <div className="bar"><i className="cash" style={{ width: p.cash * 100 + "%" }} /></div>
          </div>
        )}
      </div>
      <p className="t-small muted mt-2">{p.excl.length ? `${excl}'s out, like you asked. ` : ""}Nothing over {s.cap}%.</p>

      <div className="seg mt-6" role="tablist" aria-label="Reasoning">
        {WHY.map(([k, l]) => <button key={k} role="tab" aria-selected={k === s.why} aria-controls="whyBody" onClick={() => s.set({ why: k })}>{l}</button>)}
      </div>
      <div id="whyBody" role="tabpanel" className="list mt-3">
        {reasons.map(([t, src]) => (
          <div className="row blk" key={t}><p className="t-small">{t}</p>{src && <span className="src">Source: {src}</span>}</div>
        ))}
      </div>
      <p className="t-caption muted mt-3">Sample data for this demo.</p>

      <div className="grow" style={{ minHeight: 24 }} />
      <button className="btn" onClick={approve}>Looks good</button>
      <button className="link mt-1" onClick={() => go("brief")}>Change what I said</button>
    </section>
  );
}
