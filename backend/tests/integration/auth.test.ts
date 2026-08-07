import { describe, expect, it } from "vitest";
import request from "supertest";
import { server, registerUser } from "../helpers";

describe("POST /api/auth/register", () => {
  it("creates a user and sets an auth cookie", async () => {
    const res = await request(server)
      .post("/api/auth/register")
      .send({ name: "Alice", email: "alice@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Alice", email: "alice@example.com" });
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^token=/);
  });

  it("rejects a duplicate email with 409", async () => {
    await registerUser({ email: "dupe@example.com" });
    const res = await request(server)
      .post("/api/auth/register")
      .send({ name: "Someone Else", email: "dupe@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects a short password with 400", async () => {
    const res = await request(server)
      .post("/api/auth/register")
      .send({ name: "Bob", email: "bob@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { email, password } = await registerUser({ email: "login@example.com" });
    const res = await request(server).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it("rejects a wrong password with 401, without revealing which field was wrong", async () => {
    const { email } = await registerUser({ email: "wrongpw@example.com" });
    const res = await request(server).post("/api/auth/login").send({ email, password: "totallywrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an unknown email with the same 401/INVALID_CREDENTIALS shape", async () => {
    const res = await request(server)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(server).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user when authenticated", async () => {
    const { agent, user } = await registerUser({ name: "Carol" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, name: "Carol" });
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session so /me subsequently 401s", async () => {
    const { agent } = await registerUser();
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(204);

    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });
});
