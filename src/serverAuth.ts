import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { query } from './db/index';

export type AuthUser = {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'Consultant' | 'Manager' | 'RH' | 'Admin';
  avatar?: string | null;
  title?: string | null;
  department?: string | null;
  status?: string | null;
};

type SessionPayload = AuthUser & { exp: number; iat: number };
const COOKIE_NAME = 'interflow_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || '';
if (process.env.NODE_ENV === 'production' && SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}

const b64 = (value: Buffer | string) => Buffer.from(value).toString('base64url');
const sign = (value: string) => b64(crypto.createHmac('sha256', SESSION_SECRET).update(value).digest());

export function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, saltValue, hashValue] = String(stored || '').split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function encodeSession(user: AuthUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { ...user, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): AuthUser | null {
  try {
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;
    const expected = sign(body);
    const actual = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.id,
      email: payload.email,
      nom: payload.nom,
      prenom: payload.prenom,
      role: payload.role === 'Admin' || payload.role === 'Manager' || payload.role === 'RH' || payload.role === 'Consultant' ? payload.role : 'Consultant',
      avatar: payload.avatar,
      title: payload.title,
      department: payload.department,
      status: payload.status,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, user: AuthUser) {
  res.cookie(COOKIE_NAME, encodeSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function getCurrentUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.cookie || '';
  const token = header
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;

  const sessionUser = decodeSession(token);
  if (!sessionUser) return null;

  const result = await query<{
    id: number; email: string; nom: string; prenom: string; role: string;
    avatar: string | null; title: string | null; department: string | null; status: string | null;
  }>(
    `SELECT id, email, nom, prenom, role, avatar, title, department, status
     FROM users WHERE id = $1 LIMIT 1`,
    [Number(sessionUser.id)]
  );

  const user = result.rows[0];
  if (!user || user.status !== 'Actif') return null;

  return {
    ...user,
    id: String(user.id),
    role: (['Consultant', 'Manager', 'RH', 'Admin'].includes(user.role) ? user.role : 'Consultant') as AuthUser['role'],
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  getCurrentUser(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'Authentification requise' });
      (req as Request & { user: AuthUser }).user = user;
      next();
    })
    .catch(next);
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user) return res.status(401).json({ error: 'Authentification requise' });
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Accès interdit' });
    next();
  };
}
