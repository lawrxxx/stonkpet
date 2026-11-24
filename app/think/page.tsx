"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Pet } from "@/components/Pet";
import { useGo } from "@/components/nav";
import { nm, useStore } from "@/lib/store";
import { LISTED_COUNT } from "@/lib/stocks";

/** Seconds after start at which each step lights up. Research usually takes about a minute. */
const PACE = [0.3, 2, 6, 14, 30, 50];

export default function Think() {
  const s = useStore();
  const go = useGo();
  const status = s.research.status;
  const steps = useMemo(() => [
    "Reading what you wrote",
    `Checking the ${LISTED_COUNT} stocks on Base`,
    "Finding what's actually buyable",
    "Looking up earnings and filings",
    "Checking every source",
    `Keeping everything under ${s.cap}%`,
  ], [s.cap]);

  const [on, setOn] = useState(0);
  useEffect(() => {
    if (status !== "loading") return;
    const ts = PACE.map((sec, i) => setTimeout(() => setOn(i + 1), sec * 1000));
    return () => ts.forEach(clearTimeout);
  }, [status]);

  // Started without a request in flight (e.g. a reload): kick one off.
  useEffect(() => {
    if (status === "idle" && !s.plan) void useStore.getState().startResearch();
  }, [status, s.plan]);

  useEffect(() => {
    if (status !== "done") return;
    setOn(steps.length);
    const t = setTimeout(() => go("proposal"), 700);
    return () => clearTimeout(t);
  }, [status, go, steps.length]);

  if (status === "error")
    return (
      <section className="scr" aria-label="Research">
        <div className="grow" />
        <div className="petwrap"><Pet mood="sad" size={150} /></div>
        <h1 className="t-heading center mt-6">That didn&apos;t work</h1>
        <p className="muted center mt-2" role="alert">{s.research.message}</p>
        <div className="grow" />
        <button className="btn" onClick={() => void s.startResearch()}>Try again</button>
        <button className="link mt-1" onClick={() => { s.useSimplePlan(); go("proposal"); }}>Use a simple plan without research</button>
        <button className="link" onClick={() => go("brief")}>Change what I said</button>
      </section>
    );

  return (
    <section className="scr" aria-label="Researching">
      <div className="grow" />
      <div className="petwrap"><Pet mood="think" size={170} /></div>
      <h1 className="t-heading center mt-6">{nm(s)} is doing homework</h1>
      <p className="t-small muted center mt-1">This takes about a minute.</p>
      <div className="stack mt-6" style={{ width: "100%", maxWidth: 300, alignSelf: "center" }} aria-live="polite">
        {steps.map((t, i) => (
          <div key={t} className={"step" + (i < on ? " on" : "")}>
            <span className="ic"><Icon name="check" size={14} stroke={2.6} /></span>
            <span>{t}</span>
          </div>
        ))}
      </div>
      <div className="grow" />
    </section>
  );
}
