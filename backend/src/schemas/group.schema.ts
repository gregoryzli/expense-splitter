import { z } from "zod";

// Display label only -- see the `currency` comment on the Group model.
// Kept as a fixed list (matching what the frontend offers) rather than any
// 3-letter string, since there's no real currency logic behind this to
// validate an arbitrary ISO code against.
const CURRENCY_CODES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

export const createGroupSchema = z.object({
  name: z.string().trim().min(3, "Group name must be at least 3 characters").max(100),
  description: z.string().trim().max(500).optional(),
  currency: z.enum(CURRENCY_CODES).optional().default("USD"),
  memberEmails: z.array(z.string().trim().toLowerCase().email()).max(50).optional().default([]),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    currency: z.enum(CURRENCY_CODES).optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined || data.currency !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;
