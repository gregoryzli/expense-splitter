export interface Balance {
  userId: number;
  /** Net balance in cents. Positive = this person is owed money (creditor).
   *  Negative = this person owes money (debtor). Zero = settled up. */
  balanceCents: number;
}

export interface Payment {
  fromUserId: number;
  toUserId: number;
  amountCents: number;
}

/**
 * Computes the minimum-transaction settlement plan for a group.
 *
 * The exact minimum number of payments is NP-hard in general: it's
 * equivalent to partitioning the balances into the fewest possible subsets
 * that each sum to zero, and even deciding whether one such subset exists
 * is the subset-sum problem. There's no known polynomial algorithm for the
 * true optimum.
 *
 * What's implemented here -- and what production tools like Splitwise use
 * -- is a greedy heuristic: repeatedly settle the largest creditor against
 * the largest debtor for whichever amount is smaller, then repeat. This is
 * O(n log n) (a sort, then a single O(n) merge pass), and it guarantees at
 * most n - 1 payments for n participants with a nonzero balance -- which is
 * also the worst-case lower bound (balances can be constructed that
 * genuinely require n - 1 payments), so the heuristic is asymptotically
 * tight even on inputs where it isn't the exact optimum.
 *
 * It stops being exactly optimal only when some strict subset of balances
 * happens to sum to zero on its own in a way the greedy pairing doesn't
 * discover -- e.g. specific balance combinations where an exact
 * (exponential) subset-sum search could shave off one more transaction.
 * For a realistic group size that's a fine trade: correctness and speed
 * over a marginally shorter payment list.
 */
export function computeSettlement(balances: Balance[]): Payment[] {
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ userId: b.userId, amountCents: b.balanceCents }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ userId: b.userId, amountCents: -b.balanceCents }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const payments: Payment[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    // Bounds are guaranteed by the loop condition; noUncheckedIndexedAccess
    // just can't see that through two independent counters.
    const creditor = creditors[i]!;
    const debtor = debtors[j]!;

    const amountCents = Math.min(creditor.amountCents, debtor.amountCents);
    payments.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountCents });

    creditor.amountCents -= amountCents;
    debtor.amountCents -= amountCents;

    if (creditor.amountCents === 0) i++;
    if (debtor.amountCents === 0) j++;
  }

  return payments;
}
