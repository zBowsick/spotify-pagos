'use client';

import { useState, FormEvent } from 'react';
import { getSupabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white/95">Spotify Compartido</h1>
          <p className="text-white/55 mt-3 text-base font-light tracking-wide">Inicia sessión para gestionar tus pagos</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const sb = getSupabaseBrowser();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      console.log('Login attempt:', { data, error });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      await new Promise(r => setTimeout(r, 800));
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Error inesperado');
      setLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!email) { setError('Escribe tu email primero'); return; }
    setError(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) setError(error.message);
    else setError('Revisa tu email para el enlace mágico (expira en 1 hora)');
  }

  return (
    <div className="glass rounded-[32px] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-200 text-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2 tracking-wide">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-white/60 mb-2 tracking-wide">Contraseña</label>
          <div className="relative flex items-center">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pr-10 w-full"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              className="absolute right-3 text-white/50 hover:text-white/90 transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : 'Entrar'}
        </button>
        <div className="text-center text-sm text-white/40 font-light">o</div>
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={handleMagicLink}
          disabled={loading || !email}
        >
          Enviar enlace mágico
        </button>
        <div className="text-center text-sm">
          <a href="/auth/register" className="text-white/70 hover:text-white/95 transition-colors font-light tracking-wide">¿No tienes cuenta? Regístrate aquí</a>
        </div>
      </form>
    </div>
  );
}