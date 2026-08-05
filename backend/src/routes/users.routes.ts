import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const searchQuerySchema = z.object({ search: z.string().trim().min(2).max(100) });

// Replaces the old frontend's hardcoded 6-user list: real search over real
// accounts, so a group can only add members who've actually signed up.
router.get("/", requireAuth, async (req, res) => {
  const { search } = searchQuerySchema.parse(req.query);

  const users = await prisma.user.findMany({
    where: {
      OR: [{ name: { contains: search } }, { email: { contains: search } }],
      NOT: { id: req.user!.id },
    },
    select: { id: true, name: true, email: true },
    take: 10,
  });

  res.json(users);
});

export default router;
