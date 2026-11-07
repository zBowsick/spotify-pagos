import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from 'next/server';

export async function GET() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

  const { data, error } = await sb.rpc('admin_dashboard');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}