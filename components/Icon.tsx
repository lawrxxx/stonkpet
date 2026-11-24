/** One stroke-icon set (24px grid, 2px stroke) so arrows, checks and tabs render the same on every device. */
const PATHS = {
  back: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  refresh: "M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5",
  send: "M12 19V5M6 11l6-6 6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 7v6M12 17h.01",
  share: "M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  plus: "M12 5v14M5 12h14",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z",
  portfolio: "M4 20V10M10 20V4M16 20v-7M22 20H2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
