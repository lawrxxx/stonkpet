"use client";
import { Top } from "@/components/Top";
import { useGo } from "@/components/nav";
import { DIETS, type DietKey } from "@/lib/plan";
import { nm, useStore } from "@/lib/store";

export default function Brief() {
  const s = useStore();
  const go = useGo();
  return (
    <section className="scr on" aria-label="Your brief">
      <Top back="pers" step={3} />
      <h1 style={{ marginTop: 32 }}>What&apos;s {nm(s)} into?</h1>
      <p className="mut" style={{ marginTop: 8 }}>Tap a diet, or just type it out.</p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 20, paddingBottom: 2 }} role="group" aria-label="Diets">
        {(Object.keys(DIETS) as DietKey[]).map((k) => (
          <button key={k} className="chip" aria-pressed={s.diet === k} onClick={() => s.set({ diet: k, brief: DIETS[k].text, skipCrypto: false, plan: null })}>{DIETS[k].label}</button>
        ))}
        <button className="chip" aria-pressed={s.skipCrypto}
          onClick={() => !s.skipCrypto && s.set({ skipCrypto: true, brief: s.brief.trim().replace(/\.?$/, ". ") + "Skip crypto companies.", plan: null })}>
          + Skip crypto companies
        </button>
      </div>
      <label htmlFor="briefTxt" className="sm" style={{ marginTop: 18, fontWeight: 600 }}>In your words</label>
      <textarea id="briefTxt" style={{ marginTop: 8 }} value={s.brief} onChange={(e) => s.set({ brief: e.target.value, plan: null })} />
      <div className="grow" />
      <button className="btn" style={{ marginTop: 20 }} onClick={() => go("rules")}>Continue</button>
    </section>
  );
}
