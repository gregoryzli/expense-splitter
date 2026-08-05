import { z } from "zod";

const splitEntrySchema = z.object({
  userId: z.number().int().positive(),
  // Dollar amount for EXACT splits, percentage points (0-100) for PERCENTAGE.
  // Ignored/omitted for EQUAL, where participantIds is used instead.
  value: z.number().positive(),
});

export const createExpenseSchema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(200),
    category: z.string().trim().min(1, "Category is required").max(50),
    amount: z.number().positive("Amount must be greater than 0").finite(),
    expenseDate: z.coerce.date().optional(),
    paidById: z.number().int().positive(),
    splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE"]),
    participantIds: z.array(z.number().int().positive()).optional(),
    splits: z.array(splitEntrySchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.splitType === "EQUAL") {
      if (!data.participantIds || data.participantIds.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["participantIds"],
          message: "participantIds is required for an EQUAL split",
        });
      }
    } else if (!data.splits || data.splits.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: `splits is required for a ${data.splitType} split`,
      });
    }
  });
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
