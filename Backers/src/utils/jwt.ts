import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export type JwtPayload = { sub: string; role: string };

export function sign(payload: JwtPayload, expiresIn = '7d') {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}
export function verify(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
