import { Request, Response } from 'express';
import { prisma } from '../db.js';
import { createBookingSchema, updateBookingStatusSchema } from '../schemas/booking.js';
import { AuthedRequest } from '../middleware/auth.js';
import { hasConflict } from '../services/booking.js';

export async function listBookings(req: Request, res: Response) {
  const { userId, resourceId, status } = req.query;
  const where: any = {};
  if (userId) where.userId = userId;
  if (resourceId) where.resourceId = resourceId;
  if (status) where.status = status;
  const items = await prisma.booking.findMany({
    where,
    orderBy: { start: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } }, resource: true }
  });
  res.json(items);
}

export async function createBooking(req: AuthedRequest, res: Response) {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const { resourceId, start, end, qty, notes } = parsed.data;

  const conflict = await hasConflict(resourceId, start, end, qty);
  if (conflict) return res.status(409).json({ message: 'Resource not available for the requested time/qty' });

  const booking = await prisma.booking.create({
    data: {
      resourceId,
      userId: req.user!.id,
      start,
      end,
      qty,
      notes,
      status: 'PENDING',
    },
  });
  res.status(201).json(booking);
}

export async function updateBookingStatus(req: AuthedRequest, res: Response) {
  const parsed = updateBookingStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const id = req.params.id;
  try {
    const updated = await prisma.booking.update({ where: { id }, data: { status: parsed.data.status } });
    res.json(updated);
  } catch {
    res.status(404).json({ message: 'Booking not found' });
  }
}

export async function cancelBooking(req: AuthedRequest, res: Response) {
  const id = req.params.id;
  try {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (req.user!.role !== 'ADMIN' && booking.userId !== req.user!.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Failed to cancel booking' });
  }
}
