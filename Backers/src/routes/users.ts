import { Router } from 'express';
import { me, listUsers } from '../controllers/users.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
r.get('/me', requireAuth, me);
r.get('/', requireAuth, requireRole('ADMIN','STAFF'), listUsers);
export default r;
