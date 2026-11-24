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
    <section className="scr on" aria-label="Welcome">
      <div className="top"><span style={{ font: "700 22px Fredoka,system-ui,sans-serif", color: "var(--green)" }}>stonkpet</span></div>
      <div className="scene fluid" style={{ marginTop: 12 }}>
        <SceneSvg w="sun" />
        <div className="pet"><Pet mood="happy" size={150} /></div>
      </div>
      <h1 className="c hero" style={{ marginTop: 26 }}>Your money, but make it a pet</h1>
      <p className="mut c" style={{ marginTop: 12, fontSize: 17 }}>Tell it what you&apos;re into. Feed it. Watch it grow.</p>
      <div className="grow" style={{ minHeight: 20, maxHeight: 60 }} />
      <button className="btn" onClick={() => { useStore.setState({ next: null }); if (eligible) go("name"); else open("eligible"); }}>Get started</button>
      <button className="link" style={{ alignSelf: "center", marginTop: 4 }}
        onClick={() => { useStore.setState({ next: "home" }); open(eligible ? "wallet" : "eligible"); }}>
        I already have a pet
      </button>
    </section>
  );
}
