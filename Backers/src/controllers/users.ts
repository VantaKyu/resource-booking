import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

export async function me(req: AuthedRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, name: true, role: true } });
  res.json(user);
}

export async function listUsers(_req: AuthedRequest, res: Response) {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } });
  res.json(users);
}
