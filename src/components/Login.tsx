import React, { useEffect, useState } from 'react';
import { ArrowRight, LogIn, ShieldAlert, ShieldCheck } from 'lucide-react';
import { UserSession } from '../types';

interface LoginProps {
  onLogin: (user: UserSession) => void;
  isDarkMode: boolean;
  usersList?: UserSession[];
}

export const Login: React.FC<LoginProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [entraLoading, setEntraLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('auth_error');
    if (value) {
      try {
        setError(decodeURIComponent(value));
      } catch {
        setError(value);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Connexion administrateur impossible.');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleEntra = () => {
    setError(null);
    setEntraLoading(true);
    window.location.assign('/api/auth/entra/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0078D4] flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight text-[#0078D4]">INTERFLOW</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Entra ID</span>
            </div>
            <p className="text-xs text-slate-500">Administration et gestion des profils</p>
          </div>
        </div>
        <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Authentification sécurisée
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
            <div className="text-center mb-7">
              <h1 className="text-3xl font-extrabold">Connexion InterFlow</h1>
              <p className="mt-2 text-sm text-slate-500">Utilisez Microsoft Entra ID pour votre accès professionnel.</p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              disabled={entraLoading}
              onClick={handleEntra}
              className="w-full py-3.5 rounded-xl bg-[#0078D4] hover:bg-[#106ebe] text-white font-bold flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {entraLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{entraLoading ? 'Redirection vers Microsoft…' : 'Se connecter avec Microsoft Entra ID'}</span>
              {!entraLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </section>

          <section className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <h2 className="font-bold">Accès administrateur local</h2>
            </div>
            <p className="text-xs text-slate-500 mb-5">Compte d’urgence configuré par `ADMIN_EMAIL` / `ADMIN_PASSWORD`.</p>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email administrateur"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mot de passe administrateur"
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? 'Connexion…' : 'Connexion administrateur'}
              </button>
            </form>
          </section>
        </div>
      </main>

      <footer className="px-6 py-3 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        © 2026 InterFlow — PostgreSQL + Microsoft Entra ID
      </footer>
    </div>
  );
};
