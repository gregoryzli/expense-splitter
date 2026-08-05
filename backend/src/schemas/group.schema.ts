import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(3, "Group name must be at least 3 characters").max(100),
  description: z.string().trim().max(500).optional(),
  memberEmails: z.array(z.string().trim().toLowerCase().email()).max(50).optional().default([]),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;
