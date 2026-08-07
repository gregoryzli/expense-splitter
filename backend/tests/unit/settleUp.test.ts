import { describe, expect, it } from "vitest";
import { computeSettlement, type Balance, type Payment } from "../../src/services/settleUp";

function netEffect(payments: Payment[]): Map<number, number> {
  const net = new Map<number, number>();
  const add = (userId: number, delta: number) => net.set(userId, (net.get(userId) ?? 0) + delta);
  for (const p of payments) {
    add(p.fromUserId, p.amountCents); // paying reduces debt -> balance moves toward zero (up)
    add(p.toUserId, -p.amountCents); // getting paid reduces what you're owed -> balance moves toward zero (down)
  }
  return net;
}

/** Applying every payment should bring every balance to exactly zero. */
function expectFullySettled(balances: Balance[], payments: Payment[]) {
  const net = netEffect(payments);
  for (const b of balances) {
    expect(b.balanceCents + (net.get(b.userId) ?? 0)).toBe(0);
  }
}

describe("computeSettlement", () => {
  it("returns no payments when everyone is already at zero", () => {
    const balances: Balance[] = [
      { userId: 1, balanceCents: 0 },
      { userId: 2, balanceCents: 0 },
    ];
    expect(computeSettlement(balances)).toEqual([]);
  });

  it("returns no payments for an empty group", () => {
    expect(computeSettlement([])).toEqual([]);
  });

  it("settles a simple two-person debt in one payment", () => {
    const balances: Balance[] = [
      { userId: 1, balanceCents: 5000 },
      { userId: 2, balanceCents: -5000 },
    ];
    const payments = computeSettlement(balances);
    expect(payments).toEqual([{ fromUserId: 2, toUserId: 1, amountCents: 5000 }]);
  });

  it("collapses a three-person group into n-1 = 2 payments (the case verified by hand against the live API)", () => {
    // Mirrors the exact scenario exercised in stage 3's manual smoke test:
    // Alice -3.34, Bob -33.34, Carol +36.68 (in cents).
    const balances: Balance[] = [
      { userId: 1, balanceCents: -334 },
      { userId: 2, balanceCents: -3334 },
      { userId: 3, balanceCents: 3668 },
    ];
    const payments = computeSettlement(balances);
    expect(payments).toHaveLength(2);
    expect(payments).toEqual(
      expect.arrayContaining([
        { fromUserId: 2, toUserId: 3, amountCents: 3334 },
        { fromUserId: 1, toUserId: 3, amountCents: 334 },
      ])
    );
    expectFullySettled(balances, payments);
  });

  it("pairs off same-magnitude opposite balances optimally (2 payments, not 3)", () => {
    // [+30, +30, -30, -30] can be settled in exactly 2 payments by pairing
    // matching magnitudes -- this is a case where greedy happens to find
    // the true optimum, not just the n-1 upper bound.
    const balances: Balance[] = [
      { userId: 1, balanceCents: 3000 },
      { userId: 2, balanceCents: 3000 },
      { userId: 3, balanceCents: -3000 },
      { userId: 4, balanceCents: -3000 },
    ];
    const payments = computeSettlement(balances);
    expect(payments).toHaveLength(2);
    expectFullySettled(balances, payments);
  });

  it("ignores members who are already settled (balance 0) mixed in with active ones", () => {
    const balances: Balance[] = [
      { userId: 1, balanceCents: 1000 },
      { userId: 2, balanceCents: -1000 },
      { userId: 3, balanceCents: 0 },
    ];
    const payments = computeSettlement(balances);
    expect(payments).toEqual([{ fromUserId: 2, toUserId: 1, amountCents: 1000 }]);
  });

  it("never produces more than n-1 payments and never leaves anyone unsettled, across random balance sets", () => {
    // Property-based rather than example-based: these invariants must hold
    // for ANY set of integer balances that sums to zero, so there's no
    // fixed seed to pin -- a failure here always indicates a real bug,
    // never a flaky one.
    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(Math.random() * 8); // 2..9 people
      const balances: Balance[] = Array.from({ length: n - 1 }, (_, i) => ({
        userId: i + 1,
        balanceCents: Math.floor(Math.random() * 20000) - 10000, // -10000..9999
      }));
      const runningTotal = balances.reduce((sum, b) => sum + b.balanceCents, 0);
      balances.push({ userId: n, balanceCents: -runningTotal }); // forces sum to exactly 0

      const payments = computeSettlement(balances);

      expect(payments.length).toBeLessThanOrEqual(n - 1);
      expectFullySettled(balances, payments);
      for (const p of payments) {
        expect(p.amountCents).toBeGreaterThan(0);
        expect(p.fromUserId).not.toBe(p.toUserId);
      }
    }
  });
});
