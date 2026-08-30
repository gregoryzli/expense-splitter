import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/AppError";
import { requireAuth } from "../middleware/auth";
import { requireGroupMember } from "../middleware/groupMembership";
import { validate } from "../middleware/validate";
import { addMemberSchema, createGroupSchema, updateGroupSchema } from "../schemas/group.schema";
import { createExpenseSchema } from "../schemas/expense.schema";
import { createSettlementSchema } from "../schemas/settlement.schema";
import { dollarsToCents, centsToDollars } from "../lib/money";
import { buildExpenseSplits } from "../services/expenseSplits";
import { getGroupBalances } from "../services/balances";
import { computeSettlement } from "../services/settleUp";
import { leaveGroup, resolveDeparture } from "../services/departures";
import { resolveDepartureSchema } from "../schemas/departure.schema";

const router = Router();
router.use(requireAuth);

const memberSelect = { select: { id: true, name: true, email: true } } as const;

router.get("/", async (req, res) => {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: req.user!.id } } },
    include: { members: { include: { user: memberSelect } } },
    orderBy: { createdAt: "desc" },
  });

  // One balance query per group, run in parallel -- fine at portfolio scale
  // (a handful of groups per user), and it's what lets the group list show
  // "you owe $12" at a glance instead of a second round trip per group.
  const balances = await Promise.all(groups.map((g) => getGroupBalances(g.id)));

  res.json(
    groups.map((g, i) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      currency: g.currency,
      createdById: g.createdById,
      createdAt: g.createdAt,
      members: g.members.map((m) => m.user),
      yourBalance: centsToDollars(balances[i]!.find((b) => b.userId === req.user!.id)?.balanceCents ?? 0),
    }))
  );
});

router.post("/", validate(createGroupSchema), async (req, res) => {
  const { name, description, currency, memberEmails } = req.body;

  let invitedUsers: { id: number; email: string }[] = [];
  if (memberEmails.length > 0) {
    invitedUsers = await prisma.user.findMany({
      where: { email: { in: memberEmails }, deletedAt: null },
      select: { id: true, email: true },
    });
    const foundEmails = new Set(invitedUsers.map((u) => u.email));
    const notFound = memberEmails.filter((e: string) => !foundEmails.has(e));
    if (notFound.length > 0) {
      throw AppError.unprocessable(
        `No account found for: ${notFound.join(", ")}`,
        "MEMBER_NOT_FOUND"
      );
    }
  }

  const memberIds = [...new Set([req.user!.id, ...invitedUsers.map((u) => u.id)])];

  const group = await prisma.group.create({
    data: {
      name,
      description,
      currency,
      createdById: req.user!.id,
      members: { create: memberIds.map((userId) => ({ userId })) },
    },
    include: { members: { include: { user: memberSelect } } },
  });

  res.status(201).json({
    id: group.id,
    name: group.name,
    description: group.description,
    currency: group.currency,
    createdById: group.createdById,
    createdAt: group.createdAt,
    members: group.members.map((m) => m.user),
  });
});

router.get("/:groupId", requireGroupMember, async (req, res) => {
  const groupId = Number(req.params.groupId);

  const [group, balances] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      include: { members: { include: { user: memberSelect } } },
    }),
    getGroupBalances(groupId),
  ]);

  res.json({
    id: group.id,
    name: group.name,
    description: group.description,
    currency: group.currency,
    createdById: group.createdById,
    createdAt: group.createdAt,
    members: group.members.map((m) => m.user),
    balances: balances.map((b) => ({ ...b, balance: centsToDollars(b.balanceCents) })),
  });
});

router.patch("/:groupId", requireGroupMember, validate(updateGroupSchema), async (req, res) => {
  if (req.group!.createdById !== req.user!.id) {
    throw AppError.forbidden("Only the group creator can edit this group");
  }
  const group = await prisma.group.update({
    where: { id: req.group!.id },
    data: req.body,
  });
  res.json(group);
});

router.post("/:groupId/members", requireGroupMember, validate(addMemberSchema), async (req, res) => {
  const groupId = req.group!.id;
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || user.deletedAt) {
    throw AppError.notFound("No account with that email", "USER_NOT_FOUND");
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (existing) {
    throw AppError.conflict("This person is already in the group", "ALREADY_MEMBER");
  }

  await prisma.groupMember.create({ data: { groupId, userId: user.id } });
  res.status(201).json({ id: user.id, name: user.name, email: user.email });
});

router.delete("/:groupId/members/:userId", requireGroupMember, async (req, res) => {
  const groupId = req.group!.id;
  const targetUserId = Number(req.params.userId);
  const isSelf = targetUserId === req.user!.id;
  const isCreator = req.group!.createdById === req.user!.id;

  // The creator can leave (isSelf) like any other member -- see the
  // group-disband branch below. Nobody else can remove them: the check
  // above already requires isSelf or isCreator, and isCreator can only
  // ever target someone other than themself here, so there's no path
  // for a non-creator to reach the creator's own membership row.
  if (!isSelf && !isCreator) {
    throw AppError.forbidden("Only the group creator can remove other members");
  }

  // Leaving always succeeds, even with a nonzero balance -- see
  // services/departures.ts for how that balance gets tracked instead of
  // silently disappearing from the group's ledger.
  await leaveGroup(groupId, targetUserId);

  res.status(204).send();
});

router.get("/:groupId/departures", requireGroupMember, async (req, res) => {
  const departures = await prisma.unresolvedDeparture.findMany({
    where: { groupId: req.group!.id },
    include: { user: memberSelect, resolvedBy: memberSelect },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    departures.map((d) => ({
      id: d.id,
      user: d.user,
      balance: centsToDollars(d.balanceCents),
      createdAt: d.createdAt,
      resolvedAt: d.resolvedAt,
      resolvedBy: d.resolvedBy,
      resolutionType: d.resolutionType,
    }))
  );
});

router.post(
  "/:groupId/departures/:departureId/resolve",
  requireGroupMember,
  validate(resolveDepartureSchema),
  async (req, res) => {
    const groupId = req.group!.id;
    const departureId = Number(req.params.departureId);
    await resolveDeparture(groupId, departureId, req.user!.id, req.body.resolution);
    res.status(204).send();
  }
);

router.get("/:groupId/balances", requireGroupMember, async (req, res) => {
  const balances = await getGroupBalances(req.group!.id);
  res.json(balances.map((b) => ({ ...b, balance: centsToDollars(b.balanceCents) })));
});

router.get("/:groupId/settlements/suggestions", requireGroupMember, async (req, res) => {
  const balances = await getGroupBalances(req.group!.id);
  const byUserId = new Map(balances.map((b) => [b.userId, b]));

  const payments = computeSettlement(balances);

  res.json(
    payments.map((p) => ({
      fromUserId: p.fromUserId,
      fromName: byUserId.get(p.fromUserId)?.name,
      toUserId: p.toUserId,
      toName: byUserId.get(p.toUserId)?.name,
      amount: centsToDollars(p.amountCents),
    }))
  );
});

router.get("/:groupId/settlements", requireGroupMember, async (req, res) => {
  const settlements = await prisma.settlement.findMany({
    where: { groupId: req.group!.id },
    include: { fromUser: memberSelect, toUser: memberSelect },
    orderBy: { settledAt: "desc" },
  });
  res.json(
    settlements.map((s) => ({
      id: s.id,
      fromUser: s.fromUser,
      toUser: s.toUser,
      amount: centsToDollars(s.amountCents),
      status: s.status,
      initiatedById: s.initiatedById,
      settledAt: s.settledAt,
      confirmedAt: s.confirmedAt,
      note: s.note,
    }))
  );
});

// Creates a settlement as PENDING -- it does not affect balances (see
// services/balances.ts) until the counterparty confirms it below. Either
// party can initiate; whoever doesn't is the one who needs to confirm.
router.post("/:groupId/settlements", requireGroupMember, validate(createSettlementSchema), async (req, res) => {
  const groupId = req.group!.id;
  const { fromUserId, toUserId, amount } = req.body;

  if (req.user!.id !== fromUserId && req.user!.id !== toUserId) {
    throw AppError.forbidden("You can only record settlements you're a party to");
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: [fromUserId, toUserId] } },
  });
  if (members.length !== 2) {
    throw AppError.unprocessable("Both users must be members of this group", "NOT_A_MEMBER");
  }

  const settlement = await prisma.settlement.create({
    data: {
      groupId,
      fromUserId,
      toUserId,
      amountCents: dollarsToCents(amount),
      status: "PENDING",
      initiatedById: req.user!.id,
    },
    include: { fromUser: memberSelect, toUser: memberSelect },
  });

  res.status(201).json({
    id: settlement.id,
    fromUser: settlement.fromUser,
    toUser: settlement.toUser,
    amount: centsToDollars(settlement.amountCents),
    status: settlement.status,
    initiatedById: settlement.initiatedById,
    settledAt: settlement.settledAt,
    confirmedAt: settlement.confirmedAt,
  });
});

// Only the counterparty (whoever didn't initiate it) can confirm -- that's
// the verification step: the initiator's own say-so was never enough to
// move money on the balance sheet.
router.post("/:groupId/settlements/:settlementId/confirm", requireGroupMember, async (req, res) => {
  const groupId = req.group!.id;
  const settlementId = Number(req.params.settlementId);

  const settlement = await prisma.settlement.findFirst({ where: { id: settlementId, groupId } });
  if (!settlement) {
    throw AppError.notFound("Settlement not found");
  }
  if (settlement.status !== "PENDING") {
    throw AppError.conflict("This settlement has already been confirmed", "NOT_PENDING");
  }
  if (req.user!.id !== settlement.fromUserId && req.user!.id !== settlement.toUserId) {
    throw AppError.forbidden("You're not a party to this settlement");
  }
  if (req.user!.id === settlement.initiatedById) {
    throw AppError.forbidden("The other party needs to confirm this, not you");
  }

  const updated = await prisma.settlement.update({
    where: { id: settlementId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
    include: { fromUser: memberSelect, toUser: memberSelect },
  });

  res.json({
    id: updated.id,
    fromUser: updated.fromUser,
    toUser: updated.toUser,
    amount: centsToDollars(updated.amountCents),
    status: updated.status,
    initiatedById: updated.initiatedById,
    settledAt: updated.settledAt,
    confirmedAt: updated.confirmedAt,
  });
});

// Either party can reject/cancel a still-pending settlement: the initiator
// walking back a mistake, or the counterparty disputing a payment they say
// never happened. Once CONFIRMED, a settlement is a final record and this
// route no longer applies (404s look the same as "already gone").
router.delete("/:groupId/settlements/:settlementId", requireGroupMember, async (req, res) => {
  const groupId = req.group!.id;
  const settlementId = Number(req.params.settlementId);

  const settlement = await prisma.settlement.findFirst({ where: { id: settlementId, groupId, status: "PENDING" } });
  if (!settlement) {
    throw AppError.notFound("Pending settlement not found");
  }
  if (req.user!.id !== settlement.fromUserId && req.user!.id !== settlement.toUserId) {
    throw AppError.forbidden("You're not a party to this settlement");
  }

  await prisma.settlement.delete({ where: { id: settlementId } });
  res.status(204).send();
});

router.get("/:groupId/expenses", requireGroupMember, async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: { groupId: req.group!.id },
    include: { paidBy: memberSelect, splits: { include: { user: memberSelect } } },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  });

  res.json(
    expenses.map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      amount: centsToDollars(e.amountCents),
      splitType: e.splitType,
      expenseDate: e.expenseDate,
      paidBy: e.paidBy,
      splits: e.splits.map((s) => ({ user: s.user, amount: centsToDollars(s.shareCents) })),
    }))
  );
});

router.post("/:groupId/expenses", requireGroupMember, validate(createExpenseSchema), async (req, res) => {
  const groupId = req.group!.id;
  const input = req.body as ReturnType<typeof createExpenseSchema.parse>;

  const participantIds = input.splitType === "EQUAL" ? input.participantIds! : input.splits!.map((s) => s.userId);
  const allInvolvedIds = new Set([input.paidById, ...participantIds]);

  const memberships = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: [...allInvolvedIds] } },
  });
  if (memberships.length !== allInvolvedIds.size) {
    throw AppError.unprocessable("payer and all split participants must be group members", "NOT_A_MEMBER");
  }

  const amountCents = dollarsToCents(input.amount);
  const shares = buildExpenseSplits(input, amountCents);

  const expense = await prisma.expense.create({
    data: {
      groupId,
      paidById: input.paidById,
      createdById: req.user!.id,
      amountCents,
      description: input.description,
      category: input.category,
      splitType: input.splitType,
      expenseDate: input.expenseDate ?? new Date(),
      splits: { create: shares },
    },
    include: { paidBy: memberSelect, splits: { include: { user: memberSelect } } },
  });

  res.status(201).json({
    id: expense.id,
    description: expense.description,
    category: expense.category,
    amount: centsToDollars(expense.amountCents),
    splitType: expense.splitType,
    expenseDate: expense.expenseDate,
    paidBy: expense.paidBy,
    splits: expense.splits.map((s) => ({ user: s.user, amount: centsToDollars(s.shareCents) })),
  });
});

export default router;
