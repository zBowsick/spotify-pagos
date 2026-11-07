import { getSupabaseServer } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const sb = getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const form = await request.formData();
  const memberId = form.get('memberId') as string;
  const startMonth = form.get('startMonth') as string;

  if (!memberId || !startMonth) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  const { error } = await sb.from('members').update({ start_month: startMonth }).eq('id', memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}