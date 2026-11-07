import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: member } = await sb.from('members').select('id').eq('auth_user_id', user.id).single();
  if (!member) return NextResponse.json({ error: 'No eres integrante' }, { status: 403 });

  const form = await request.formData();
  const paymentId = form.get('paymentId') as string;
  const file = form.get('file') as File;

  if (!paymentId || !file) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Tipo no permitido' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Archivo mayor a 5MB' }, { status: 400 });

  const path = `${member.id}/${Date.now()}-${file.name}`;
  const { error: upErr } = await sb.storage.from('receipts').upload(path, file);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { error: recErr } = await sb.from('receipts').insert({
    payment_id: paymentId, member_id: member.id, storage_path: path,
    mime_type: file.type, size_bytes: file.size, original_name: file.name,
  });
  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

  await sb.from('payments').update({ receipt_path: path }).eq('id', paymentId);

  return NextResponse.json({ ok: true, path });
}