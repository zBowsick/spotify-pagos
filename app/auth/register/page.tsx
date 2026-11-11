'use client';

import { useState, useEffect, FormEvent } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Button, Input, Select, Alert, Loading } from '@/components/ui';

export default function RegisterPage() {
  const [members, setMembers] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAvailableMembers() {
      const sb = getSupabaseBrowser();
      const { data } = await sb.from('members').select('id, name').is('auth_user_id', null).order('name');
      setMembers(data || []);
      setLoading(false);
    }
    loadAvailableMembers();
  }, []);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!selectedMember) { setError('Selecciona quién eres'); return; }
    setError(null);
    setSubmitting(true);

    const sb = getSupabaseBrowser();
    const { data, error: authErr } = await sb.auth.signUp({ email, password });

    if (authErr) { setError(authErr.message); setSubmitting(false); return; }

    await new Promise(r => setTimeout(r, 500));

    const { error: claimErr } = await sb.rpc('claim_member', { p_member_id: selectedMember });

    if (claimErr) {
      setError('Registro exitoso, pero fallo al vincular: ' + claimErr.message);
      setSubmitting(false);
    } else {
      window.location.href = '/dashboard';
    }
  }

  if (loading) return <Loading />;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white/95">Spotify Compartido</h1>
          <p className="text-white/55 mt-3 text-base font-light tracking-wide">Registro de nuevo integrante</p>
        </div>
        <div className="glass rounded-[32px] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
          <form onSubmit={handleRegister} className="space-y-5">
            {error && <Alert variant="error">{error}</Alert>}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2 tracking-wide">Email</label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/60 mb-2 tracking-wide">Contraseña</label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="member" className="block text-sm font-medium text-white/60 mb-2 tracking-wide">Selecciona tu nombre</label>
              <select
                id="member"
                value={selectedMember}
                onChange={e => setSelectedMember(e.target.value)}
                required
                className="select w-full"
              >
                <option value="">-- Elige quién eres --</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <Button type="submit" loading={submitting} className="w-full">Registrarse</Button>
          </form>
        </div>
      </div>
    </main>
  );
}