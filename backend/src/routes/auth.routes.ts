import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/AppError";
import { validate } from "../middleware/validate";
import { requireAuth, signToken, COOKIE_NAME } from "../middleware/auth";
import { changePasswordSchema, deleteAccountSchema, loginSchema, registerSchema } from "../schemas/auth.schema";
import { leaveGroup } from "../services/departures";

const router = Router();

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // keep in sync with JWT_EXPIRES_IN
const BCRYPT_ROUNDS = 12;

function cookieOptions() {
  // Deliberately not just `NODE_ENV === "production"`: a production-built
  // image running locally over plain HTTP (e.g. docker-compose) still needs
  // secure:false, or the browser silently drops the cookie and login
  // appears to "work" (200 response) while every subsequent request 401s.
  // Real cross-origin HTTPS deployments set COOKIE_SECURE=true explicitly.
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function toPublicUser(user: { id: number; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}

router.post("/register", validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict("Email already in use", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });

  const token = signToken({ sub: user.id, email: user.email, name: user.name });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.status(201).json(toPublicUser(user));
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  // A deleted account fails login the same way a wrong password would --
  // no separate "this account was deleted" message, so search/login can't
  // be used to probe which emails used to have accounts.
  if (!user || !valid || user.deletedAt) {
    throw AppError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  const token = signToken({ sub: user.id, email: user.email, name: user.name });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json(toPublicUser(user));
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || user.deletedAt) {
    throw AppError.unauthorized();
  }
  res.json(toPublicUser(user));
});

// The cookie stays valid after this -- there's no session store to
// invalidate other devices from, and re-issuing the same JWT costs nothing
// since it doesn't embed the password hash.
router.patch("/password", requireAuth, validate(changePasswordSchema), async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized("Current password is incorrect", "INVALID_CREDENTIALS");
  }

  const passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.status(204).send();
});

// Soft delete only -- see the deletedAt comment on the User model. Every
// group membership is left the same way a manual "leave group" would be
// (see services/departures.ts), so any nonzero balance turns into an
// UnresolvedDeparture for that group's remaining members to resolve rather
// than just disappearing along with the account.
router.delete("/me", requireAuth, validate(deleteAccountSchema), async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const valid = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized("Incorrect password", "INVALID_CREDENTIALS");
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  for (const m of memberships) {
    await leaveGroup(m.groupId, user.id);
  }

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.status(204).send();
});

export default router;
