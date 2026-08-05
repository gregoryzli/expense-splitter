import { PrismaClient } from "@prisma/client";

// Reused across hot-reloads in dev (tsx watch) and across requests in prod --
// each PrismaClient owns its own connection pool, so we don't want more than one.
export const prisma = new PrismaClient();
