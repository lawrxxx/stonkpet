"use client";
import { Top } from "@/components/Top";
import { useGo } from "@/components/nav";
import { nm, PERS, useStore } from "@/lib/store";

export default function Personality() {
  const s = useStore();
  const go = useGo();
  return (
    <section className="scr" aria-label="Personality">
      <Top back="name" step={2} />
      <h1 className="t-title mt-8">How bold is {nm(s)}?</h1>
      <p className="muted mt-2">This sets how risky it plays. You can change it anytime.</p>
      <div role="radiogroup" aria-label="Personality" className="stack gap-3 mt-6">
        {PERS.map(([k, t, d, cap, ask]) => (
          <button key={k} className="opt" role="radio" aria-checked={k === s.pers} onClick={() => s.set({ pers: k, cap, ask, plan: null })}>
            <span><span className="t">{t}</span><span className="d">{d}</span></span>
            <span className="radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="grow" />
      <button className="btn mt-6" onClick={() => go("brief")}>Continue</button>
    </section>
  );
}
