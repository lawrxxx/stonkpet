"use client";
import { Pet } from "@/components/Pet";
import { SceneSvg } from "@/components/Scene";
import { useGo } from "@/components/nav";
import { opensWhen, pct, planDayChange } from "@/lib/prices";
import { nm, useStore, type Wx } from "@/lib/store";

/** Tapping the label previews other weather, then returns to live. */
const CYCLE: (Wx | null)[] = [null, "sun", "rain", "night"];
const LBL = { sun: "Sunny · market's up", rain: "Rainy · rough day", night: "Night · market's closed" };

export default function Home() {
  const s = useStore();
  const go = useGo();
  const w = s.wx;
  const b = s.board;
  const today = b && s.plan ? planDayChange(b, s.plan.w) : null;
  const preview = s.wxPreview !== null;
  const mood = {
    sun: "Feeling great. Fed 4 weeks in a row.",
    rain: "A bit gloomy. Holding steady, not panicking.",
    night: b && !preview ? `Asleep. The market opens ${opensWhen(b)}, so no trades till then.` : "Asleep. Prices freeze at night, so no trades till morning.",
  }[w];
  const label = preview ? `${LBL[w]} · preview` : b ? LBL[w] : "Checking the market…";

  return (
    <section className="scr on" aria-label="Home">
      <div className={"scene fluid" + (w === "night" ? " sleep" : "")}>
        <SceneSvg w={w} />
        <div className="pet"><Pet mood={w === "night" ? "sleep" : w === "rain" ? "sad" : "happy"} size={150} /></div>
        <button className="lbl" onClick={() => s.set({ wxPreview: CYCLE[(CYCLE.indexOf(s.wxPreview) + 1) % CYCLE.length] })}
          aria-label={`${label}. Tap to preview other weather.`}>
          {label}  ↻
        </button>
        <button className="ib" onClick={() => s.open("share")} aria-label="Share your pet">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        </button>
      </div>
      <div className="tight" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
        <h1 style={{ fontSize: 30 }}>{nm(s)}</h1>
        <span className="sm mut" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Lv 3{" "}
          <span className="leaves" role="img" aria-label="Level 3 of 5">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg key={i} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10 11 5 20 4c0 9-5 15-14 15z" fill={i <= 3 ? "#3DBE7E" : "#E3DACA"} /></svg>
            ))}
          </span>
        </span>
      </div>
      <p style={{ fontSize: 16, marginTop: 2 }}>{mood}</p>
      <div className="list" style={{ marginTop: 16, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span><span className="mut sm" style={{ display: "block" }}>Worth · sample</span><span className="big" style={{ fontSize: 24 }}>${s.total.toFixed(2)}</span></span>
        <span style={{ textAlign: "right" }}>
          <span className="mut sm" style={{ display: "block" }}>{b && !b.market.open ? "Last session" : "Today"}</span>
          <span className={today === null ? "mut" : today < 0 ? "down" : "up"} style={{ font: "600 22px Fredoka,system-ui,sans-serif" }}>
            {today === null ? "—" : pct(today)}
          </span>
        </span>
      </div>
      <div className="grow" style={{ minHeight: 14 }} />
      <button className="quiet" onClick={() => s.open("note")}>
        <span className="dot" aria-hidden="true" /><span className="grow" style={{ textAlign: "left" }}>{nm(s)} left you a note</span><span className="chev" aria-hidden="true">›</span>
      </button>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => go("feed")}>Feed {nm(s)}</button>
    </section>
  );
}
