import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/AppError";
import { validate } from "../middleware/validate";
import { requireAuth, signToken, COOKIE_NAME } from "../middleware/auth";
import { loginSchema, registerSchema } from "../schemas/auth.schema";

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
  if (!user || !valid) {
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
  if (!user) {
    throw AppError.unauthorized();
  }
  res.json(toPublicUser(user));
});

export default router;
