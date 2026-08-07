import request from "supertest";
import { createApp } from "../src/app";

// A single real listening server, reused for every request in the run.
// supertest will happily take a bare Express app instead, but then it
// calls app.listen(0)/server.close() internally on *every single request* --
// under a full suite's worth of rapid-fire calls that churn was causing
// intermittent "socket hang up" / stalled-connection flakiness in CI-like
// conditions. One persistent server avoids the listen/close cycle entirely.
export const server = createApp().listen(0);

let counter = 0;
function uniqueEmail(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}@test.com`;
}

interface RegisterOptions {
  name?: string;
  email?: string;
  password?: string;
}

/** Registers a fresh user and returns a cookie-carrying agent for them. */
export async function registerUser(options: RegisterOptions = {}) {
  const email = options.email ?? uniqueEmail(options.name?.toLowerCase().replace(/\s+/g, "") ?? "user");
  const password = options.password ?? "password123";
  const name = options.name ?? "Test User";

  const agent = request.agent(server);
  const res = await agent.post("/api/auth/register").send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, user: res.body as { id: number; name: string; email: string }, email, password };
}

/** Creates a group owned by `owner`, with `members` (other registered users) added. */
export async function createGroup(
  owner: Awaited<ReturnType<typeof registerUser>>,
  opts: { name?: string; description?: string; memberEmails?: string[] } = {}
) {
  const res = await owner.agent.post("/api/groups").send({
    name: opts.name ?? "Test Group",
    description: opts.description,
    memberEmails: opts.memberEmails ?? [],
  });
  if (res.status !== 201) {
    throw new Error(`createGroup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}
