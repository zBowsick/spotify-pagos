'use client';

import { useState, FormEvent, Suspense } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Spotify Compartido</h1>
          <p className="text-muted mt-2">Inicia sesión para gestionar tus pagos</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    redirect('/dashboard');
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
    <form className="card p-6 space-y-4" onSubmit={handleSubmit}>
      {error && <div className="badge badge-danger text-sm p-3 text-center">{error}</div>}
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={loading} />
      </div>
      <div>
        <label htmlFor="password">Contraseña</label>
        <input id="password" type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" disabled={loading} />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Entrar'}
      </button>
      <div className="text-center text-sm text-muted">o</div>
      <button type="button" className="btn btn-secondary w-full" onClick={handleMagicLink} disabled={loading || !email}>
        Enviar enlace mágico
      </button>
    </form>
  );
}