import { describe, expect, it } from "vitest";
import { createGroup, registerUser } from "../helpers";

async function tripWithAliceAndBob() {
  const alice = await registerUser({ name: "Alice" });
  const bob = await registerUser({ name: "Bob" });
  const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });
  return { alice, bob, group };
}

describe("POST /api/groups/:groupId/expenses", () => {
  it("creates an EQUAL split and computes shares server-side", async () => {
    const { alice, bob, group } = await tripWithAliceAndBob();

    const res = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Hotel",
      category: "Lodging",
      amount: 100,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id, bob.user.id],
    });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(100);
    const shares = res.body.splits.map((s: { amount: number }) => s.amount).sort();
    expect(shares).toEqual([50, 50]);
  });

  it("distributes the odd cent on an EQUAL split among an uneven number of people", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const carol = await registerUser({ name: "Carol" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email, carol.email] });

    const res = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Cab",
      category: "Transport",
      amount: 10,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id, bob.user.id, carol.user.id],
    });

    expect(res.status).toBe(201);
    const shares = res.body.splits.map((s: { amount: number }) => s.amount).sort();
    // $10 / 3 -- must sum to exactly $10, not drift from rounding each share.
    expect(shares.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(10, 5);
  });

  it("creates an EXACT split when amounts sum to the total", async () => {
    const { alice, bob, group } = await tripWithAliceAndBob();

    const res = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Groceries",
      category: "Food",
      amount: 50,
      paidById: alice.user.id,
      splitType: "EXACT",
      splits: [
        { userId: alice.user.id, value: 30 },
        { userId: bob.user.id, value: 20 },
      ],
    });

    expect(res.status).toBe(201);
    const byUser = Object.fromEntries(
      res.body.splits.map((s: { user: { id: number }; amount: number }) => [s.user.id, s.amount])
    );
    expect(byUser[alice.user.id]).toBe(30);
    expect(byUser[bob.user.id]).toBe(20);
  });

  it("rejects an EXACT split that doesn't sum to the total with 422", async () => {
    const { alice, bob, group } = await tripWithAliceAndBob();

    const res = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Groceries",
      category: "Food",
      amount: 50,
      paidById: alice.user.id,
      splitType: "EXACT",
      splits: [
        { userId: alice.user.id, value: 30 },
        { userId: bob.user.id, value: 25 },
      ],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SPLIT_MISMATCH");
  });

  it("creates a PERCENTAGE split and allocates odd cents by largest remainder", async () => {
    const { alice, bob, group } = await tripWithAliceAndBob();

    const res = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Tickets",
      category: "Fun",
      amount: 100.03,
      paidById: alice.user.id,
      splitType: "PERCENTAGE",
      splits: [
        { userId: alice.user.id, value: 50 },
        { userId: bob.user.id, value: 50 },
      ],
    });

    expect(res.status).toBe(201);
    const total = res.body.splits.reduce((sum: number, s: { amount: number }) => sum + s.amount, 0);
    expect(total).toBeCloseTo(100.03, 5);
  });

  it("rejects PERCENTAGE splits that don't add up to 100 with 422", async () => {
    const { alice, bob, group } = await tripWithAliceAndBob();

    const res = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Tickets",
      category: "Fun",
      amount: 100,
      paidById: alice.user.id,
      splitType: "PERCENTAGE",
      splits: [
        { userId: alice.user.id, value: 50 },
        { userId: bob.user.id, value: 40 },
      ],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SPLIT_MISMATCH");
  });

  it("rejects a split participant who isn't a group member with 422", async () => {
    const { alice, group } = await tripWithAliceAndBob();
    const outsider = await registerUser({ name: "Outsider" });

    const res = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Dinner",
      category: "Food",
      amount: 40,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id, outsider.user.id],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOT_A_MEMBER");
  });

  it("requires the requester to be a group member", async () => {
    const { group } = await tripWithAliceAndBob();
    const outsider = await registerUser({ name: "Outsider" });

    const res = await outsider.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Dinner",
      category: "Food",
      amount: 40,
      paidById: outsider.user.id,
      splitType: "EQUAL",
      participantIds: [outsider.user.id],
    });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/groups/:groupId/expenses", () => {
  it("lists expenses for a member", async () => {
    const { alice, bob, group } = await tripWithAliceAndBob();
    await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Hotel",
      category: "Lodging",
      amount: 100,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id, bob.user.id],
    });

    const res = await bob.agent.get(`/api/groups/${group.id}/expenses`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe("Hotel");
  });
});

describe("PATCH/DELETE /api/expenses/:id", () => {
  async function seedExpense() {
    const ctx = await tripWithAliceAndBob();
    const created = await ctx.alice.agent.post(`/api/groups/${ctx.group.id}/expenses`).send({
      description: "Hotel",
      category: "Lodging",
      amount: 100,
      paidById: ctx.alice.user.id,
      splitType: "EQUAL",
      participantIds: [ctx.alice.user.id, ctx.bob.user.id],
    });
    return { ...ctx, expenseId: created.body.id as number };
  }

  it("lets the payer edit their own expense", async () => {
    const { alice, expenseId } = await seedExpense();
    const res = await alice.agent.patch(`/api/expenses/${expenseId}`).send({
      description: "Hotel (updated)",
      category: "Lodging",
      amount: 120,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Hotel (updated)");
    expect(res.body.amount).toBe(120);
  });

  it("forbids a non-payer, non-creator group member from editing", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const carol = await registerUser({ name: "Carol" });
    // Bob creates the group (so Alice is neither payer nor creator), Alice pays.
    const group = await createGroup(bob, { name: "Trip", memberEmails: [alice.email, carol.email] });
    const created = await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Snacks",
      category: "Food",
      amount: 10,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id, carol.user.id],
    });

    const res = await carol.agent.patch(`/api/expenses/${created.body.id}`).send({
      description: "hijacked",
      category: "Food",
      amount: 1,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id],
    });
    expect(res.status).toBe(403);
  });

  it("lets the group creator delete an expense even if they didn't pay", async () => {
    const alice = await registerUser({ name: "Alice" }); // creator
    const bob = await registerUser({ name: "Bob" }); // payer
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });
    const created = await bob.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Snacks",
      category: "Food",
      amount: 10,
      paidById: bob.user.id,
      splitType: "EQUAL",
      participantIds: [bob.user.id],
    });

    const res = await alice.agent.delete(`/api/expenses/${created.body.id}`);
    expect(res.status).toBe(204);

    const list = await alice.agent.get(`/api/groups/${group.id}/expenses`);
    expect(list.body).toHaveLength(0);
  });

  it("returns 403 for a non-member trying to view an expense", async () => {
    const { expenseId } = await seedExpense();
    const outsider = await registerUser({ name: "Outsider" });
    const res = await outsider.agent.get(`/api/expenses/${expenseId}`);
    expect(res.status).toBe(403);
  });
});
