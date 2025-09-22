import { Request, Response } from 'express';
import { prisma } from '../db.js';
import bcrypt from 'bcryptjs';
import { sign } from '../utils/jwt.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const { email, name, password, role } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: 'Email already in use' });
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, password: hashed, role: role ?? 'STUDENT' },
  });
  const token = sign({ sub: user.id, role: user.role });
  return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = sign({ sub: user.id, role: user.role });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
