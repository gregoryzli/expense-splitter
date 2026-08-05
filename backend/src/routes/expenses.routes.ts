import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/AppError";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateExpenseSchema } from "../schemas/expense.schema";
import { centsToDollars, dollarsToCents } from "../lib/money";
import { buildExpenseSplits } from "../services/expenseSplits";

const router = Router();
router.use(requireAuth);

const memberSelect = { select: { id: true, name: true, email: true } } as const;

async function loadExpenseForMember(expenseId: number, userId: number) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { paidBy: memberSelect, group: true, splits: { include: { user: memberSelect } } },
  });
  if (!expense) {
    throw AppError.notFound("Expense not found");
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: expense.groupId, userId } },
  });
  if (!membership) {
    throw AppError.forbidden("You are not a member of this expense's group");
  }

  return expense;
}

function serialize(expense: Awaited<ReturnType<typeof loadExpenseForMember>>) {
  return {
    id: expense.id,
    groupId: expense.groupId,
    description: expense.description,
    category: expense.category,
    amount: centsToDollars(expense.amountCents),
    splitType: expense.splitType,
    expenseDate: expense.expenseDate,
    paidBy: expense.paidBy,
    splits: expense.splits.map((s) => ({ user: s.user, amount: centsToDollars(s.shareCents) })),
  };
}

router.get("/:id", async (req, res) => {
  const expense = await loadExpenseForMember(Number(req.params.id), req.user!.id);
  res.json(serialize(expense));
});

router.patch("/:id", validate(updateExpenseSchema), async (req, res) => {
  const expenseId = Number(req.params.id);
  const existing = await loadExpenseForMember(expenseId, req.user!.id);

  if (existing.paidById !== req.user!.id && existing.group.createdById !== req.user!.id) {
    throw AppError.forbidden("Only the payer or the group creator can edit this expense");
  }

  const input = req.body as ReturnType<typeof updateExpenseSchema.parse>;
  const participantIds = input.splitType === "EQUAL" ? input.participantIds! : input.splits!.map((s) => s.userId);
  const allInvolvedIds = new Set([input.paidById, ...participantIds]);

  const memberships = await prisma.groupMember.findMany({
    where: { groupId: existing.groupId, userId: { in: [...allInvolvedIds] } },
  });
  if (memberships.length !== allInvolvedIds.size) {
    throw AppError.unprocessable("payer and all split participants must be group members", "NOT_A_MEMBER");
  }

  const amountCents = dollarsToCents(input.amount);
  const shares = buildExpenseSplits(input, amountCents);

  const expense = await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    return tx.expense.update({
      where: { id: expenseId },
      data: {
        paidById: input.paidById,
        amountCents,
        description: input.description,
        category: input.category,
        splitType: input.splitType,
        expenseDate: input.expenseDate ?? existing.expenseDate,
        splits: { create: shares },
      },
      include: { paidBy: memberSelect, splits: { include: { user: memberSelect } } },
    });
  });

  res.json(serialize({ ...expense, group: existing.group }));
});

router.delete("/:id", async (req, res) => {
  const expenseId = Number(req.params.id);
  const existing = await loadExpenseForMember(expenseId, req.user!.id);

  if (existing.paidById !== req.user!.id && existing.group.createdById !== req.user!.id) {
    throw AppError.forbidden("Only the payer or the group creator can delete this expense");
  }

  await prisma.expense.delete({ where: { id: expenseId } });
  res.status(204).send();
});

export default router;
