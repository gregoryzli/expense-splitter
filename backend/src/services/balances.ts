import { prisma } from "../lib/prisma";
import type { Balance } from "./settleUp";

export interface MemberBalance extends Balance {
  name: string;
  email: string;
}

/**
 * Net balance per group member: (amount they've paid across all expenses)
 * minus (sum of their shares across all expenses) plus/minus settlements
 * already recorded against them. Positive = owed money, negative = owes.
 *
 * This is computed from the ExpenseSplit rows saved at expense-creation
 * time, not re-derived from amount / participantCount -- that's what keeps
 * unequal/percentage splits correct here for free.
 *
 * Only CONFIRMED settlements count here -- a settlement starts PENDING
 * until the counterparty confirms it, specifically so a bad-faith (or
 * mistaken) "mark as paid" can't shrink what someone owes before the other
 * side has verified the payment actually happened.
 */
export async function getGroupBalances(groupId: number): Promise<MemberBalance[]> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });

  const balanceCents = new Map<number, number>(members.map((m) => [m.user.id, 0]));

  const [paidTotals, owedTotals, settlementsOut, settlementsIn] = await Promise.all([
    prisma.expense.groupBy({
      by: ["paidById"],
      where: { groupId },
      _sum: { amountCents: true },
    }),
    prisma.expenseSplit.groupBy({
      by: ["userId"],
      where: { expense: { groupId } },
      _sum: { shareCents: true },
    }),
    prisma.settlement.groupBy({
      by: ["fromUserId"],
      where: { groupId, status: "CONFIRMED" },
      _sum: { amountCents: true },
    }),
    prisma.settlement.groupBy({
      by: ["toUserId"],
      where: { groupId, status: "CONFIRMED" },
      _sum: { amountCents: true },
    }),
  ]);

  const add = (userId: number, delta: number) =>
    balanceCents.set(userId, (balanceCents.get(userId) ?? 0) + delta);

  for (const row of paidTotals) add(row.paidById, row._sum.amountCents ?? 0);
  for (const row of owedTotals) add(row.userId, -(row._sum.shareCents ?? 0));
  // Paying off a debt raises your balance toward zero (less negative).
  for (const row of settlementsOut) add(row.fromUserId, row._sum.amountCents ?? 0);
  // Receiving a payment lowers your balance toward zero (less positive).
  for (const row of settlementsIn) add(row.toUserId, -(row._sum.amountCents ?? 0));

  return members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    balanceCents: balanceCents.get(m.user.id) ?? 0,
  }));
}
