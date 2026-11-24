import { describe, expect, it } from "vitest";
import { canTrade, feedStatus, lastSessionOpen, marketState, STALE_AFTER_S } from "./market";

const at = (iso: string) => new Date(iso);

describe("marketState", () => {
  it("open on a normal Tuesday at 11:00 ET (EST)", () => {
    const s = marketState(at("2026-11-24T16:00:00Z")); // 11:00 EST
    expect(s.open).toBe(true);
    expect(s.next).toBe("2026-11-24T21:00:00.000Z"); // closes 16:00 EST
  });
  it("respects daylight saving (EDT in July)", () => {
    expect(marketState(at("2026-07-14T13:29:00Z")).open).toBe(false); // 09:29 EDT
    expect(marketState(at("2026-07-14T13:30:00Z")).open).toBe(true); // 09:30 EDT
    expect(marketState(at("2026-07-14T20:00:00Z")).reason).toBe("after-close"); // 16:00 EDT
  });
  it("closed on weekends, next open is Monday 9:30 ET", () => {
    const s = marketState(at("2026-11-28T15:00:00Z")); // Saturday
    expect(s).toMatchObject({ open: false, reason: "weekend", next: "2026-11-30T14:30:00.000Z" });
  });
  it("closed on Thanksgiving, opens Friday", () => {
    const s = marketState(at("2026-11-26T16:00:00Z"));
    expect(s).toMatchObject({ open: false, reason: "holiday", next: "2026-11-27T14:30:00.000Z" });
  });
  it("early close at 13:00 ET the day after Thanksgiving", () => {
    expect(marketState(at("2026-11-27T17:59:00Z")).open).toBe(true); // 12:59 EST
    expect(marketState(at("2026-11-27T18:00:00Z")).open).toBe(false); // 13:00 EST
  });
  it("before the open says so", () => {
    expect(marketState(at("2026-11-24T13:00:00Z")).reason).toBe("before-open");
  });
});

describe("lastSessionOpen", () => {
  it("is today's open during the session", () => {
    expect(lastSessionOpen(at("2026-11-24T16:00:00Z")).toISOString()).toBe("2026-11-24T14:30:00.000Z");
  });
  it("skips the weekend back to Friday", () => {
    expect(lastSessionOpen(at("2026-11-29T16:00:00Z")).toISOString()).toBe("2026-11-27T14:30:00.000Z");
  });
});

describe("feedStatus", () => {
  const open = marketState(at("2026-11-24T16:00:00Z"));
  const closed = marketState(at("2026-11-28T16:00:00Z"));
  const now = at("2026-11-24T16:00:00Z");
  const t = now.getTime() / 1000;
  it("live when open and fresh", () => {
    expect(feedStatus(t - 600, now, open)).toBe("live");
    expect(canTrade("live")).toBe(true);
  });
  it("stale when open but past the heartbeat (frozen feed)", () => {
    expect(feedStatus(t - STALE_AFTER_S - 1, now, open)).toBe("stale");
    expect(canTrade("stale")).toBe(false);
  });
  it("closed outside market hours, never tradable", () => {
    expect(feedStatus(t - 60, now, closed)).toBe("closed");
    expect(canTrade("closed")).toBe(false);
  });
  it("paused and missing are never tradable", () => {
    expect(feedStatus(t, now, open, true)).toBe("paused");
    expect(feedStatus(null, now, open)).toBe("missing");
  });
});
