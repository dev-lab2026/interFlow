import express from 'express';
import path from 'path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { createPool, query, withTransaction } from './src/db/index';
import {
  createPasswordHash,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireRole,
  getCurrentUser,
} from './src/serverAuth';

dotenv.config();

const __dirname = process.cwd();
const app = express();
const PORT = Number(process.env.PORT || 3003);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: '2mb' }));

const requestCounts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(limit: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = requestCounts.get(key);
    if (!current || current.resetAt <= now) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      current.count += 1;
    }
    const state = requestCounts.get(key)!;
    if (state.count > limit) {
      return res.status(429).json({ error: 'Trop de requêtes, veuillez réessayer plus tard.' });
    }
    next();
  };
}

const allowedRoles = ['Consultant', 'Manager', 'RH', 'Admin'] as const;
const allowedStatuses = ['Actif', 'Inactif', 'Suspendu'] as const;

type DbUser = {
  id: number;
  uid: string | null;
  email: string;
  password_hash: string | null;
  nom: string;
  prenom: string;
  role: string;
  title: string | null;
  department: string | null;
  avatar: string | null;
  status: string | null;
  last_login: string | null;
  created_at: string | null;
};

function serializeUser(user: DbUser) {
  return {
    id: String(user.id),
    uid: user.uid,
    email: user.email,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role,
    title: user.title ?? '',
    department: user.department ?? '',
    avatar: user.avatar ?? '',
    status: user.status ?? 'Actif',
    lastLogin: user.last_login ?? 'Jamais',
    createdAt: user.created_at,
  };
}

function userSession(user: DbUser) {
  return {
    id: String(user.id),
    email: user.email,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role as 'Consultant' | 'Manager' | 'RH' | 'Admin',
    avatar: user.avatar,
    title: user.title,
    department: user.department,
    status: user.status,
  };
}

async function ensureDatabaseSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Consultant',
      title TEXT,
      department TEXT,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'Actif',
      last_login TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS consultants (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      seniority TEXT NOT NULL,
      tjm INTEGER NOT NULL,
      tjm_min INTEGER,
      disponibilite TEXT NOT NULL,
      mobilite TEXT DEFAULT 'National',
      statut TEXT NOT NULL DEFAULT 'Intercontrat',
      ats_score INTEGER NOT NULL DEFAULT 85,
      location TEXT DEFAULT 'Paris & Île-de-France',
      experience_years INTEGER DEFAULT 5,
      description TEXT,
      avatar TEXT,
      competences TEXT NOT NULL,
      certifications TEXT,
      langues TEXT,
      recommandations_ia TEXT,
      history_intercontrat TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS missions (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      client TEXT NOT NULL,
      secteur TEXT NOT NULL,
      location TEXT NOT NULL,
      tjm INTEGER NOT NULL,
      duree TEXT NOT NULL,
      start_date TEXT NOT NULL,
      tjm_cible TEXT,
      statut TEXT NOT NULL DEFAULT 'Ouverte',
      competences_requises TEXT NOT NULL,
      description TEXT NOT NULL,
      remote TEXT DEFAULT 'Hybride',
      urgent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS formations (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      provider TEXT NOT NULL,
      duration TEXT NOT NULL,
      level TEXT NOT NULL,
      badge TEXT NOT NULL,
      category TEXT NOT NULL,
      skills_targeted TEXT NOT NULL,
      url TEXT NOT NULL,
      popularity INTEGER DEFAULT 95,
      impact_employabilite TEXT DEFAULT '+25%',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS uid TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Actif'`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
}

async function ensureAdminAccount() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD sont obligatoires pour le compte admin initial.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD doit contenir au moins 12 caractères.');
  }

  const existing = await query<DbUser>(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
  if (existing.rows[0]) {
    await query(
      `UPDATE users SET role='Admin', status='Actif', password_hash=COALESCE(password_hash,$2) WHERE id=$1`,
      [existing.rows[0].id, createPasswordHash(password)]
    );
    return;
  }

  await query(
    `INSERT INTO users (email,password_hash,nom,prenom,role,title,department,status)
     VALUES ($1,$2,$3,$4,'Admin','Administrateur SI','DSI','Actif')`,
    [email, createPasswordHash(password), 'Admin', 'InterFlow']
  );
  console.log(`Initial admin ensured: ${email}`);
}

// -------------------------
// Microsoft Entra ID
// -------------------------
const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID?.trim();
const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID?.trim();
const ENTRA_CLIENT_SECRET = process.env.ENTRA_CLIENT_SECRET?.trim();
const ENTRA_REDIRECT_URI = process.env.ENTRA_REDIRECT_URI?.trim();
const ENTRA_ADMIN_EMAIL = process.env.ENTRA_ADMIN_EMAIL?.trim().toLowerCase();
const ENTRA_POST_LOGOUT_REDIRECT_URI = process.env.ENTRA_POST_LOGOUT_REDIRECT_URI?.trim() || '/';

if (
  process.env.NODE_ENV === 'production' &&
  (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID || !ENTRA_CLIENT_SECRET || !ENTRA_REDIRECT_URI)
) {
  throw new Error('ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET et ENTRA_REDIRECT_URI sont requis en production.');
}

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: ENTRA_CLIENT_ID || 'missing',
    authority: `https://login.microsoftonline.com/${ENTRA_TENANT_ID || 'organizations'}`,
    clientSecret: ENTRA_CLIENT_SECRET || 'missing',
  },
});

const entraStateCookie = 'interflow_entra_state';
const entraScopes = ['openid', 'profile', 'email'];

function constantTimeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function safeAuthError(message: string) {
  return encodeURIComponent(message).slice(0, 500);
}

app.get('/api/auth/entra/login', async (_req, res) => {
  try {
    if (!ENTRA_REDIRECT_URI) return res.status(503).send('ENTRA_REDIRECT_URI n’est pas configuré.');
    const state = randomBytes(32).toString('hex');
    res.cookie(entraStateCookie, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    const url = await msalClient.getAuthCodeUrl({
      scopes: entraScopes,
      redirectUri: ENTRA_REDIRECT_URI,
      state,
      prompt: 'select_account',
    });
    return res.redirect(url);
  } catch (error) {
    console.error('Entra login error:', error);
    return res.redirect(`/?auth_error=${safeAuthError('Impossible d’initialiser la connexion Microsoft Entra ID.')}`);
  }
});

app.get('/api/auth/entra/callback', async (req, res) => {
  try {
    if (!ENTRA_REDIRECT_URI) return res.status(503).send('ENTRA_REDIRECT_URI n’est pas configuré.');

    const rawCookie = String(req.headers.cookie || '');
    const cookieValue = rawCookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${entraStateCookie}=`))
      ?.slice(entraStateCookie.length + 1) || '';
    const state = String(req.query.state || '');
    if (!cookieValue || !state || !constantTimeEqual(cookieValue, state)) {
      return res.redirect(`/?auth_error=${safeAuthError('État d’authentification Entra invalide. Relancez la connexion.')}`);
    }

    res.clearCookie(entraStateCookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

    const code = String(req.query.code || '');
    const authError = String(req.query.error || '');
    if (authError) {
      const description = String(req.query.error_description || authError);
      return res.redirect(`/?auth_error=${safeAuthError(`Microsoft Entra : ${description}`)}`);
    }
    if (!code) {
      return res.redirect(`/?auth_error=${safeAuthError('Code d’authentification Entra manquant.')}`);
    }

    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes: entraScopes,
      redirectUri: ENTRA_REDIRECT_URI,
    });

    if (!tokenResponse?.account) {
      return res.redirect(`/?auth_error=${safeAuthError('Compte Microsoft Entra introuvable dans la réponse.')}`);
    }

    const claims = (tokenResponse.idTokenClaims || {}) as Record<string, unknown>;
    const email = String(
      claims.preferred_username ||
      claims.email ||
      tokenResponse.account.username ||
      ''
    ).trim().toLowerCase();
    const displayName = String(claims.name || tokenResponse.account.name || '').trim();
    const tenantId = String(claims.tid || tokenResponse.account.tenantId || '').trim();
    const oid = String(claims.oid || tokenResponse.account.homeAccountId || '').trim();

    if (!email) return res.redirect(`/?auth_error=${safeAuthError('Aucune adresse email n’a été fournie par Entra ID.')}`);
    if (ENTRA_TENANT_ID && tenantId && tenantId !== ENTRA_TENANT_ID) {
      return res.redirect(`/?auth_error=${safeAuthError('Le tenant Microsoft Entra utilisé n’est pas autorisé.')}`);
    }

    const parts = displayName.split(/\s+/).filter(Boolean);
    const prenom = parts.shift() || email.split('@')[0] || 'Utilisateur';
    const nom = parts.join(' ') || 'InterFlow';

    let result = await query<DbUser>(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
    let user = result.rows[0];

    if (!user) {
      if (!ENTRA_ADMIN_EMAIL || email !== ENTRA_ADMIN_EMAIL) {
        return res.redirect(`/?auth_error=${safeAuthError('Ce compte Entra ID n’est pas encore habilité dans InterFlow.')}`);
      }

      result = await query<DbUser>(
        `INSERT INTO users (uid,email,password_hash,nom,prenom,role,title,department,status,last_login)
         VALUES ($1,$2,NULL,$3,$4,'Admin','Administrateur SI','DSI','Actif',NOW()::text)
         RETURNING *`,
        [oid || null, email, nom, prenom]
      );
      user = result.rows[0];
    } else {
      if (user.status !== 'Actif') {
        return res.redirect(`/?auth_error=${safeAuthError('Votre profil InterFlow est désactivé.')}`);
      }
      if (ENTRA_ADMIN_EMAIL && email === ENTRA_ADMIN_EMAIL) {
        result = await query<DbUser>(
          `UPDATE users SET uid=COALESCE($2,uid), role='Admin', status='Actif', last_login=NOW()::text WHERE id=$1 RETURNING *`,
          [user.id, oid || null]
        );
      } else {
        result = await query<DbUser>(
          `UPDATE users SET uid=COALESCE($2,uid), last_login=NOW()::text WHERE id=$1 RETURNING *`,
          [user.id, oid || null]
        );
      }
      user = result.rows[0];
    }

    setSessionCookie(res, userSession(user));
    return res.redirect('/');
  } catch (error: any) {
    console.error('Entra callback error:', error);
    const detail = String(error?.message || 'Échec de l’authentification Microsoft Entra ID.');
    return res.redirect(`/?auth_error=${safeAuthError(detail)}`);
  }
});

// -------------------------
// Local admin login
// -------------------------
app.post('/api/auth/login', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const result = await query<DbUser>(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
    const user = result.rows[0];
    if (!user || user.status !== 'Actif' || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    await query(`UPDATE users SET last_login=NOW()::text WHERE id=$1`, [user.id]);
    const session = userSession(user);
    setSessionCookie(res, session);
    return res.json({ user: session });
  } catch (error: any) {
    console.error('Local admin login error:', error);
    return res.status(500).json({ error: 'Erreur lors de la connexion.', details: error?.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    return res.json({ user });
  } catch (error: any) {
    console.error('/api/auth/me:', error);
    return res.status(500).json({ error: 'Erreur de session.', details: error?.message });
  }
});

app.get('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  if (String(req.query.entra || '') === '1' && ENTRA_TENANT_ID) {
    const postLogout = ENTRA_POST_LOGOUT_REDIRECT_URI.startsWith('http')
      ? ENTRA_POST_LOGOUT_REDIRECT_URI
      : `${String(req.protocol)}://${String(req.get('host'))}${ENTRA_POST_LOGOUT_REDIRECT_URI}`;
    const logoutUrl = new URL(`https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/logout`);
    logoutUrl.searchParams.set('post_logout_redirect_uri', postLogout);
    return res.redirect(logoutUrl.toString());
  }
  return res.redirect('/');
});

// -------------------------
// PostgreSQL
// -------------------------
app.get('/api/health', async (_req, res) => {
  try {
    const result = await query<{ now: string }>('SELECT NOW() as now');
    return res.json({ status: 'ok', service: 'InterFlow API Server', database: 'postgresql', timestamp: result.rows[0]?.now });
  } catch (error: any) {
    return res.status(503).json({ status: 'error', error: 'PostgreSQL indisponible', details: error?.message });
  }
});

app.get('/api/db/test', requireAuth, requireRole('Admin'), async (_req, res) => {
  try {
    const start = Date.now();
    const result = await query<{ current_time: string; db_name: string; pg_version: string }>('SELECT NOW() as current_time, current_database() as db_name, version() as pg_version');
    return res.json({ status: 'success', message: 'Connexion PostgreSQL réussie', latencyMs: Date.now() - start, database: result.rows[0].db_name, timestamp: result.rows[0].current_time, version: result.rows[0].pg_version });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: 'Impossible de se connecter à PostgreSQL', details: error?.message });
  }
});

async function serializeUserRows() {
  const result = await query<DbUser>(`SELECT id,uid,email,password_hash,nom,prenom,role,title,department,avatar,status,last_login,created_at FROM users ORDER BY id DESC`);
  return result.rows.map(serializeUser);
}

app.get('/api/db/users', requireAuth, requireRole('Admin'), async (_req, res) => {
  try {
    const users = await serializeUserRows();
    return res.json({ status: 'success', count: users.length, users });
  } catch (error: any) {
    console.error('GET /api/db/users failed:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.', details: error?.message });
  }
});

app.post('/api/db/users', requireAuth, requireRole('Admin'), async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const nom = String(body.nom ?? '').trim();
  const prenom = String(body.prenom ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const role = String(body.role ?? 'Consultant');
  const title = String(body.title ?? '').trim() || null;
  const department = String(body.department ?? '').trim() || null;
  const status = String(body.status ?? 'Actif');

  if (!nom || !prenom || !email || !role) return res.status(400).json({ error: 'Nom, prénom, email et rôle sont obligatoires.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Adresse email invalide.' });
  if (!(allowedRoles as readonly string[]).includes(role)) return res.status(400).json({ error: 'Rôle invalide.' });
  if (!(allowedStatuses as readonly string[]).includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
  if (password && password.length < 12) return res.status(400).json({ error: 'Si un mot de passe local est défini, il doit contenir au moins 12 caractères.' });

  try {
    const result = await query<DbUser>(
      `INSERT INTO users (uid,email,password_hash,nom,prenom,role,title,department,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,uid,email,password_hash,nom,prenom,role,title,department,avatar,status,last_login,created_at`,
      [randomBytes(16).toString('hex'), email, password ? createPasswordHash(password) : null, nom, prenom, role, title, department, status]
    );
    return res.status(201).json({ status: 'success', user: serializeUser(result.rows[0]) });
  } catch (error: any) {
    console.error('POST /api/db/users failed:', error);
    if (error?.code === '23505') return res.status(409).json({ error: 'Cette adresse email existe déjà.' });
    return res.status(500).json({ error: 'Erreur SQL lors de la création du profil utilisateur.', details: error?.message });
  }
});

app.patch('/api/db/users/:id', requireAuth, requireRole('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
  const current = (req as express.Request & { user?: { id: string; role: string } }).user;
  const body = req.body || {};

  const fields: Record<string, unknown> = {};
  if (body.nom !== undefined) fields.nom = String(body.nom).trim();
  if (body.prenom !== undefined) fields.prenom = String(body.prenom).trim();
  if (body.email !== undefined) fields.email = String(body.email).trim().toLowerCase();
  if (body.role !== undefined) fields.role = String(body.role);
  if (body.title !== undefined) fields.title = String(body.title).trim() || null;
  if (body.department !== undefined) fields.department = String(body.department).trim() || null;
  if (body.status !== undefined) fields.status = String(body.status);
  if (body.password !== undefined && body.password !== '') {
    const password = String(body.password);
    if (password.length < 12) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 12 caractères.' });
    fields.password_hash = createPasswordHash(password);
  }
  if (!Object.keys(fields).length) return res.status(400).json({ error: 'Aucune modification fournie.' });
  if (fields.role && !(allowedRoles as readonly string[]).includes(String(fields.role))) return res.status(400).json({ error: 'Rôle invalide.' });
  if (fields.status && !(allowedStatuses as readonly string[]).includes(String(fields.status))) return res.status(400).json({ error: 'Statut invalide.' });
  if (fields.email && !/^\S+@\S+\.\S+$/.test(String(fields.email))) return res.status(400).json({ error: 'Adresse email invalide.' });

  if (String(current?.id) === String(id) && fields.status && fields.status !== 'Actif') {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
  }

  try {
    const keys = Object.keys(fields);
    const values = keys.map((key) => fields[key]);
    const assignments = keys.map((key, index) => `${key}=$${index + 1}`).join(', ');
    values.push(id);
    const result = await query<DbUser>(
      `UPDATE users SET ${assignments} WHERE id=$${values.length}
       RETURNING id,uid,email,password_hash,nom,prenom,role,title,department,avatar,status,last_login,created_at`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    return res.json({ status: 'success', user: serializeUser(result.rows[0]) });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Cette adresse email existe déjà.' });
    console.error('PATCH /api/db/users/:id failed:', error);
    return res.status(500).json({ error: 'Erreur SQL lors de la mise à jour du profil.', details: error?.message });
  }
});

app.delete('/api/db/users/:id', requireAuth, requireRole('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  const current = (req as express.Request & { user?: { id: string } }).user;
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
  if (String(id) === String(current?.id)) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });

  try {
    const target = await query<{ id: number; role: string }>('SELECT id,role FROM users WHERE id=$1 LIMIT 1', [id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (target.rows[0].role === 'Admin') {
      const admins = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM users WHERE role='Admin' AND status='Actif'`);
      if (Number(admins.rows[0].count) <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur actif.' });
    }
    const result = await query('DELETE FROM users WHERE id=$1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    return res.status(204).end();
  } catch (error: any) {
    if (error?.code === '23503') return res.status(409).json({ error: 'Impossible de supprimer cet utilisateur : un profil consultant lui est encore rattaché.' });
    console.error('DELETE /api/db/users/:id failed:', error);
    return res.status(500).json({ error: 'Erreur SQL lors de la suppression.', details: error?.message });
  }
});

// -------------------------
// Local CV tools (no external AI)
// -------------------------
app.post('/api/analyze-cv', requireAuth, rateLimit(20, 60 * 1000), async (req, res) => {
  try {
    const cvText = String(req.body?.cvText || '').trim();
    if (!cvText) return res.status(400).json({ error: 'Contenu du CV requis' });
    const lower = cvText.toLowerCase();
    const catalog = [
      ['Power Apps', 'Power Platform', 'Expert'],
      ['Power Automate', 'Power Platform', 'Avancé'],
      ['Dataverse', 'Power Platform', 'Avancé'],
      ['Power BI', 'Data & Power BI', 'Avancé'],
      ['Azure', 'Cloud Azure', 'Intermédiaire'],
      ['SQL', 'Data & Power BI', 'Intermédiaire'],
      ['C#', 'Dev Fullstack', 'Avancé'],
    ] as const;
    const extractedSkills = catalog.filter(([name]) => lower.includes(name.toLowerCase())).map(([name, category, level]) => ({ name, category, level }));
    const extractedCertifications = ['PL-200', 'PL-600', 'AI-102', 'DP-600', 'SC-100'].filter((value) => lower.includes(value.toLowerCase()));
    const missingKeywords = ['Architecture Solution', 'Gouvernance', 'API REST', 'CI/CD'].filter((value) => !lower.includes(value.toLowerCase()));
    const score = Math.min(100, 50 + extractedSkills.length * 7 + extractedCertifications.length * 4 + (cvText.length > 600 ? 8 : 0));
    return res.json({ score, summary: extractedSkills.length ? `Analyse locale : ${extractedSkills.length} compétences détectées.` : 'Ajoutez davantage de contenu au CV pour obtenir un diagnostic plus précis.', extractedSkills, extractedCertifications, missingKeywords, contentSuggestions: missingKeywords.slice(0, 2).map((keyword) => ({ originalText: 'Expérience professionnelle', suggestedText: `Ajouter une réalisation mesurable intégrant ${keyword}.`, reason: `Renforcer le positionnement du CV sur ${keyword}.` })), skillSuggestions: missingKeywords.slice(0, 3) });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de l’analyse du CV', details: error?.message });
  }
});

app.post('/api/generate-cv', requireAuth, rateLimit(20, 60 * 1000), async (req, res) => {
  try {
    const consultant = req.body?.consultant || {};
    const targetType = ['client', 'technique', 'management', 'commercial'].includes(req.body?.targetType) ? req.body.targetType : 'client';
    const labels: Record<string, { title: string; badge: string; targetAudience: string }> = {
      client: { title: 'CV orienté Client', badge: 'VALEUR MÉTIER', targetAudience: 'Décideurs et responsables métiers' },
      technique: { title: 'CV orienté Technique', badge: 'EXPERTISE', targetAudience: 'Architectes et responsables techniques' },
      management: { title: 'CV orienté Management', badge: 'GOUVERNANCE', targetAudience: 'Directions et chefs de programme' },
      commercial: { title: 'CV orienté Commercial', badge: 'APPEL D’OFFRES', targetAudience: 'Directions commerciales et achats' },
    };
    const meta = labels[targetType];
    const skills = Array.isArray(consultant.competences) ? consultant.competences.slice(0, 6).map((c: any) => c.libelle || c.name).filter(Boolean) : [];
    const certs = Array.isArray(consultant.certifications) ? consultant.certifications.slice(0, 5).map((c: any) => c.nom || c.code).filter(Boolean) : [];
    return res.json({ type: targetType, title: `${meta.title} — ${consultant.prenom || ''} ${consultant.nom || ''}`.trim(), badge: meta.badge, targetAudience: meta.targetAudience, profileSummary: `Consultant ${consultant.grade || 'Senior'} spécialisé en ${consultant.title || 'solutions digitales'}.`, highlightedSkills: skills, experienceFormat: [{ company: 'InterFlow', role: consultant.title || 'Consultant IT', period: 'Expérience récente', bulletPoints: ['Conception et déploiement de solutions métier.', 'Analyse des besoins, architecture et mise en production.', 'Accompagnement utilisateurs et amélioration continue.'] }], certificationsFormatted: certs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de la génération du CV', details: error?.message });
  }
});

async function startServer() {
  try {
    await ensureDatabaseSchema();
    await ensureAdminAccount();

    // Verify the DB pool before serving requests.
    await createPool().query('SELECT 1');

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`InterFlow listening on 0.0.0.0:${PORT}`);
      console.log(`PostgreSQL: ${process.env.SQL_HOST || 'interflow-postgres'}:${process.env.SQL_PORT || '5432'}/${process.env.SQL_DB_NAME || 'interflow'}`);
      console.log(`Entra configured: ${Boolean(ENTRA_TENANT_ID && ENTRA_CLIENT_ID && ENTRA_CLIENT_SECRET && ENTRA_REDIRECT_URI)}`);
      console.log(`Admin email: ${String(process.env.ADMIN_EMAIL || '')}`);
    });
  } catch (error) {
    console.error('Failed to start InterFlow:', error);
    process.exit(1);
  }
}

startServer();
