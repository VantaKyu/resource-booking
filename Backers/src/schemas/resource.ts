import { z } from 'zod';

export const createResourceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  qtyTotal: z.number().int().min(1).default(1),
});

export const updateResourceSchema = createResourceSchema.partial();
