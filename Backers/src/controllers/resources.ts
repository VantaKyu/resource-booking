import { Request, Response } from 'express';
import { prisma } from '../db.js';
import { createResourceSchema, updateResourceSchema } from '../schemas/resource.js';

export async function listResources(_req: Request, res: Response) {
  const items = await prisma.resource.findMany({ orderBy: { name: 'asc' } });
  res.json(items);
}

export async function createResource(req: Request, res: Response) {
  const parsed = createResourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const item = await prisma.resource.create({ data: parsed.data });
  res.status(201).json(item);
}

export async function updateResource(req: Request, res: Response) {
  const parsed = updateResourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const id = req.params.id;
  try {
    const item = await prisma.resource.update({ where: { id }, data: parsed.data });
    res.json(item);
  } catch {
    res.status(404).json({ message: 'Resource not found' });
  }
}
