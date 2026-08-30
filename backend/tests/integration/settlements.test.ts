import { describe, expect, it } from "vitest";
import { createGroup, registerUser } from "../helpers";

async function tripWithExpense() {
  const alice = await registerUser({ name: "Alice" });
  const bob = await registerUser({ name: "Bob" });
  const carol = await registerUser({ name: "Carol" });
  const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email, carol.email] });

  // Alice pays $90, split equally three ways -- Bob and Carol each owe $30.
  await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
    description: "Hotel",
    category: "Lodging",
    amount: 90,
    paidById: alice.user.id,
    splitType: "EQUAL",
    participantIds: [alice.user.id, bob.user.id, carol.user.id],
  });

  return { alice, bob, carol, group };
}

describe("GET /api/groups/:groupId/balances", () => {
  it("reflects paid vs. owed shares", async () => {
    const { alice, bob, carol, group } = await tripWithExpense();
    const res = await alice.agent.get(`/api/groups/${group.id}/balances`);

    expect(res.status).toBe(200);
    const byUser = Object.fromEntries(
      res.body.map((b: { userId: number; balance: number }) => [b.userId, b.balance])
    );
    expect(byUser[alice.user.id]).toBe(60);
    expect(byUser[bob.user.id]).toBe(-30);
    expect(byUser[carol.user.id]).toBe(-30);
  });
});

describe("GET /api/groups/:groupId/settlements/suggestions", () => {
  it("suggests the minimal set of payments to zero everyone out", async () => {
    const { alice, bob, carol, group } = await tripWithExpense();
    const res = await alice.agent.get(`/api/groups/${group.id}/settlements/suggestions`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2); // n-1 = 2 for 3 people
    const totalToAlice = res.body
      .filter((p: { toUserId: number }) => p.toUserId === alice.user.id)
      .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    expect(totalToAlice).toBe(60);
    const payers = res.body.map((p: { fromUserId: number }) => p.fromUserId).sort();
    expect(payers).toEqual([bob.user.id, carol.user.id].sort());
  });

  it("returns no suggestions once everyone is settled", async () => {
    const alice = await registerUser({ name: "Alice" });
    const group = await createGroup(alice, { name: "Solo Trip" });
    const res = await alice.agent.get(`/api/groups/${group.id}/settlements/suggestions`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/groups/:groupId/settlements", () => {
  it("records a payment as PENDING without changing balances yet", async () => {
    const { alice, bob, group } = await tripWithExpense();

    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });
    expect(record.status).toBe(201);
    expect(record.body).toMatchObject({ status: "PENDING", initiatedById: bob.user.id });

    const balances = await alice.agent.get(`/api/groups/${group.id}/balances`);
    const byUser = Object.fromEntries(
      balances.body.map((b: { userId: number; balance: number }) => [b.userId, b.balance])
    );
    expect(byUser[bob.user.id]).toBe(-30); // unchanged -- not confirmed yet
    expect(byUser[alice.user.id]).toBe(60);
  });

  it("rejects recording a settlement you're not a party to", async () => {
    const { alice, bob, carol, group } = await tripWithExpense();

    const res = await carol.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });

    expect(res.status).toBe(403);
  });

  it("rejects a settlement involving a non-member", async () => {
    const { alice, bob, group } = await tripWithExpense();
    const outsider = await registerUser({ name: "Outsider" });

    const res = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: outsider.user.id, amount: 10 });

    expect(res.status).toBe(422);
  });

  it("appears in settlement history as PENDING afterward", async () => {
    const { alice, bob, group } = await tripWithExpense();
    await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });

    const history = await alice.agent.get(`/api/groups/${group.id}/settlements`);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ amount: 30, status: "PENDING" });
  });
});

describe("POST /api/groups/:groupId/settlements/:settlementId/confirm", () => {
  it("lets the counterparty confirm, which then updates balances", async () => {
    const { alice, bob, group } = await tripWithExpense();
    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });

    const confirm = await alice.agent.post(`/api/groups/${group.id}/settlements/${record.body.id}/confirm`);
    expect(confirm.status).toBe(200);
    expect(confirm.body).toMatchObject({ status: "CONFIRMED" });
    expect(confirm.body.confirmedAt).toBeTruthy();

    const balances = await alice.agent.get(`/api/groups/${group.id}/balances`);
    const byUser = Object.fromEntries(
      balances.body.map((b: { userId: number; balance: number }) => [b.userId, b.balance])
    );
    expect(byUser[bob.user.id]).toBe(0);
    expect(byUser[alice.user.id]).toBe(30);
  });

  it("blocks the initiator from confirming their own settlement", async () => {
    const { alice, bob, group } = await tripWithExpense();
    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });

    const confirm = await bob.agent.post(`/api/groups/${group.id}/settlements/${record.body.id}/confirm`);
    expect(confirm.status).toBe(403);
  });

  it("blocks a non-party from confirming", async () => {
    const { alice, bob, carol, group } = await tripWithExpense();
    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });

    const confirm = await carol.agent.post(`/api/groups/${group.id}/settlements/${record.body.id}/confirm`);
    expect(confirm.status).toBe(403);
  });

  it("rejects confirming an already-confirmed settlement", async () => {
    const { alice, bob, group } = await tripWithExpense();
    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });
    await alice.agent.post(`/api/groups/${group.id}/settlements/${record.body.id}/confirm`);

    const confirmAgain = await alice.agent.post(`/api/groups/${group.id}/settlements/${record.body.id}/confirm`);
    expect(confirmAgain.status).toBe(409);
    expect(confirmAgain.body.error.code).toBe("NOT_PENDING");
  });
});

describe("DELETE /api/groups/:groupId/settlements/:settlementId", () => {
  it("lets either party reject a pending settlement, leaving balances untouched", async () => {
    const { alice, bob, group } = await tripWithExpense();
    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });

    const reject = await alice.agent.delete(`/api/groups/${group.id}/settlements/${record.body.id}`);
    expect(reject.status).toBe(204);

    const history = await alice.agent.get(`/api/groups/${group.id}/settlements`);
    expect(history.body).toHaveLength(0);

    const balances = await alice.agent.get(`/api/groups/${group.id}/balances`);
    const byUser = Object.fromEntries(
      balances.body.map((b: { userId: number; balance: number }) => [b.userId, b.balance])
    );
    expect(byUser[bob.user.id]).toBe(-30);
  });

  it("blocks a non-party from rejecting", async () => {
    const { alice, bob, carol, group } = await tripWithExpense();
    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });

    const reject = await carol.agent.delete(`/api/groups/${group.id}/settlements/${record.body.id}`);
    expect(reject.status).toBe(403);
  });

  it("can't reject an already-confirmed settlement", async () => {
    const { alice, bob, group } = await tripWithExpense();
    const record = await bob.agent
      .post(`/api/groups/${group.id}/settlements`)
      .send({ fromUserId: bob.user.id, toUserId: alice.user.id, amount: 30 });
    await alice.agent.post(`/api/groups/${group.id}/settlements/${record.body.id}/confirm`);

    const reject = await alice.agent.delete(`/api/groups/${group.id}/settlements/${record.body.id}`);
    expect(reject.status).toBe(404);
  });
});
