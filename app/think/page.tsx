"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Pet } from "@/components/Pet";
import { useGo } from "@/components/nav";
import { nm, useStore } from "@/lib/store";
import { LISTED_COUNT, nameOf } from "@/lib/stocks";

type Step = { text: string; warn?: boolean };

export default function Think() {
  const s = useStore();
  const go = useGo();
  const p = s.plan ?? s.ensurePlan();
  const steps = useMemo(() => {
    const out: Step[] = [{ text: "Reading what you wrote" }, { text: `Going through the ${LISTED_COUNT} stocks on Base` }];
    if (p.robot) out.push({ text: "Looking for robot stocks: listed, but no prices yet", warn: true });
    if (p.excl.length) out.push({ text: "Crossing off " + p.excl.map(nameOf).join(" and ") });
    out.push({ text: "Checking prices and filings" }, { text: `Keeping everything under ${s.cap}%` });
    return out;
  }, [p, s.cap]);
  const [on, setOn] = useState(0);
  useEffect(() => {
    const ts = steps.map((_, i) => setTimeout(() => setOn(i + 1), 400 + i * 520));
    ts.push(setTimeout(() => go("proposal"), 400 + steps.length * 520 + 500));
    return () => ts.forEach(clearTimeout);
  }, [steps, go]);
  return (
    <section className="scr" aria-label="Researching">
      <div className="grow" />
      <div className="petwrap"><Pet mood="think" size={170} /></div>
      <h1 className="t-heading center mt-6">{nm(s)} is doing homework</h1>
      <div className="stack mt-6" style={{ width: "100%", maxWidth: 300, alignSelf: "center" }} aria-live="polite">
        {steps.map((st, i) => (
          <div key={st.text} className={"step" + (i < on ? " on" : "")}>
            <span className={"ic" + (st.warn ? " warn" : "")}><Icon name={st.warn ? "alert" : "check"} size={14} stroke={2.6} /></span>
            <span>{st.text}</span>
          </div>
        ))}
      </div>
      <div className="grow" />
    </section>
  );
}
