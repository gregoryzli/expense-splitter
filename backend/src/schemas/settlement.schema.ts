import { z } from "zod";

export const createSettlementSchema = z
  .object({
    fromUserId: z.number().int().positive(),
    toUserId: z.number().int().positive(),
    amount: z.number().positive("Amount must be greater than 0").finite(),
  })
  .refine((data) => data.fromUserId !== data.toUserId, {
    message: "fromUserId and toUserId must be different",
    path: ["toUserId"],
  });
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
