import { Router } from 'express';
import { createResource, listResources, updateResource } from '../controllers/resources.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
r.get('/', listResources);
r.post('/', requireAuth, requireRole('ADMIN','STAFF'), createResource);
r.patch('/:id', requireAuth, requireRole('ADMIN','STAFF'), updateResource);
export default r;
