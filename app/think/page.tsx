"use client";
import { useEffect, useMemo, useState } from "react";
import { Pet } from "@/components/Pet";
import { useGo } from "@/components/nav";
import { nm, useStore } from "@/lib/store";
import { LISTED_COUNT, nameOf } from "@/lib/stocks";

export default function Think() {
  const s = useStore();
  const go = useGo();
  const p = s.plan ?? s.ensurePlan();
  const steps = useMemo(() => {
    const out: [string, string][] = [["Reading what you wrote", "✓"], [`Going through the ${LISTED_COUNT} stocks on Base`, "✓"]];
    if (p.robot) out.push(["Hunting for robot stocks… listed, but no prices yet", "!"]);
    if (p.excl.length) out.push(["Crossing off " + p.excl.map(nameOf).join(" and "), "✓"]);
    out.push(["Skimming earnings and news", "✓"], ["Keeping everything under " + s.cap + "%", "✓"]);
    return out;
  }, [p, s.cap]);
  const [on, setOn] = useState(0);
  useEffect(() => {
    const ts = steps.map((_, i) => setTimeout(() => setOn(i + 1), 400 + i * 520));
    ts.push(setTimeout(() => go("proposal"), 400 + steps.length * 520 + 500));
    return () => ts.forEach(clearTimeout);
  }, [steps, go]);
  return (
    <section className="scr on" aria-label="Researching">
      <div className="grow" />
      <div className="petwrap"><Pet mood="think" size={170} /></div>
      <h1 className="c" style={{ marginTop: 24, fontSize: 26 }}>{nm(s)} is doing homework</h1>
      <div style={{ margin: "24px auto 0", width: "100%", maxWidth: 300 }} aria-live="polite">
        {steps.map(([t, ic], i) => (
          <div key={t} className={"step" + (i < on ? " on" : "")}><span className="ic" aria-hidden="true">{ic}</span><span>{t}</span></div>
        ))}
      </div>
      <div className="grow" />
    </section>
  );
}
