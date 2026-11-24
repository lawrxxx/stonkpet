"use client";
import { Top } from "@/components/Top";
import { useGo } from "@/components/nav";
import { useStore } from "@/lib/store";

export default function Name() {
  const name = useStore((s) => s.name);
  const set = useStore((s) => s.set);
  const go = useGo();
  return (
    <section className="scr" aria-label="Name your pet">
      <Top back="welcome" step={1} />
      <h1 className="t-title mt-8">First, a name</h1>
      <div className="grow" style={{ maxHeight: 120 }} />
      <label htmlFor="petName" className="t-small muted center">Name</label>
      <input id="petName" className="name-input" value={name} maxLength={14} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
      <div className="grow" />
      <button className="btn" onClick={() => go("pers")}>Continue</button>
    </section>
  );
}
