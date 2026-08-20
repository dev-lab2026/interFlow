import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db/index';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export type AuthUser = {
  id: string; email: string; nom: string; prenom: string;
  role: 'Consultant' | 'Manager' | 'RH' | 'Admin';
  avatar?: string | null; title?: string | null; department?: string | null; status?: string | null;
};
type SessionPayload = AuthUser & { exp: number; iat: number };
const COOKIE_NAME = 'interflow_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || '';
if (process.env.NODE_ENV === 'production' && SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
const b64 = (v: Buffer|string) => Buffer.from(v).toString('base64url');
const sign = (v: string) => b64(crypto.createHmac('sha256', SESSION_SECRET).update(v).digest());
function encodeSession(user: AuthUser) { const now=Math.floor(Date.now()/1000); const body=b64(JSON.stringify({...user,iat:now,exp:now+SESSION_TTL_SECONDS})); return `${body}.${sign(body)}`; }
function decodeSession(token:string):AuthUser|null { try { const [body,sig]=token.split('.'); if(!body||!sig)return null; const exp=sign(body); const a=Buffer.from(sig), b=Buffer.from(exp); if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null; const p=JSON.parse(Buffer.from(body,'base64url').toString()) as SessionPayload; if(!p.exp||p.exp<Math.floor(Date.now()/1000))return null; return {id:p.id,email:p.email,nom:p.nom,prenom:p.prenom,role:p.role,avatar:p.avatar,title:p.title,department:p.department,status:p.status}; } catch{return null;} }
export function setSessionCookie(res:Response,user:AuthUser){res.cookie(COOKIE_NAME,encodeSession(user),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:SESSION_TTL_SECONDS*1000});}
export function clearSessionCookie(res:Response){res.clearCookie(COOKIE_NAME,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});}
export async function getCurrentUser(req:Request):Promise<AuthUser|null>{ const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1); if(!token)return null; const s=decodeSession(token); if(!s)return null; const rows=await db.select({id:users.id,email:users.email,nom:users.nom,prenom:users.prenom,role:users.role,avatar:users.avatar,title:users.title,department:users.department,status:users.status}).from(users).where(eq(users.id,Number(s.id))).limit(1); const u=rows[0]; if(!u||u.status!=='Actif')return null; return {...u,id:String(u.id),role:u.role as AuthUser['role']}; }
export function requireAuth(req:Request,res:Response,next:NextFunction){getCurrentUser(req).then(u=>{if(!u)return res.status(401).json({error:'Authentification requise'});(req as Request & {user:AuthUser}).user=u;next();}).catch(next);}
export function requireRole(...roles:AuthUser['role'][]){return(req:Request,res:Response,next:NextFunction)=>{const u=(req as Request & {user?:AuthUser}).user;if(!u)return res.status(401).json({error:'Authentification requise'});if(!roles.includes(u.role))return res.status(403).json({error:'Accès interdit'});next();};}
