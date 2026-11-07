import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: member } = await sb.from('members').select('id').eq('auth_user_id', user.id).single();
  if (!member) return NextResponse.json({ error: 'No eres integrante' }, { status: 403 });

  const form = await request.formData();
  const amount = Number(form.get('amount'));
  const paidOn = form.get('paidOn') as string;
  const reference = form.get('reference') as string || null;
  const allocations = JSON.parse(form.get('allocations') as string || '[]');

  if (!amount || !paidOn || !allocations.length) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const { error: payErr } = await sb.from('payments').insert({
    payer_id: member.id,
    amount_cop: amount,
    paid_on: paidOn,
    reference,
    status: 'PENDIENTE',
  });
  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  const { data: payment } = await sb.from('payments')
    .select('id').eq('payer_id', member.id).order('submitted_at', { ascending: false }).limit(1).single();
  if (payment) {
    const { error: allocErr } = await sb.from('payment_allocations').insert(
      allocations.map((a: { beneficiaryId: string; months: number }) => ({
        payment_id: payment.id, beneficiary_id: a.beneficiaryId, months: a.months
      }))
    );
    if (allocErr) return NextResponse.json({ error: allocErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}