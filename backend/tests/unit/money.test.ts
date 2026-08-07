import { describe, expect, it } from "vitest";
import { allocateByWeights, centsToDollars, dollarsToCents } from "../../src/lib/money";

describe("dollarsToCents / centsToDollars", () => {
  it("round-trips exactly for clean amounts", () => {
    expect(dollarsToCents(10)).toBe(1000);
    expect(dollarsToCents(9.99)).toBe(999);
    expect(centsToDollars(1000)).toBe(10);
  });

  it("rounds floating-point noise instead of truncating it", () => {
    // 0.1 + 0.2 style IEEE-754 drift -- Math.round saves this, Math.floor wouldn't.
    expect(dollarsToCents(19.99 * 1)).toBe(1999);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });
});

describe("allocateByWeights", () => {
  it("splits evenly when it divides cleanly", () => {
    const result = allocateByWeights(3000, [
      { userId: 1, weight: 1 },
      { userId: 2, weight: 1 },
      { userId: 3, weight: 1 },
    ]);
    expect(result).toEqual([
      { userId: 1, shareCents: 1000 },
      { userId: 2, shareCents: 1000 },
      { userId: 3, shareCents: 1000 },
    ]);
  });

  it("distributes the leftover cent(s) instead of dropping them -- $10.00 / 3 sums to exactly $10.00", () => {
    const result = allocateByWeights(1000, [
      { userId: 1, weight: 1 },
      { userId: 2, weight: 1 },
      { userId: 3, weight: 1 },
    ]);
    const total = result.reduce((sum, r) => sum + r.shareCents, 0);
    expect(total).toBe(1000);
    // 1000/3 = 333.33.. -> two people get 333, one gets 334
    expect(result.map((r) => r.shareCents).sort()).toEqual([333, 333, 334]);
  });

  it("always sums to exactly the total for weighted (percentage-style) splits, including odd cent totals", () => {
    // 33.33% / 33.33% / 33.34% of $100.03 -- the case exercised in the
    // stage-3 smoke test that first motivated the largest-remainder method.
    const result = allocateByWeights(10003, [
      { userId: 1, weight: 33.33 },
      { userId: 2, weight: 33.33 },
      { userId: 3, weight: 33.34 },
    ]);
    const total = result.reduce((sum, r) => sum + r.shareCents, 0);
    expect(total).toBe(10003);
  });

  it("gives a single participant the entire amount", () => {
    const result = allocateByWeights(500, [{ userId: 1, weight: 1 }]);
    expect(result).toEqual([{ userId: 1, shareCents: 500 }]);
  });

  it("sums exactly to the total across randomized weights and totals", () => {
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(Math.random() * 10);
      const totalCents = Math.floor(Math.random() * 1_000_000);
      const weights = Array.from({ length: n }, (_, i) => ({
        userId: i + 1,
        weight: 1 + Math.random() * 100,
      }));
      const result = allocateByWeights(totalCents, weights);
      const sum = result.reduce((s, r) => s + r.shareCents, 0);
      expect(sum).toBe(totalCents);
      for (const r of result) expect(r.shareCents).toBeGreaterThanOrEqual(0);
    }
  });
});
