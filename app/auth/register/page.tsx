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
      // Solo listar miembros que aún no tienen usuario vinculado
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

    // Esperar a que la sesión se establezca
    await new Promise(r => setTimeout(r, 500));

    // Vincular cuenta
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
    <main className="container max-w-md py-12">
      <h1 className="text-2xl font-bold mb-6">Registro de nuevo integrante</h1>
      <form onSubmit={handleRegister} className="card p-6 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Select label="Selecciona tu nombre" value={selectedMember} onChange={e => setSelectedMember(e.target.value)} required>
          <option value="">-- Elige quién eres --</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Button type="submit" loading={submitting} className="w-full">Registrarse</Button>
      </form>
    </main>
  );
}