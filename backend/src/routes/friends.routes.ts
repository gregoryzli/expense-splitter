import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/AppError";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { addFriendSchema } from "../schemas/friend.schema";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const friends = await prisma.friend.findMany({
    where: { userId: req.user!.id },
    include: { friend: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(friends.map((f) => f.friend));
});

router.post("/", validate(addFriendSchema), async (req, res) => {
  const { friendId } = req.body;
  if (friendId === req.user!.id) {
    throw AppError.badRequest("You can't add yourself as a friend");
  }

  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true, name: true, email: true },
  });
  if (!friend) {
    throw AppError.notFound("No account with that id", "USER_NOT_FOUND");
  }

  const existing = await prisma.friend.findUnique({
    where: { userId_friendId: { userId: req.user!.id, friendId } },
  });
  if (existing) {
    throw AppError.conflict("Already saved as a friend", "ALREADY_FRIEND");
  }

  await prisma.friend.create({ data: { userId: req.user!.id, friendId } });
  res.status(201).json(friend);
});

router.delete("/:friendId", async (req, res) => {
  const friendId = Number(req.params.friendId);
  const deleted = await prisma.friend.deleteMany({ where: { userId: req.user!.id, friendId } });
  if (deleted.count === 0) {
    throw AppError.notFound("That person isn't in your friends list");
  }
  res.status(204).send();
});

export default router;
