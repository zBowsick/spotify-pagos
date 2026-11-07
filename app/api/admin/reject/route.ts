import { getSupabaseServer } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const sb = getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const form = await request.formData();
  const paymentId = form.get('paymentId') as string;
  const reason = form.get('reason') as string;

  if (!paymentId || !reason?.trim()) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  const { error } = await sb.rpc('reject_payment', { p_payment_id: paymentId, p_reason: reason.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}