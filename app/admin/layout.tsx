import { getSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: member } = await sb.from('members').select('id, name, role').eq('auth_user_id', user.id).single();
  if (!member || member.role !== 'admin') redirect('/dashboard');

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16">
          <h1 className="text-xl font-semibold">Panel de Administración</h1>
          <nav className="flex items-center gap-4">
            <span className="text-sm text-muted">{member.name} (Admin)</span>
            <a href="/dashboard" className="btn btn-ghost text-sm">Ver como miembro</a>
            <form action={async () => { 'use server'; const sb = getSupabaseServer(); await sb.auth.signOut(); }} method="POST">
              <button type="submit" className="btn btn-ghost text-sm">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}