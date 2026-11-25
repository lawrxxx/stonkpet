"use client";
import { Icon } from "@/components/Icon";
import { Pet } from "@/components/Pet";
import { SceneSvg } from "@/components/Scene";
import { useGo } from "@/components/nav";
import { opensWhen, pct, planDayChange } from "@/lib/prices";
import { nm, useStore, type Wx } from "@/lib/store";

/** Tapping the label previews other weather, then returns to live. */
const CYCLE: (Wx | null)[] = [null, "sun", "rain", "night"];
const LBL = { sun: "Sunny · market's up", rain: "Rainy · rough day", night: "Night · market's closed" };

function Level({ n }: { n: number }) {
  return (
    <span className="t-small muted row-x gap-2">
      Lv {n}
      <span className="leaves" role="img" aria-label={`Level ${n} of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10 11 5 20 4c0 9-5 15-14 15z" fill={i <= n ? "var(--leaf)" : "var(--line)"} /></svg>
        ))}
      </span>
    </span>
  );
}

export default function Home() {
  const s = useStore();
  const go = useGo();
  const w = s.wx;
  const b = s.board;
  const today = b && s.plan ? planDayChange(b, s.plan.w) : null;
  const preview = s.wxPreview !== null;
  const mood = {
    sun: "Feeling good. Fed 4 weeks in a row.",
    rain: "A bit gloomy. Holding steady, not panicking.",
    night: s.auto.afterHours
      ? "Night, but I'm awake. After-hours trading is on, so I can still eat at exchange prices."
      : b && !preview ? `Asleep. The market opens ${opensWhen(b)}, so no trades till then.` : "Asleep. Prices freeze at night, so no trades till morning.",
  }[w];
  const label = preview ? `${LBL[w]} · preview` : b ? LBL[w] : "Checking the market…";

  return (
    <section className="scr" aria-label="Home">
      <div className={"scene fluid" + (w === "night" ? " sleep" : "")}>
        <SceneSvg w={w} />
        <div className="pet"><Pet mood={w === "night" ? (s.auto.afterHours ? "idle" : "sleep") : w === "rain" ? "sad" : "happy"} size={150} /></div>
        <button className="lbl" onClick={() => s.set({ wxPreview: CYCLE[(CYCLE.indexOf(s.wxPreview) + 1) % CYCLE.length] })}
          aria-label={`${label}. Tap to preview other weather.`}>
          {label}<Icon name="refresh" size={14} stroke={2.4} />
        </button>
        <button className="icon-btn" onClick={() => s.open("share")} aria-label="Share your pet"><Icon name="share" /></button>
      </div>

      <div className="between mt-5 tight">
        <h1 className="t-title">{nm(s)}</h1>
        <Level n={3} />
      </div>
      <p className="mt-1">{mood}</p>

      <div className="card stat mt-4">
        <span><span className="k">Worth · sample</span><span className="num t-heading">${s.total.toFixed(2)}</span></span>
        <span className="center" style={{ textAlign: "right" }}>
          <span className="k">{b && !b.market.open ? "Last session" : "Today"}</span>
          <span className={"num t-heading " + (today === null ? "muted" : today < 0 ? "down" : "up")}>{today === null ? "—" : pct(today)}</span>
        </span>
      </div>

      <div className="grow" style={{ minHeight: 16 }} />
      <button className="quiet" onClick={() => s.open("note")}>
        <span className="dot" aria-hidden="true" /><span className="grow">{nm(s)} left you a note</span><Icon name="chevron" size={18} />
      </button>
      <button className="btn mt-3" onClick={() => go("feed")}>Feed {nm(s)}</button>
    </section>
  );
}
