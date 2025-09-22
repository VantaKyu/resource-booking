import { z } from 'zod';

export const createBookingSchema = z.object({
  resourceId: z.string().min(1),
  start: z.coerce.date(),
  end: z.coerce.date(),
  qty: z.number().int().min(1).default(1),
  notes: z.string().optional(),
}).refine((d) => d.end > d.start, { message: 'end must be after start', path: ['end'] });

export const updateBookingStatusSchema = z.object({
  status: z.enum(['PENDING','APPROVED','REJECTED','CANCELLED'])
});
