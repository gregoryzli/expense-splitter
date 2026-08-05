import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/AppError";

/**
 * Guards every group-scoped route: the group must exist, and the
 * authenticated user must be a member. This is the one authorization check
 * that matters most here, since everything behind it is financial data.
 * Must run after requireAuth.
 */
export async function requireGroupMember(req: Request, _res: Response, next: NextFunction) {
  const groupId = Number(req.params.groupId);
  if (!Number.isInteger(groupId)) {
    throw AppError.badRequest("Invalid group id");
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw AppError.notFound("Group not found");
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.user!.id } },
  });
  if (!membership) {
    throw AppError.forbidden("You are not a member of this group");
  }

  req.group = group;
  next();
}
