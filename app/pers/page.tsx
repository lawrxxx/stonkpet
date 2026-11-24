"use client";
import { Top } from "@/components/Top";
import { useGo } from "@/components/nav";
import { nm, PERS, useStore } from "@/lib/store";

export default function Personality() {
  const s = useStore();
  const go = useGo();
  return (
    <section className="scr on" aria-label="Personality">
      <Top back="name" step={2} />
      <h1 style={{ marginTop: 32 }}>How bold is {nm(s)}?</h1>
      <p className="mut" style={{ marginTop: 8 }}>This sets how risky it plays. You can change it anytime.</p>
      <div role="radiogroup" aria-label="Personality" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
        {PERS.map(([k, t, d, cap, ask]) => (
          <button key={k} className="opt" role="radio" aria-checked={k === s.pers} onClick={() => s.set({ pers: k, cap, ask, plan: null })}>
            <span><span className="t">{t}</span><span className="d">{d}</span></span>
            <span className="radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="grow" />
      <button className="btn" onClick={() => go("brief")}>Continue</button>
    </section>
  );
}
