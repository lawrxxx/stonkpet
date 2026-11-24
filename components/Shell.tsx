"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { NEEDS_PLAN, SCREENS, TABS, useGo, type Screen } from "./nav";
import { Icon } from "./Icon";
import { Sheets } from "./Sheets";
import { marketWeather, usePriceBoard } from "@/lib/prices";

export function useScreen(): Screen {
  const p = usePathname().replace(/^\//, "") || "welcome";
  return (SCREENS as readonly string[]).includes(p) ? (p as Screen) : "welcome";
}

function Tabs({ screen }: { screen: Screen }) {
  const go = useGo();
  const trimmed = useStore((s) => s.trimmed);
  return (
    <nav className={"tabs" + (TABS.includes(screen) ? " on" : "")} aria-label="Main">
      {TABS.map((t) => (
        <button key={t} className="tab" onClick={() => go(t)} aria-current={t === screen ? "page" : undefined}>
          {t === "chat" && trimmed === null && <span className="badge" aria-label="Needs your OK" />}
          <Icon name={t as "home" | "chat" | "portfolio"} size={24} />
          {t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const screen = useScreen();
  const ready = useStore((s) => s.ready);
  const sheet = useStore((s) => s.sheet);
  const wx = useStore((s) => s.wx);
  const eligible = useStore((s) => s.eligible);
  const go = useGo();
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => useStore.setState({ ready: true }));
  }, []);

  // Deep links: gate on the 18+ / region check, and build a plan if a screen needs one.
  useEffect(() => {
    if (!ready) return;
    if (!eligible && screen !== "welcome") { go("welcome"); return; }
    if (NEEDS_PLAN.includes(screen)) useStore.getState().ensurePlan();
  }, [ready, screen, eligible, go]);

  useEffect(() => {
    if (sheet) lastFocus.current = document.activeElement as HTMLElement;
    else lastFocus.current?.focus?.();
  }, [sheet]);

  // The weather is the market: live prices drive it unless the user is previewing.
  const board = usePriceBoard().data ?? null;
  const plan = useStore((s) => s.plan);
  const wxPreview = useStore((s) => s.wxPreview);
  useEffect(() => {
    const live = marketWeather(board, plan?.w);
    useStore.setState({ board, wx: wxPreview ?? live ?? "sun" });
  }, [board, plan, wxPreview]);

  const night = wx === "night" && TABS.concat("feed").includes(screen);
  return (
    <div className={"phone" + (night ? " night" : "") + (sheet ? " open" : "") + (TABS.includes(screen) ? " tabbed" : "")} id="app">
      {ready ? children : <section className="scr" aria-busy="true" />}
      <Tabs screen={screen} />
      <div className="scrim" onClick={() => useStore.getState().close()} />
      <Sheets />
    </div>
  );
}
