import { z } from "zod";
export const ledgerMutationSchema = z.object({
  action: z.enum(["wallet", "deleteWallet", "category", "deleteCategory", "entry", "deleteEntry", "receipt"]),
  version: z.number().int().nonnegative(),
}).passthrough();
export class LedgerMutationError extends Error {}
