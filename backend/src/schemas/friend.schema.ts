import { z } from "zod";

export const addFriendSchema = z.object({
  friendId: z.number().int().positive(),
});
export type AddFriendInput = z.infer<typeof addFriendSchema>;
