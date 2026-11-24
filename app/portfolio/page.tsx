"use client";
import { held, nm, useStore } from "@/lib/store";
import { nameOf } from "@/lib/stocks";

export default function Portfolio() {
  const s = useStore();
  if (!s.plan) return <section className="scr on" />;
  const w = held(s);
  const g = Math.min(100, Math.round(s.total / 10));
  const on = Object.values(s.auto).filter(Boolean).length;
  return (
    <section className="scr on" aria-label="Portfolio">
      <p className="mut" style={{ marginTop: 4 }}>Everything {nm(s)} holds</p>
      <p className="big" style={{ fontSize: 42, marginTop: 4 }}>${s.total.toFixed(2)}</p>
      <p style={{ fontSize: 15 }}><span className="up">+$18.40</span> <span className="mut">this month</span></p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <button className="btn s" onClick={() => s.open("deposit")}>Add money</button>
        <button className="btn s alt" onClick={() => s.open("cashout")}>Cash out</button>
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="sp sm"><span className="mut">Goal: $1,000 by June</span><span style={{ fontWeight: 600 }}>{g}%</span></div>
        <div className="bar" style={{ height: 8 }} role="progressbar" aria-valuenow={g} aria-valuemin={0} aria-valuemax={100} aria-label="Goal progress"><i style={{ width: g + "%", background: "var(--blue)" }} /></div>
      </div>
      <div className="list" style={{ marginTop: 22, padding: "8px 18px" }}>
        {Object.keys(w).map((k) => {
          const v = Math.round(w[k] * 100), over = v > s.cap;
          return (
            <div className="row blk" key={k}>
              <span className="sp"><span style={{ fontWeight: 600 }}>{nameOf(k)}</span><span style={{ fontWeight: 600 }}>${(s.total * w[k]).toFixed(2)}</span></span>
              <div className="bar"><i style={{ width: v + "%", ...(over ? { background: "var(--down)" } : {}) }} /><span className="cap" style={{ left: s.cap + "%" }} /></div>
              <span style={{ fontSize: 13 }} className={over ? "down" : "mut"}>{v}%{over ? " · over your max" : ""}</span>
            </div>
          );
        })}
        {s.plan.cash > 0.005 && (
          <div className="row blk"><span className="sp"><span style={{ fontWeight: 600 }}>USDC</span><span style={{ fontWeight: 600 }}>${(s.total * s.plan.cash).toFixed(2)}</span></span></div>
        )}
      </div>
      <p className="mut" style={{ fontSize: 12, marginTop: 8 }}>Grey line = your {s.cap}% max.</p>
      <div className="list" style={{ marginTop: 16 }}>
        <button className="row" onClick={() => s.open("auto")}><span className="grow">Autopilot</span><span className="mut sm">{on} on</span><span className="chev" aria-hidden="true">›</span></button>
        <button className="row" onClick={() => s.open("mandate")}><span className="grow">What you asked for</span><span className="chev" aria-hidden="true">›</span></button>
        <button className="row" onClick={() => s.open("activity")}><span className="grow">What {nm(s)}&apos;s been up to</span><span className="chev" aria-hidden="true">›</span></button>
      </div>
      <p className="foot">
        Not financial advice. stonkpet is for adults outside the US. Coinbase tokenized stocks are only available in eligible jurisdictions.
        <br />Sample data · testnet build
      </p>
    </section>
  );
}
