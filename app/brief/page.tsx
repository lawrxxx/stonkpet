"use client";
import { Icon } from "@/components/Icon";
import { Top } from "@/components/Top";
import { useGo } from "@/components/nav";
import { DIETS, type DietKey } from "@/lib/plan";
import { nm, useStore } from "@/lib/store";

export default function Brief() {
  const s = useStore();
  const go = useGo();
  return (
    <section className="scr" aria-label="Your brief">
      <Top back="pers" step={3} />
      <h1 className="t-title mt-8">What&apos;s {nm(s)} into?</h1>
      <p className="muted mt-2">Pick a diet, or just type it out.</p>
      <div className="hscroll mt-5" role="group" aria-label="Diets">
        {(Object.keys(DIETS) as DietKey[]).map((k) => (
          <button key={k} className="chip" aria-pressed={s.diet === k} onClick={() => s.set({ diet: k, brief: DIETS[k].text, skipCrypto: false, plan: null })}>{DIETS[k].label}</button>
        ))}
        <button className="chip" aria-pressed={s.skipCrypto}
          onClick={() => !s.skipCrypto && s.set({ skipCrypto: true, brief: s.brief.trim().replace(/\.?$/, ". ") + "Skip crypto companies.", plan: null })}>
          {!s.skipCrypto && <Icon name="plus" size={16} />}Skip crypto companies
        </button>
      </div>
      <label htmlFor="briefTxt" className="t-small strong mt-5">In your words</label>
      <textarea id="briefTxt" className="mt-2" value={s.brief} onChange={(e) => s.set({ brief: e.target.value, plan: null })} />
      <div className="grow" />
      <button className="btn mt-5" onClick={() => go("rules")}>Continue</button>
    </section>
  );
}
