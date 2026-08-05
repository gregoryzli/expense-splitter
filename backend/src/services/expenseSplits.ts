import { allocateByWeights, dollarsToCents } from "../lib/money";
import { AppError } from "../lib/AppError";
import type { CreateExpenseInput } from "../schemas/expense.schema";

export interface ComputedSplit {
  userId: number;
  shareCents: number;
}

const PERCENTAGE_SUM_TOLERANCE = 0.01;

/**
 * Turns the request's split instructions into concrete per-person cent
 * shares that sum to exactly amountCents. Only shape validation (zod) has
 * happened before this; the checks here are semantic (422, not 400) --
 * e.g. "your custom amounts don't add up to the total".
 */
export function buildExpenseSplits(input: CreateExpenseInput, amountCents: number): ComputedSplit[] {
  if (input.splitType === "EQUAL") {
    const participantIds = [...new Set(input.participantIds)];
    return allocateByWeights(
      amountCents,
      participantIds.map((userId) => ({ userId, weight: 1 }))
    );
  }

  const splits = input.splits!;
  const userIds = splits.map((s) => s.userId);
  if (new Set(userIds).size !== userIds.length) {
    throw AppError.unprocessable("Each person can only appear once in splits", "DUPLICATE_SPLIT_USER");
  }

  if (input.splitType === "EXACT") {
    const shareCents = splits.map((s) => ({ userId: s.userId, shareCents: dollarsToCents(s.value) }));
    const sum = shareCents.reduce((total, s) => total + s.shareCents, 0);
    if (sum !== amountCents) {
      throw AppError.unprocessable(
        `Split amounts must add up to the total (got ${(sum / 100).toFixed(2)}, expected ${(amountCents / 100).toFixed(2)})`,
        "SPLIT_MISMATCH"
      );
    }
    return shareCents;
  }

  // PERCENTAGE
  const percentSum = splits.reduce((total, s) => total + s.value, 0);
  if (Math.abs(percentSum - 100) > PERCENTAGE_SUM_TOLERANCE) {
    throw AppError.unprocessable(
      `Split percentages must add up to 100 (got ${percentSum.toFixed(2)})`,
      "SPLIT_MISMATCH"
    );
  }
  return allocateByWeights(
    amountCents,
    splits.map((s) => ({ userId: s.userId, weight: s.value }))
  );
}
