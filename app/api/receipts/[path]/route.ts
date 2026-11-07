import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: member } = await sb.from('members').select('id, role').eq('auth_user_id', user.id).single();
  if (!member) return NextResponse.json({ error: 'No eres integrante' }, { status: 403 });

  const { path } = await params;
  const storagePath = path;

  // Verificar acceso: admin o dueño
  const { data: receipt } = await sb.from('receipts')
    .select('storage_path, member_id')
    .eq('storage_path', storagePath)
    .single();

  if (!receipt) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (member.role !== 'admin' && receipt.member_id !== member.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { data, error } = await sb.storage.from('receipts').createSignedUrl(storagePath, 60 * 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}