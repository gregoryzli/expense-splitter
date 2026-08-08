import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, SplitType } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";

async function reset() {
  await prisma.expenseSplit.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Resetting existing data...");
  await reset();

  console.log("Creating demo users (all use the password 'password123')...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const [demo, alice, bob, carol] = await Promise.all(
    [
      { name: "Demo User", email: "demo@example.com" },
      { name: "Alice Chen", email: "alice@example.com" },
      { name: "Bob Martinez", email: "bob@example.com" },
      { name: "Carol Nguyen", email: "carol@example.com" },
    ].map((u) => prisma.user.create({ data: { ...u, passwordHash } }))
  );

  console.log("Creating 'Roommates' group (mid-settlement)...");
  const roommates = await prisma.group.create({
    data: {
      name: "Roommates",
      description: "Shared apartment expenses",
      createdById: demo.id,
      members: { create: [{ userId: demo.id }, { userId: alice.id }, { userId: bob.id }] },
    },
  });

  await prisma.expense.create({
    data: {
      groupId: roommates.id,
      paidById: demo.id,
      createdById: demo.id,
      amountCents: 120_000,
      description: "Rent",
      category: "Housing",
      splitType: SplitType.EQUAL,
      expenseDate: daysAgo(20),
      splits: {
        create: [
          { userId: demo.id, shareCents: 40_000 },
          { userId: alice.id, shareCents: 40_000 },
          { userId: bob.id, shareCents: 40_000 },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      groupId: roommates.id,
      paidById: alice.id,
      createdById: alice.id,
      amountCents: 8_547,
      description: "Groceries",
      category: "Food",
      splitType: SplitType.EXACT,
      expenseDate: daysAgo(12),
      splits: {
        create: [
          { userId: demo.id, shareCents: 3_000 },
          { userId: alice.id, shareCents: 2_547 },
          { userId: bob.id, shareCents: 3_000 },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      groupId: roommates.id,
      paidById: bob.id,
      createdById: bob.id,
      amountCents: 6_000,
      description: "Internet Bill",
      category: "Utilities",
      splitType: SplitType.PERCENTAGE,
      expenseDate: daysAgo(5),
      splits: {
        create: [
          { userId: demo.id, shareCents: 2_400 }, // 40%
          { userId: alice.id, shareCents: 1_800 }, // 30%
          { userId: bob.id, shareCents: 1_800 }, // 30%
        ],
      },
    },
  });

  // Bob owes $388 after the three expenses above; this records a partial
  // payment so the group demos a realistic mid-settlement state instead of
  // either "nothing happened yet" or "fully settled".
  await prisma.settlement.create({
    data: {
      groupId: roommates.id,
      fromUserId: bob.id,
      toUserId: demo.id,
      amountCents: 20_000,
      settledAt: daysAgo(2),
    },
  });

  console.log("Creating 'Ski Trip' group (fresh, unsettled)...");
  const skiTrip = await prisma.group.create({
    data: {
      name: "Ski Trip",
      description: "Weekend trip to the mountains",
      createdById: demo.id,
      members: { create: [{ userId: demo.id }, { userId: alice.id }, { userId: carol.id }] },
    },
  });

  await prisma.expense.create({
    data: {
      groupId: skiTrip.id,
      paidById: demo.id,
      createdById: demo.id,
      amountCents: 24_000,
      description: "Lift Tickets",
      category: "Entertainment",
      splitType: SplitType.EQUAL,
      expenseDate: daysAgo(3),
      splits: {
        create: [
          { userId: demo.id, shareCents: 8_000 },
          { userId: alice.id, shareCents: 8_000 },
          { userId: carol.id, shareCents: 8_000 },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      groupId: skiTrip.id,
      paidById: carol.id,
      createdById: carol.id,
      amountCents: 45_000,
      description: "Cabin Rental",
      category: "Accommodation",
      splitType: SplitType.EQUAL,
      expenseDate: daysAgo(3),
      splits: {
        create: [
          { userId: demo.id, shareCents: 15_000 },
          { userId: alice.id, shareCents: 15_000 },
          { userId: carol.id, shareCents: 15_000 },
        ],
      },
    },
  });

  console.log("Done. Log in as demo@example.com / password123 (or alice@, bob@, carol@example.com).");
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
