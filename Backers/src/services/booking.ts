import { prisma } from '../db.js';

export async function hasConflict(resourceId: string, start: Date, end: Date, qty: number) {
  // Sum qty of overlapping bookings with APPROVED or PENDING (active holds)
  const overlaps = await prisma.booking.findMany({
    where: {
      resourceId,
      status: { in: ['APPROVED', 'PENDING'] },
      NOT: [
        { end: { lte: start } },
        { start: { gte: end } },
      ],
    },
    select: { qty: true },
  });
  const totalHeld = overlaps.reduce((a, b) => a + b.qty, 0);
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw Object.assign(new Error('Resource not found'), { status: 404 });
  return totalHeld + qty > resource.qtyTotal;
}
