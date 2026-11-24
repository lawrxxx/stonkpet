"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useStore } from "@/lib/store";

export const SCREENS = ["welcome", "name", "pers", "brief", "rules", "think", "proposal", "home", "feed", "chat", "portfolio"] as const;
export type Screen = (typeof SCREENS)[number];
export const TABS: Screen[] = ["home", "chat", "portfolio"];
export const NEEDS_PLAN: Screen[] = ["proposal", "home", "feed", "chat", "portfolio"];
export const path = (s: Screen) => (s === "welcome" ? "/" : "/" + s);

/** The demo's go(): builds a plan if needed, closes any sheet, then navigates. */
export function useGo() {
  const router = useRouter();
  return useCallback(
    (s: Screen) => {
      const st = useStore.getState();
      if (NEEDS_PLAN.includes(s)) st.ensurePlan();
      st.close();
      router.push(path(s));
    },
    [router],
  );
}
