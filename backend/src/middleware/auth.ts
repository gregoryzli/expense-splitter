import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../lib/AppError";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export const COOKIE_NAME = "token";

interface TokenPayload {
  sub: number;
  email: string;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as jwt.SignOptions["expiresIn"] });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    throw AppError.unauthorized();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    throw AppError.unauthorized("Invalid or expired session");
  }
}
