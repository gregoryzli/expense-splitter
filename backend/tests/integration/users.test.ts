import { describe, expect, it } from "vitest";
import request from "supertest";
import { server, registerUser } from "../helpers";

describe("GET /api/users", () => {
  it("requires authentication", async () => {
    const res = await request(server).get("/api/users?search=bob");
    expect(res.status).toBe(401);
  });

  it("finds matching users by name and excludes the requester", async () => {
    const alice = await registerUser({ name: "Alice Anderson" });
    const bob = await registerUser({ name: "Bob Bobberson" });

    const res = await alice.agent.get("/api/users?search=bob");
    expect(res.status).toBe(200);
    expect(res.body.map((u: { id: number }) => u.id)).toEqual([bob.user.id]);
  });

  it("rejects a too-short search query with 400", async () => {
    const alice = await registerUser({ name: "Alice" });
    const res = await alice.agent.get("/api/users?search=a");
    expect(res.status).toBe(400);
  });
});
