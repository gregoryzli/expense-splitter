// Every amount is stored and computed as integer cents. These are the only
// two points where the app should ever touch a fractional dollar amount:
// converting an incoming request field, and formatting an outgoing one.

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

interface Weighted {
  userId: number;
  weight: number;
}
interface Share {
  userId: number;
  shareCents: number;
}

/**
 * Splits totalCents among participants proportional to their weight
 * (equal weights for an EQUAL split, percentages for a PERCENTAGE split),
 * using the largest-remainder method so the shares always sum to exactly
 * totalCents -- naive `Math.round` per participant can drift a cent off
 * in either direction once you sum it back up.
 */
export function allocateByWeights(totalCents: number, weights: Weighted[]): Share[] {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  const withRemainders = weights.map((w) => {
    const exact = (totalCents * w.weight) / totalWeight;
    const floor = Math.floor(exact);
    return { userId: w.userId, floor, remainder: exact - floor };
  });

  const allocated = withRemainders.reduce((sum, w) => sum + w.floor, 0);
  const leftoverCents = totalCents - allocated;

  const byRemainderDesc = [...withRemainders].sort((a, b) => b.remainder - a.remainder);
  const bumped = new Set(byRemainderDesc.slice(0, leftoverCents).map((w) => w.userId));

  return withRemainders.map((w) => ({
    userId: w.userId,
    shareCents: w.floor + (bumped.has(w.userId) ? 1 : 0),
  }));
}
