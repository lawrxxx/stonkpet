/**
 * US equity market clock (NYSE regular session, America/New_York).
 * Tokenized-stock Chainlink feeds only update during market hours and hold the
 * last value otherwise, so this decides whether a price is "live" or "closed".
 *
 * Holidays and early closes are NYSE's published 2026–2027 calendar. Extend the
 * tables each year; an unknown year falls back to weekday/hours only.
 */
const HOLIDAYS = new Set([
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
/** Sessions that close at 13:00 ET. */
const EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const EARLY_MIN = 13 * 60;

type NyParts = { date: string; weekday: number; minutes: number };

/** Wall-clock parts in New York for an instant. */
export function nyParts(t: Date): NyParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(t).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: wd, minutes: +p.hour * 60 + +p.minute };
}

export const isTradingDay = (date: string, weekday: number) => weekday >= 1 && weekday <= 5 && !HOLIDAYS.has(date);
const closeMin = (date: string) => (EARLY_CLOSE.has(date) ? EARLY_MIN : CLOSE_MIN);

export type MarketState = {
  open: boolean;
  reason: "open" | "weekend" | "holiday" | "before-open" | "after-close";
  /** ISO time of the next open (when closed) or close (when open). */
  next: string;
};

/** Instant (UTC) for a New York wall-clock time on a given NY date. */
function nyInstant(date: string, minutes: number): Date {
  // Start from UTC guess and correct by the observed NY offset (handles DST).
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  const seen = nyParts(guess);
  const seenDay = seen.date === date ? 0 : seen.date < date ? -1 : 1;
  const diff = minutes - (seen.minutes + seenDay * 1440);
  return new Date(guess.getTime() + diff * 60_000);
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const weekdayOf = (date: string) => new Date(date + "T12:00:00Z").getUTCDay();

function nextOpen(fromDate: string, includeToday: boolean): Date {
  let d = includeToday ? fromDate : addDays(fromDate, 1);
  for (let i = 0; i < 14; i++, d = addDays(d, 1)) if (isTradingDay(d, weekdayOf(d))) return nyInstant(d, OPEN_MIN);
  return nyInstant(d, OPEN_MIN);
}

export function marketState(now = new Date()): MarketState {
  const { date, weekday, minutes } = nyParts(now);
  if (weekday === 0 || weekday === 6) return { open: false, reason: "weekend", next: nextOpen(date, false).toISOString() };
  if (HOLIDAYS.has(date)) return { open: false, reason: "holiday", next: nextOpen(date, false).toISOString() };
  if (minutes < OPEN_MIN) return { open: false, reason: "before-open", next: nyInstant(date, OPEN_MIN).toISOString() };
  if (minutes >= closeMin(date)) return { open: false, reason: "after-close", next: nextOpen(date, false).toISOString() };
  return { open: true, reason: "open", next: nyInstant(date, closeMin(date)).toISOString() };
}

/** Start of the most recent regular session that has opened (used to find "yesterday's close"). */
export function lastSessionOpen(now = new Date()): Date {
  const { date, weekday, minutes } = nyParts(now);
  let d = date;
  if (!(isTradingDay(date, weekday) && minutes >= OPEN_MIN)) d = addDays(d, -1);
  for (let i = 0; i < 14; i++, d = addDays(d, -1)) if (isTradingDay(d, weekdayOf(d))) return nyInstant(d, OPEN_MIN);
  return nyInstant(d, OPEN_MIN);
}

/** Chainlink heartbeat for these feeds is 24h; allow an hour of slack. */
export const HEARTBEAT_S = 24 * 3600;
export const STALE_AFTER_S = HEARTBEAT_S + 3600;

export type FeedStatus = "live" | "closed" | "stale" | "paused" | "missing";

/**
 * Whether a price can be traded against.
 * - live: market open and the feed has updated within its heartbeat
 * - closed: market closed; price is the last close (fine to value, not to trade)
 * - stale: market open but the feed stopped updating (frozen, e.g. a corporate action)
 * - paused: the API reports the token paused
 */
export function feedStatus(updatedAt: number | null, now: Date, market: MarketState, paused = false): FeedStatus {
  if (updatedAt === null) return "missing";
  if (paused) return "paused";
  if (!market.open) return "closed";
  return now.getTime() / 1000 - updatedAt > STALE_AFTER_S ? "stale" : "live";
}
export const canTrade = (s: FeedStatus) => s === "live";
