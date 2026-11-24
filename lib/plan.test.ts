import { describe, expect, it } from "vitest";
import { buildPlan, cashOf, fit } from "./plan";

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("fit", () => {
  it("never puts anything over the max", () => {
    const w = fit({ A: 60, B: 30, C: 10 }, 40);
    for (const v of Object.values(w)) expect(v).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(sum(w)).toBeCloseTo(1);
  });
  it("leaves the rest in USDC when the max makes a full plan impossible", () => {
    const w = fit({ A: 1, B: 1, C: 1 }, 25);
    expect(Object.values(w).every((v) => Math.abs(v - 0.25) < 1e-9)).toBe(true);
    expect(cashOf(w)).toBeCloseTo(0.25);
  });
  it("keeps proportions among holdings with room", () => {
    const w = fit({ A: 50, B: 20, C: 10 }, 50);
    expect(w.B / w.C).toBeCloseTo(2);
  });
});

describe("buildPlan", () => {
  it("parses the demo brief", () => {
    const p = buildPlan("AI and robots. Skip Tesla.", 30);
    expect(p.diet).toBe("ai");
    expect(p.robot).toBe(true);
    expect(p.excl).toEqual(["TSLA"]);
    expect(Object.keys(p.w)).toEqual(["NVDA", "MSFT", "GOOGL", "META"]);
  });
  it("drops excluded stocks and holds cash when the pool can't fill the max", () => {
    const p = buildPlan("Spicy stuff. Skip crypto.", 25);
    expect(p.w.MSTR).toBeUndefined();
    expect(p.cash).toBeCloseTo(0.5);
  });
});
