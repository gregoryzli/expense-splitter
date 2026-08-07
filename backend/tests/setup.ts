import { afterAll, afterEach, beforeAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { server } from "./helpers";

// Deleted in FK-safe order (children before parents). Runs after every
// test so integration tests never see another test's data, without
// needing per-test transactions (Prisma's interactive transactions don't
// compose well with supertest issuing real HTTP requests against the app).
async function resetDb() {
  await prisma.expenseSplit.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await resetDb();
});

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
