import { describe, expect, it } from "vitest";
import { createGroup, registerUser } from "../helpers";

async function addEqualExpense(
  payer: Awaited<ReturnType<typeof registerUser>>,
  groupId: number,
  amount: number,
  participantIds: number[]
) {
  await payer.agent.post(`/api/groups/${groupId}/expenses`).send({
    description: "Shared cost",
    category: "Other",
    amount,
    paidById: payer.user.id,
    splitType: "EQUAL",
    participantIds,
  });
}

describe("GET /api/groups/:groupId/departures", () => {
  it("starts empty and requires membership", async () => {
    const alice = await registerUser({ name: "Alice" });
    const outsider = await registerUser({ name: "Outsider" });
    const group = await createGroup(alice, { name: "Trip" });

    const empty = await alice.agent.get(`/api/groups/${group.id}/departures`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const blocked = await outsider.agent.get(`/api/groups/${group.id}/departures`);
    expect(blocked.status).toBe(403);
  });
});

describe("POST /api/groups/:groupId/departures/:id/resolve -- WRITE_OFF", () => {
  it("zeroes the departed member out via a synthetic settlement, leaving other balances untouched", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const carol = await registerUser({ name: "Carol" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email, carol.email] });

    // $90 paid by Alice, split equally 3 ways ($30 each): Alice +60, Bob -30, Carol -30.
    await addEqualExpense(alice, group.id, 90, [alice.user.id, bob.user.id, carol.user.id]);

    await alice.agent.delete(`/api/groups/${group.id}/members/${bob.user.id}`);
    const departures = await alice.agent.get(`/api/groups/${group.id}/departures`);
    const departure = departures.body[0];
    expect(departure.balance).toBe(-30);

    const resolve = await carol.agent
      .post(`/api/groups/${group.id}/departures/${departure.id}/resolve`)
      .send({ resolution: "WRITE_OFF" });
    expect(resolve.status).toBe(204);

    const balances = await alice.agent.get(`/api/groups/${group.id}/balances`);
    const byUser = Object.fromEntries(balances.body.map((b: { userId: number; balance: number }) => [b.userId, b.balance]));
    // Alice was owed $60 total, $30 each from Bob and Carol. Writing off
    // only Bob's share (that's who computeSettlement pairs him against)
    // leaves Alice still owed Carol's untouched $30 -- so Alice lands at
    // +30, not 0, and Carol's own balance doesn't move at all.
    expect(byUser[alice.user.id]).toBe(30);
    expect(byUser[carol.user.id]).toBe(-30);

    const resolvedList = await alice.agent.get(`/api/groups/${group.id}/departures`);
    expect(resolvedList.body[0]).toMatchObject({ resolvedAt: expect.any(String), resolutionType: "WRITE_OFF" });
  });

  it("rejects resolving an already-resolved departure with 409", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });
    await addEqualExpense(alice, group.id, 40, [alice.user.id, bob.user.id]);

    await alice.agent.delete(`/api/groups/${group.id}/members/${bob.user.id}`);
    const departure = (await alice.agent.get(`/api/groups/${group.id}/departures`)).body[0];

    await alice.agent.post(`/api/groups/${group.id}/departures/${departure.id}/resolve`).send({ resolution: "WRITE_OFF" });
    const second = await alice.agent
      .post(`/api/groups/${group.id}/departures/${departure.id}/resolve`)
      .send({ resolution: "WRITE_OFF" });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("ALREADY_RESOLVED");
  });
});

describe("POST /api/groups/:groupId/departures/:id/resolve -- ABSORB_EVEN", () => {
  it("splits the departed balance evenly across every remaining member", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const carol = await registerUser({ name: "Carol" });
    const dave = await registerUser({ name: "Dave" });
    const group = await createGroup(alice, {
      name: "Trip",
      memberEmails: [bob.email, carol.email, dave.email],
    });

    // $120 paid by Alice, split 4 ways ($30 each): Alice +90, Bob/Carol/Dave -30 each.
    await addEqualExpense(alice, group.id, 120, [alice.user.id, bob.user.id, carol.user.id, dave.user.id]);

    await alice.agent.delete(`/api/groups/${group.id}/members/${bob.user.id}`);
    const departure = (await alice.agent.get(`/api/groups/${group.id}/departures`)).body[0];
    expect(departure.balance).toBe(-30);

    const resolve = await carol.agent
      .post(`/api/groups/${group.id}/departures/${departure.id}/resolve`)
      .send({ resolution: "ABSORB_EVEN" });
    expect(resolve.status).toBe(204);

    const balances = await alice.agent.get(`/api/groups/${group.id}/balances`);
    const byUser = Object.fromEntries(balances.body.map((b: { userId: number; balance: number }) => [b.userId, b.balance]));
    // Bob's $30 debt splits evenly across the 3 remaining members ($10
    // each), lowering each of their balances by $10 regardless of who
    // Bob's debt "actually" belonged to.
    expect(byUser[alice.user.id]).toBe(80);
    expect(byUser[carol.user.id]).toBe(-40);
    expect(byUser[dave.user.id]).toBe(-40);
  });
});

describe("DELETE /api/auth/me (account deletion)", () => {
  it("requires the correct password", async () => {
    const alice = await registerUser({ name: "Alice" });
    const res = await alice.agent.delete("/api/auth/me").send({ password: "wrongpassword" });
    expect(res.status).toBe(401);

    // Account should still be usable afterward.
    expect((await alice.agent.get("/api/auth/me")).status).toBe(200);
  });

  it("removes the user from every group, leaves unresolved departures where balances weren't zero, logs out, and blocks future login", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });
    await addEqualExpense(alice, group.id, 40, [alice.user.id, bob.user.id]);

    const res = await alice.agent.delete("/api/auth/me").send({ password: alice.password });
    expect(res.status).toBe(204);

    expect((await alice.agent.get("/api/auth/me")).status).toBe(401);

    const details = await bob.agent.get(`/api/groups/${group.id}`);
    expect(details.body.members.map((m: { id: number }) => m.id)).toEqual([bob.user.id]);

    const departures = await bob.agent.get(`/api/groups/${group.id}/departures`);
    expect(departures.body[0]).toMatchObject({ user: { id: alice.user.id }, balance: 20 });

    const loginAttempt = await alice.agent.post("/api/auth/login").send({ email: alice.email, password: alice.password });
    expect(loginAttempt.status).toBe(401);
  });

  it("excludes a deleted account from user search", async () => {
    const alice = await registerUser({ name: "Deleteme Alice" });
    const bob = await registerUser({ name: "Bob" });

    await alice.agent.delete("/api/auth/me").send({ password: alice.password });

    const search = await bob.agent.get("/api/users?search=deleteme");
    expect(search.body).toEqual([]);
  });
});
