import { z } from "zod";

export const resolveDepartureSchema = z.object({
  resolution: z.enum(["WRITE_OFF", "ABSORB_EVEN"]),
});
export type ResolveDepartureInput = z.infer<typeof resolveDepartureSchema>;
