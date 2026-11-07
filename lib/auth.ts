import { getSupabaseBrowser } from './supabase';
import type { Member } from '../src/domain/ledger';

export type SessionMember = { id: string; authUserId: string; name: string; role: 'admin' | 'member' };

export async function getSessionMember(): Promise<SessionMember | null> {
  const sb = getSupabaseBrowser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('members')
    .select('id, auth_user_id, name, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, authUserId: data.auth_user_id, name: data.name, role: data.role };
}

export async function signOut() {
  const sb = getSupabaseBrowser();
  await sb.auth.signOut();
}

/** Convierte un row de la BD al formato del motor puro. */
export function toLedgerMember(m: {
  id: string; name: string; role: 'admin' | 'member'; start_month: string | null;
}): Member {
  return { id: m.id, name: m.name, role: m.role, startMonth: m.start_month };
}