import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const { paymentId } = await request.json();
  if (!paymentId) return NextResponse.json({ error: 'Falta paymentId' }, { status: 400 });

  const { error } = await sb.rpc('approve_payment', { p_payment_id: paymentId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}