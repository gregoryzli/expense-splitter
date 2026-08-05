import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/AppError";

interface ErrorBody {
  error: { message: string; code: string; details?: unknown };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { message: `No route ${req.method} ${req.path}`, code: "ROUTE_NOT_FOUND" },
  } satisfies ErrorBody);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { message: err.message, code: err.code },
    } satisfies ErrorBody);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    } satisfies ErrorBody);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        error: { message: "A record with these details already exists", code: "DUPLICATE" },
      } satisfies ErrorBody);
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        error: { message: "Record not found", code: "NOT_FOUND" },
      } satisfies ErrorBody);
      return;
    }
  }

  console.error(err);
  res.status(500).json({
    error: { message: "Internal server error", code: "INTERNAL_ERROR" },
  } satisfies ErrorBody);
}
