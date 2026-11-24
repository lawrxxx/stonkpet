"use client";
import { Pet } from "@/components/Pet";
import { SceneSvg } from "@/components/Scene";
import { useGo } from "@/components/nav";
import { useStore } from "@/lib/store";

export default function Welcome() {
  const eligible = useStore((s) => s.eligible);
  const open = useStore((s) => s.open);
  const go = useGo();
  return (
    <section className="scr" aria-label="Welcome">
      <div className="top"><span className="brand">stonkpet</span></div>
      <div className="scene fluid mt-3">
        <SceneSvg w="sun" />
        <div className="pet"><Pet mood="happy" size={150} /></div>
      </div>
      <h1 className="t-display center mt-6">Your money, but make it a pet</h1>
      <p className="t-lead muted center mt-3">Tell it what you&apos;re into. Feed it. Watch it grow.</p>
      <div className="grow" style={{ minHeight: 20, maxHeight: 60 }} />
      <button className="btn" onClick={() => { useStore.setState({ next: null }); if (eligible) go("name"); else open("eligible"); }}>Get started</button>
      <button className="link mt-1" onClick={() => { useStore.setState({ next: "home" }); open(eligible ? "wallet" : "eligible"); }}>
        I already have a pet
      </button>
    </section>
  );
}
