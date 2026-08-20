import express from 'express';
import path from 'path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db/index';
import { users } from './src/db/schema';
import { setSessionCookie, clearSessionCookie, requireAuth, requireRole, getCurrentUser } from './src/serverAuth';
import { ConfidentialClientApplication } from '@azure/msal-node';

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
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '2mb' }));

const requestCounts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(limit: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = requestCounts.get(key);
    if (!current || current.resetAt <= now) requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    else current.count += 1;
    const state = requestCounts.get(key)!;
    if (state.count > limit) return res.status(429).json({ error: 'Trop de requêtes, veuillez réessayer plus tard.' });
    next();
  };
}

async function ensureDatabaseSchema() {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, uid TEXT UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT, nom TEXT NOT NULL, prenom TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'Consultant', title TEXT, department TEXT, avatar TEXT, status TEXT DEFAULT 'Actif', last_login TEXT, created_at TIMESTAMP DEFAULT NOW());`));
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS consultants (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), name TEXT NOT NULL, role TEXT NOT NULL, seniority TEXT NOT NULL, tjm INTEGER NOT NULL, tjm_min INTEGER, disponibilite TEXT NOT NULL, mobilite TEXT DEFAULT 'National', statut TEXT NOT NULL DEFAULT 'Intercontrat', ats_score INTEGER NOT NULL DEFAULT 85, location TEXT DEFAULT 'Paris & Île-de-France', experience_years INTEGER DEFAULT 5, description TEXT, avatar TEXT, competences TEXT NOT NULL, certifications TEXT, langues TEXT, recommandations_ia TEXT, history_intercontrat TEXT, updated_at TIMESTAMP DEFAULT NOW());`));
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS missions (id SERIAL PRIMARY KEY, title TEXT NOT NULL, client TEXT NOT NULL, secteur TEXT NOT NULL, location TEXT NOT NULL, tjm INTEGER NOT NULL, duree TEXT NOT NULL, start_date TEXT NOT NULL, tjm_cible TEXT, statut TEXT NOT NULL DEFAULT 'Ouverte', competences_requises TEXT NOT NULL, description TEXT NOT NULL, remote TEXT DEFAULT 'Hybride', urgent BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW());`));
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS formations (id SERIAL PRIMARY KEY, title TEXT NOT NULL, provider TEXT NOT NULL, duration TEXT NOT NULL, level TEXT NOT NULL, badge TEXT NOT NULL, category TEXT NOT NULL, skills_targeted TEXT NOT NULL, url TEXT NOT NULL, popularity INTEGER DEFAULT 95, impact_employabilite TEXT DEFAULT '+25%', created_at TIMESTAMP DEFAULT NOW());`));
}

const ENTRA_TENANT_ID=process.env.ENTRA_TENANT_ID?.trim();
const ENTRA_CLIENT_ID=process.env.ENTRA_CLIENT_ID?.trim();
const ENTRA_CLIENT_SECRET=process.env.ENTRA_CLIENT_SECRET?.trim();
const ENTRA_REDIRECT_URI=process.env.ENTRA_REDIRECT_URI?.trim();
const ENTRA_ADMIN_EMAIL=process.env.ENTRA_ADMIN_EMAIL?.trim().toLowerCase();
const ENTRA_POST_LOGOUT_REDIRECT_URI=process.env.ENTRA_POST_LOGOUT_REDIRECT_URI?.trim() || '/';
if(process.env.NODE_ENV==='production' && (!ENTRA_TENANT_ID||!ENTRA_CLIENT_ID||!ENTRA_CLIENT_SECRET||!ENTRA_REDIRECT_URI||!ENTRA_ADMIN_EMAIL)) throw new Error('ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, ENTRA_REDIRECT_URI et ENTRA_ADMIN_EMAIL sont requis en production.');
const msalClient=new ConfidentialClientApplication({auth:{clientId:ENTRA_CLIENT_ID||'missing',authority:`https://login.microsoftonline.com/${ENTRA_TENANT_ID||'organizations'}`,clientSecret:ENTRA_CLIENT_SECRET||'missing'}});
const entraStateCookie='interflow_entra_state';
const entraScopes=['openid','profile','email'];
function same(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}

app.get('/api/auth/entra/login',async(_req,res)=>{try{const state=randomBytes(24).toString('hex');res.cookie(entraStateCookie,state,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600000,path:'/'});const url=await msalClient.getAuthCodeUrl({scopes:entraScopes,redirectUri:ENTRA_REDIRECT_URI!,state,prompt:'select_account'});res.redirect(url);}catch(err){console.error('Entra login:',err);res.status(500).send("Impossible d'initialiser la connexion Microsoft Entra ID.");}});

app.get('/api/auth/entra/callback',async(req,res)=>{try{const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${entraStateCookie}=`))?.split('=').slice(1).join('=')||'';const state=String(req.query.state||'');if(!cookie||!state||!same(cookie,state))return res.status(400).send("État d'authentification invalide.");res.clearCookie(entraStateCookie,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});const code=String(req.query.code||'');if(!code)return res.status(400).send("Code d'authentification manquant.");const result=await msalClient.acquireTokenByCode({code,scopes:entraScopes,redirectUri:ENTRA_REDIRECT_URI!});const claims:any=result.idTokenClaims||{};const email=String(claims.preferred_username||claims.email||result.account?.username||'').trim().toLowerCase();const displayName=String(claims.name||result.account?.name||'').trim();const parts=displayName.split(/\s+/).filter(Boolean);const prenom=parts.shift()||'Admin';const nom=parts.join(' ')||'InterFlow';const oid=String(claims.oid||result.account?.localAccountId||'');const tid=String(claims.tid||result.account?.tenantId||'');if(!email)return res.status(403).send('Adresse Microsoft Entra ID introuvable dans le jeton.');if(ENTRA_TENANT_ID&&tid&&tid!==ENTRA_TENANT_ID)return res.status(403).send('Tenant Microsoft Entra ID non autorisé.');let rows=await db.select().from(users).where(eq(users.email,email)).limit(1);let user=rows[0];if(!user){if(!ENTRA_ADMIN_EMAIL||email!==ENTRA_ADMIN_EMAIL)return res.status(403).send("Ce compte Microsoft Entra ID n'est pas habilité dans InterFlow.");[user]=await db.insert(users).values({uid:oid||null,email,nom,prenom,role:'Admin',title:'Administrateur SI',department:'DSI',status:'Actif'}).returning();}else if(email===ENTRA_ADMIN_EMAIL){await db.update(users).set({role:'Admin',status:'Actif',uid:oid||user.uid,lastLogin:new Date().toISOString()}).where(eq(users.id,user.id));rows=await db.select().from(users).where(eq(users.id,user.id)).limit(1);user=rows[0];}else{if(user.status!=='Actif')return res.status(403).send('Votre profil InterFlow est désactivé.');await db.update(users).set({uid:oid||user.uid,lastLogin:new Date().toISOString()}).where(eq(users.id,user.id));}
const sessionUser={id:String(user.id),email:user.email,nom:user.nom,prenom:user.prenom,role:user.role as any,avatar:user.avatar,title:user.title,department:user.department,status:user.status};setSessionCookie(res,sessionUser);res.redirect('/');}catch(err:any){console.error('Entra callback:',err);res.status(500).send("Échec de l'authentification Microsoft Entra ID.");}});

app.get('/api/auth/me', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });
  res.json({ user });
});


app.get('/api/auth/logout', (req,res)=>{ clearSessionCookie(res); if(String(req.query.entra||'')==='1'&&ENTRA_TENANT_ID&&ENTRA_POST_LOGOUT_REDIRECT_URI){const u=new URL(`https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/logout`);u.searchParams.set('post_logout_redirect_uri',ENTRA_POST_LOGOUT_REDIRECT_URI.startsWith('http')?ENTRA_POST_LOGOUT_REDIRECT_URI:`${String(req.protocol)}://${String(req.get('host'))}${ENTRA_POST_LOGOUT_REDIRECT_URI}`);return res.redirect(u.toString());} return res.redirect('/');});

// Database Health & Test Connection Endpoint
app.get('/api/db/test', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const { createPool } = await import('./src/db/index');
    const pool = createPool();
    const startTime = Date.now();
    const result = await pool.query('SELECT NOW() as current_time, current_database() as db_name, version() as pg_version');
    const duration = Date.now() - startTime;

    return res.json({
      status: 'success',
      message: 'Connexion PostgreSQL réussie',
      latencyMs: duration,
      database: result.rows[0].db_name,
      timestamp: result.rows[0].current_time,
      version: result.rows[0].pg_version
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de se connecter à PostgreSQL',
      details: error.message
    });
  }
});

// DB Users Endpoint
async function serializeUserRows() {
  const allUsers = await db.select({
    id: users.id,
    uid: users.uid,
    email: users.email,
    nom: users.nom,
    prenom: users.prenom,
    role: users.role,
    title: users.title,
    department: users.department,
    avatar: users.avatar,
    status: users.status,
    lastLogin: users.lastLogin,
    createdAt: users.createdAt,
  }).from(users);
  return allUsers.map(u => ({
    ...u,
    id: String(u.id),
    title: u.title ?? '',
    department: u.department ?? '',
    avatar: u.avatar ?? '',
    status: u.status ?? 'Actif',
  }));
}

app.get('/api/db/users', requireAuth, requireRole('Admin'), async (_req, res) => {
  try {
    const rows = await serializeUserRows();
    return res.json({ status: 'success', count: rows.length, users: rows });
  } catch (error: any) {
    console.error('GET /api/db/users failed:', error);
    return res.status(500).json({ status: 'error', error: 'Erreur lors de la récupération des utilisateurs', details: error?.message || 'Erreur SQL inconnue' });
  }
});

app.post('/api/db/users', requireAuth, requireRole('Admin'), async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const nom = String(body.nom ?? '').trim();
  const prenom = String(body.prenom ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = String(body.role ?? '');
  const title = String(body.title ?? '').trim() || null;
  const department = String(body.department ?? '').trim() || null;
  const status = String(body.status ?? 'Actif');

  if (!nom || !prenom || !email || !role) {
    return res.status(400).json({ error: 'Nom, prénom, email et rôle sont obligatoires.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (!['Consultant', 'Manager', 'RH', 'Admin'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }
  if (!['Actif', 'Inactif', 'Suspendu'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  try {
    const duplicate = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (duplicate[0]) return res.status(409).json({ error: 'Cette adresse email existe déjà.' });

    const [created] = await db.insert(users).values({
      uid: null,
      email,
      nom,
      prenom,
      role,
      title,
      department,
      status,
    }).returning({
      id: users.id,
      uid: users.uid,
      email: users.email,
      nom: users.nom,
      prenom: users.prenom,
      role: users.role,
      title: users.title,
      department: users.department,
      avatar: users.avatar,
      status: users.status,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    });

    if (!created) {
      return res.status(500).json({ error: 'La base n’a pas retourné l’utilisateur créé.' });
    }

    return res.status(201).json({
      status: 'success',
      user: {
        ...created,
        id: String(created.id),
        title: created.title ?? '',
        department: created.department ?? '',
        avatar: created.avatar ?? '',
        status: created.status ?? 'Actif',
      },
    });
  } catch (error: any) {
    console.error('POST /api/db/users failed:', error);
    if (error?.code === '23505') return res.status(409).json({ error: 'Cette adresse email existe déjà.' });
    if (error?.code === '23502') return res.status(400).json({ error: 'Un champ obligatoire de la table users est absent ou invalide.', details: error?.detail || error?.message });
    return res.status(500).json({ error: 'Erreur SQL lors de la création du profil utilisateur.', details: error?.message || 'Erreur SQL inconnue' });
  }
});

app.patch('/api/db/users/:id', requireAuth, requireRole('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const allowed = ['nom', 'prenom', 'email', 'role', 'title', 'department', 'status'] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) patch[key] = key === 'email' ? String(req.body[key]).trim().toLowerCase() : req.body[key];
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Aucune modification fournie' });
  if (patch.role && !['Consultant', 'Manager', 'RH', 'Admin'].includes(String(patch.role))) return res.status(400).json({ error: 'Rôle invalide' });
  try {
    if (patch.email && !String(patch.email).includes('@')) return res.status(400).json({ error: 'Adresse email invalide' });
    const [updated] = await db.update(users).set(patch as any).where(eq(users.id, id)).returning({ id: users.id, email: users.email, nom: users.nom, prenom: users.prenom, role: users.role, title: users.title, department: users.department, avatar: users.avatar, status: users.status, lastLogin: users.lastLogin, createdAt: users.createdAt });
    if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.json({ user: { ...updated, id: String(updated.id) } });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Cette adresse email existe déjà' });
    console.error('PATCH /api/db/users/:id failed:', error);
    return res.status(500).json({ error: 'Erreur SQL lors de la mise à jour du profil.', details: error?.message || 'Erreur SQL inconnue' });
  }
});

app.delete('/api/db/users/:id', requireAuth, requireRole('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  const current = (req as any).user;
  if (String(id) === String(current.id)) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  const target = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  if (!target[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (target[0].role === 'Admin') {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'Admin'));
    if (admins.length <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur.' });
  }
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.status(204).end();
});

// Local CV analysis endpoint (no external AI dependency)
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
    const extractedSkills = catalog.filter(([n]) => lower.includes(n.toLowerCase())).map(([name, category, level]) => ({ name, category, level }));
    const extractedCertifications = ['PL-200', 'PL-600', 'AI-102', 'DP-600', 'SC-100'].filter(x => lower.includes(x.toLowerCase()));
    const missingKeywords = ['Architecture Solution', 'Gouvernance', 'API REST', 'CI/CD'].filter(x => !lower.includes(x.toLowerCase()));
    const score = Math.min(100, 50 + extractedSkills.length * 7 + extractedCertifications.length * 4 + (cvText.length > 600 ? 8 : 0));
    return res.json({ score, summary: extractedSkills.length ? `Analyse locale : ${extractedSkills.length} compétences détectées.` : 'Ajoutez davantage de contenu au CV pour obtenir un diagnostic plus précis.', extractedSkills, extractedCertifications, missingKeywords, contentSuggestions: missingKeywords.slice(0,2).map(keyword => ({ originalText: 'Expérience professionnelle', suggestedText: `Ajouter une réalisation mesurable intégrant ${keyword}.`, reason: `Renforcer le positionnement du CV sur ${keyword}.` })), skillSuggestions: missingKeywords.slice(0,3) });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de l’analyse du CV', details: error.message });
  }
});

// Local CV generation endpoint (no external AI dependency)
app.post('/api/generate-cv', requireAuth, rateLimit(20, 60 * 1000), async (req, res) => {
  try {
    const consultant = req.body?.consultant || {};
    const targetType = ['client','technique','management','commercial'].includes(req.body?.targetType) ? req.body.targetType : 'client';
    const labels: Record<string, { title: string; badge: string; targetAudience: string }> = {
      client: { title: 'CV orienté Client', badge: 'VALEUR MÉTIER', targetAudience: 'Décideurs et responsables métiers' },
      technique: { title: 'CV orienté Technique', badge: 'EXPERTISE', targetAudience: 'Architectes et responsables techniques' },
      management: { title: 'CV orienté Management', badge: 'GOUVERNANCE', targetAudience: 'Directions et chefs de programme' },
      commercial: { title: 'CV orienté Commercial', badge: 'APPEL D’OFFRES', targetAudience: 'Directions commerciales et achats' },
    };
    const meta = labels[targetType];
    const skills = Array.isArray(consultant.competences) ? consultant.competences.slice(0,6).map((c: any) => c.libelle || c.name).filter(Boolean) : [];
    const certs = Array.isArray(consultant.certifications) ? consultant.certifications.slice(0,5).map((c: any) => c.nom || c.code).filter(Boolean) : [];
    return res.json({ type: targetType, title: `${meta.title} — ${consultant.prenom || ''} ${consultant.nom || ''}`.trim(), badge: meta.badge, targetAudience: meta.targetAudience, profileSummary: `Consultant ${consultant.grade || 'Senior'} spécialisé en ${consultant.title || 'solutions digitales'}.`, highlightedSkills: skills, experienceFormat: [{ company: 'InterFlow', role: consultant.title || 'Consultant IT', period: 'Expérience récente', bulletPoints: ['Conception et déploiement de solutions métier.', 'Analyse des besoins, architecture et mise en production.', 'Accompagnement utilisateurs et amélioration continue.'] }], certificationsFormatted: certs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erreur lors de la génération du CV', details: error.message });
  }
});

async function startServer() {
  await ensureDatabaseSchema();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
