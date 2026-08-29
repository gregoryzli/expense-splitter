import { describe, expect, it } from "vitest";
import request from "supertest";
import { server, createGroup, registerUser } from "../helpers";

describe("POST /api/groups", () => {
  it("creates a group and auto-adds the creator as a member", async () => {
    const alice = await registerUser({ name: "Alice" });
    const res = await alice.agent.post("/api/groups").send({ name: "Weekend Trip" });

    expect(res.status).toBe(201);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].id).toBe(alice.user.id);
    expect(res.body.createdById).toBe(alice.user.id);
  });

  it("adds invited members by email", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });

    const res = await alice.agent.post("/api/groups").send({ name: "Trip", memberEmails: [bob.email] });

    expect(res.status).toBe(201);
    const memberIds = res.body.members.map((m: { id: number }) => m.id).sort();
    expect(memberIds).toEqual([alice.user.id, bob.user.id].sort());
  });

  it("rejects an unknown invitee email with 422", async () => {
    const alice = await registerUser({ name: "Alice" });
    const res = await alice.agent
      .post("/api/groups")
      .send({ name: "Trip", memberEmails: ["ghost@nowhere.com"] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("requires authentication", async () => {
    const res = await request(server).post("/api/groups").send({ name: "Trip" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/groups", () => {
  it("only returns groups the caller belongs to, with their balance", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    await createGroup(alice, { name: "Alice Only" });
    await createGroup(bob, { name: "Bob Only" });

    const res = await alice.agent.get("/api/groups");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: "Alice Only", yourBalance: 0 });
  });
});

describe("GET /api/groups/:groupId", () => {
  it("returns group details with balances for a member", async () => {
    const alice = await registerUser({ name: "Alice" });
    const group = await createGroup(alice, { name: "Trip" });

    const res = await alice.agent.get(`/api/groups/${group.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Trip");
    expect(res.body.balances).toEqual([
      expect.objectContaining({ userId: alice.user.id, balanceCents: 0 }),
    ]);
  });

  it("returns 403 for a non-member", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip" });

    const res = await bob.agent.get(`/api/groups/${group.id}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent group", async () => {
    const alice = await registerUser({ name: "Alice" });
    const res = await alice.agent.get("/api/groups/999999");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/groups/:groupId", () => {
  it("lets the creator rename the group", async () => {
    const alice = await registerUser({ name: "Alice" });
    const group = await createGroup(alice, { name: "Old Name" });

    const res = await alice.agent.patch(`/api/groups/${group.id}`).send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
  });

  it("forbids a non-creator member from editing", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });

    const res = await bob.agent.patch(`/api/groups/${group.id}`).send({ name: "Hijacked" });
    expect(res.status).toBe(403);
  });
});

describe("group membership", () => {
  it("lets the creator add a member by email", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip" });

    const res = await alice.agent.post(`/api/groups/${group.id}/members`).send({ email: bob.email });
    expect(res.status).toBe(201);

    const details = await alice.agent.get(`/api/groups/${group.id}`);
    expect(details.body.members).toHaveLength(2);
  });

  it("rejects adding the same member twice with 409", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });

    const res = await alice.agent.post(`/api/groups/${group.id}/members`).send({ email: bob.email });
    expect(res.status).toBe(409);
  });

  it("blocks a non-creator from removing another member", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const carol = await registerUser({ name: "Carol" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email, carol.email] });

    const res = await bob.agent.delete(`/api/groups/${group.id}/members/${carol.user.id}`);
    expect(res.status).toBe(403);
  });

  it("lets the creator leave without disbanding the group when other members remain", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });

    const res = await alice.agent.delete(`/api/groups/${group.id}/members/${alice.user.id}`);
    expect(res.status).toBe(204);

    const details = await bob.agent.get(`/api/groups/${group.id}`);
    expect(details.status).toBe(200);
    expect(details.body.members.map((m: { id: number }) => m.id)).toEqual([bob.user.id]);
  });

  it("disbands the group when the last member leaves", async () => {
    const alice = await registerUser({ name: "Alice" });
    const group = await createGroup(alice, { name: "Solo Trip" });

    const res = await alice.agent.delete(`/api/groups/${group.id}/members/${alice.user.id}`);
    expect(res.status).toBe(204);

    const details = await alice.agent.get(`/api/groups/${group.id}`);
    expect(details.status).toBe(404);
  });

  it("lets a member with a zero balance leave voluntarily", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });

    const res = await bob.agent.delete(`/api/groups/${group.id}/members/${bob.user.id}`);
    expect(res.status).toBe(204);
  });

  it("blocks removing a member with a nonzero balance", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });
    const group = await createGroup(alice, { name: "Trip", memberEmails: [bob.email] });

    await alice.agent.post(`/api/groups/${group.id}/expenses`).send({
      description: "Dinner",
      category: "Food",
      amount: 40,
      paidById: alice.user.id,
      splitType: "EQUAL",
      participantIds: [alice.user.id, bob.user.id],
    });

    const res = await alice.agent.delete(`/api/groups/${group.id}/members/${bob.user.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NONZERO_BALANCE");
  });
});
