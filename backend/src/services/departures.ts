import { prisma } from "../lib/prisma";
import { AppError } from "../lib/AppError";
import { getGroupBalances } from "./balances";
import { computeSettlement } from "./settleUp";
import type { DepartureResolution } from "@prisma/client";

/**
 * Removes a user from a group. Always succeeds immediately, regardless of
 * balance -- if they still had a nonzero balance, records an
 * UnresolvedDeparture snapshot so the gap is visible and fixable instead of
 * silently vanishing. getGroupBalances only returns rows for *current*
 * members, so deleting the membership without recording anything would just
 * drop their debt/credit off the group's numbers with no trace.
 *
 * Disbands the group if this was the last member, same as before.
 */
export async function leaveGroup(groupId: number, userId: number) {
  const balances = await getGroupBalances(groupId);
  const target = balances.find((b) => b.userId === userId);

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.groupMember.deleteMany({ where: { groupId, userId } });
    if (deleted.count === 0) {
      throw AppError.notFound("That user isn't a member of this group");
    }

    if (target && target.balanceCents !== 0) {
      await tx.unresolvedDeparture.create({
        data: { groupId, userId, balanceCents: target.balanceCents },
      });
    }

    const remaining = await tx.groupMember.count({ where: { groupId } });
    if (remaining === 0) {
      // Group/Expense/Settlement/UnresolvedDeparture all cascade-delete
      // their children, so this one call cleans everything up, including
      // the departure record just created above if this was a solo group.
      await tx.group.delete({ where: { id: groupId } });
    }
  });
}

/**
 * Settles a departed member's frozen balance onto the group's current
 * members, then marks the departure resolved. Two ways to do it:
 *
 * - WRITE_OFF: treat it as if the departed member actually paid/collected
 *   what they owed. Computed via the same minimum-transaction algorithm used
 *   for live settle-up suggestions, run against current balances plus every
 *   still-unresolved departed member's frozen balance (not just this one) --
 *   that combined set always sums to exactly zero, which guarantees a full
 *   pairing exists and this departure's share of it can be isolated cleanly
 *   even if other departures are sitting unresolved at the same time.
 * - ABSORB_EVEN: split the departed balance evenly across every current
 *   member, regardless of who specifically was owed what. Simpler and more
 *   predictable than tracing exact fault, at the cost of not being the
 *   strictly fairest split.
 *
 * Either way the effect is recorded as ordinary CONFIRMED settlements (with
 * a `note` explaining they're synthetic) so the balance math downstream
 * doesn't need to know resolutions are a special case.
 */
export async function resolveDeparture(
  groupId: number,
  departureId: number,
  resolverUserId: number,
  resolution: DepartureResolution
) {
  const departure = await prisma.unresolvedDeparture.findFirst({
    where: { id: departureId, groupId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!departure) {
    throw AppError.notFound("Departure not found");
  }
  if (departure.resolvedAt) {
    throw AppError.conflict("This departure has already been resolved", "ALREADY_RESOLVED");
  }

  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  if (members.length === 0) {
    throw AppError.unprocessable("No remaining members to resolve this against", "NO_MEMBERS");
  }

  const note =
    resolution === "WRITE_OFF"
      ? `${departure.user.name}'s balance was written off after they left the group`
      : `${departure.user.name}'s balance was absorbed evenly by the remaining members after they left`;

  type NewSettlement = {
    groupId: number;
    fromUserId: number;
    toUserId: number;
    amountCents: number;
    status: "CONFIRMED";
    initiatedById: number;
    confirmedAt: Date;
    note: string;
  };
  const settlementsData: NewSettlement[] = [];

  if (resolution === "WRITE_OFF") {
    const [currentBalances, otherUnresolved] = await Promise.all([
      getGroupBalances(groupId),
      prisma.unresolvedDeparture.findMany({
        where: { groupId, resolvedAt: null, id: { not: departure.id } },
        select: { userId: true, balanceCents: true },
      }),
    ]);
    const combined = [
      ...currentBalances.map((b) => ({ userId: b.userId, balanceCents: b.balanceCents })),
      { userId: departure.userId, balanceCents: departure.balanceCents },
      ...otherUnresolved.map((d) => ({ userId: d.userId, balanceCents: d.balanceCents })),
    ];
    const payments = computeSettlement(combined).filter(
      (p) => p.fromUserId === departure.userId || p.toUserId === departure.userId
    );
    for (const p of payments) {
      settlementsData.push({
        groupId,
        fromUserId: p.fromUserId,
        toUserId: p.toUserId,
        amountCents: p.amountCents,
        status: "CONFIRMED",
        initiatedById: resolverUserId,
        confirmedAt: new Date(),
        note,
      });
    }
  } else {
    const n = members.length;
    const total = Math.abs(departure.balanceCents);
    const shareBase = Math.floor(total / n);
    const remainder = total - shareBase * n;

    members.forEach((m, i) => {
      const amountCents = shareBase + (i < remainder ? 1 : 0);
      if (amountCents === 0) return;
      settlementsData.push(
        departure.balanceCents < 0
          ? {
              groupId,
              fromUserId: departure.userId,
              toUserId: m.userId,
              amountCents,
              status: "CONFIRMED",
              initiatedById: resolverUserId,
              confirmedAt: new Date(),
              note,
            }
          : {
              groupId,
              fromUserId: m.userId,
              toUserId: departure.userId,
              amountCents,
              status: "CONFIRMED",
              initiatedById: resolverUserId,
              confirmedAt: new Date(),
              note,
            }
      );
    });
  }

  await prisma.$transaction([
    ...settlementsData.map((data) => prisma.settlement.create({ data })),
    prisma.unresolvedDeparture.update({
      where: { id: departure.id },
      data: { resolvedAt: new Date(), resolvedById: resolverUserId, resolutionType: resolution },
    }),
  ]);
}
