import { getSupabaseServer } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const sb = getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const form = await request.formData();
  const monthlyPrice = Number(form.get('monthlyPrice'));
  if (!monthlyPrice) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });

  const { error } = await sb.from('settings').update({ monthly_price_cop: monthlyPrice }).eq('id', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}