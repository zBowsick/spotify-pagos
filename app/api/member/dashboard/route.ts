import { getSupabaseServer } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: member } = await sb.from('members').select('id').eq('auth_user_id', user.id).single();
  if (!member) return NextResponse.json({ error: 'No eres integrante' }, { status: 403 });

  const { data, error } = await sb.rpc('member_dashboard', { p_member_id: member.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}