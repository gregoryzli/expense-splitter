import { describe, expect, it } from "vitest";
import request from "supertest";
import { server, registerUser } from "../helpers";

describe("GET /api/friends", () => {
  it("requires authentication", async () => {
    const res = await request(server).get("/api/friends");
    expect(res.status).toBe(401);
  });

  it("starts empty and lists saved friends", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });

    const empty = await alice.agent.get("/api/friends");
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    await alice.agent.post("/api/friends").send({ friendId: bob.user.id });

    const res = await alice.agent.get("/api/friends");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: bob.user.id, name: bob.user.name, email: bob.user.email }]);
  });
});

describe("POST /api/friends", () => {
  it("saves a friend one-directionally -- it does not appear on the other side", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });

    const res = await alice.agent.post("/api/friends").send({ friendId: bob.user.id });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(bob.user.id);

    const bobsList = await bob.agent.get("/api/friends");
    expect(bobsList.body).toEqual([]);
  });

  it("rejects adding yourself", async () => {
    const alice = await registerUser({ name: "Alice" });
    const res = await alice.agent.post("/api/friends").send({ friendId: alice.user.id });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown user id with 404", async () => {
    const alice = await registerUser({ name: "Alice" });
    const res = await alice.agent.post("/api/friends").send({ friendId: 999999 });
    expect(res.status).toBe(404);
  });

  it("rejects saving the same friend twice", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });

    await alice.agent.post("/api/friends").send({ friendId: bob.user.id });
    const res = await alice.agent.post("/api/friends").send({ friendId: bob.user.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_FRIEND");
  });
});

describe("DELETE /api/friends/:friendId", () => {
  it("removes a saved friend", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });

    await alice.agent.post("/api/friends").send({ friendId: bob.user.id });
    const res = await alice.agent.delete(`/api/friends/${bob.user.id}`);
    expect(res.status).toBe(204);

    const list = await alice.agent.get("/api/friends");
    expect(list.body).toEqual([]);
  });

  it("404s if that person wasn't saved", async () => {
    const alice = await registerUser({ name: "Alice" });
    const bob = await registerUser({ name: "Bob" });

    const res = await alice.agent.delete(`/api/friends/${bob.user.id}`);
    expect(res.status).toBe(404);
  });
});
