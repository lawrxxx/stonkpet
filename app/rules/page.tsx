"use client";
import { Top } from "@/components/Top";
import { useGo } from "@/components/nav";
import { nm, useStore } from "@/lib/store";

function Pick({ label, id, vals, value, fmt, onPick }: { label: string; id: string; vals: number[]; value: number; fmt: (v: number) => string; onPick: (v: number) => void }) {
  return (
    <div className="stack gap-2">
      <p className="strong" id={id}>{label}</p>
      <div className="pick" role="radiogroup" aria-labelledby={id}>
        {vals.map((v) => <button key={v} role="radio" aria-checked={v === value} onClick={() => onPick(v)}>{fmt(v)}</button>)}
      </div>
    </div>
  );
}

export default function Rules() {
  const s = useStore();
  const go = useGo();
  return (
    <section className="scr" aria-label="Your rules">
      <Top back="brief" step={4} />
      <h1 className="t-title mt-8">A few ground rules</h1>
      <p className="muted mt-2">Picked for a {s.pers} pet. {nm(s)} sticks to these, no matter what.</p>
      <div className="list pad stack gap-5 mt-6">
        <Pick label="Most in one company" id="capL" vals={[20, 25, 30, 35]} value={s.cap} fmt={(v) => v + "%"} onPick={(v) => s.set({ cap: v, plan: null })} />
        <Pick label="Check with me above" id="askL" vals={[10, 25, 50, 100]} value={s.ask} fmt={(v) => "$" + v} onPick={(v) => s.set({ ask: v, plan: null })} />
      </div>
      <div className="grow" />
      <button className="btn mt-6" onClick={() => { s.rebuild(); go("think"); }}>Make {nm(s)}&apos;s plan</button>
    </section>
  );
}
