import { Router } from 'express';
import { cancelBooking, createBooking, listBookings, updateBookingStatus } from '../controllers/bookings.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
r.get('/', requireAuth, listBookings);
r.post('/', requireAuth, createBooking);
r.patch('/:id/status', requireAuth, requireRole('ADMIN','STAFF'), updateBookingStatus);
r.post('/:id/cancel', requireAuth, cancelBooking);
export default r;
