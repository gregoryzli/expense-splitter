import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type Source = "body" | "params";

/**
 * Parses req[source] through a zod schema and replaces it with the parsed
 * (and coerced/defaulted) result. Validation failures throw ZodError, which
 * Express 5 forwards to the central error handler on its own -- route
 * handlers never need their own try/catch for shape validation.
 *
 * req.query is deliberately not supported here: Express 5 exposes it as a
 * getter-only property, so it can't be reassigned the way body/params can.
 * The one route that needs query validation parses it inline instead.
 */
export function validate(schema: ZodType, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    req[source] = schema.parse(req[source]);
    next();
  };
}
