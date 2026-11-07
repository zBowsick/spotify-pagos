import { getSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: member } = await sb.from('members').select('id, name, role').eq('auth_user_id', user.id).single();
  if (!member) redirect('/auth/login');

  if (member.role === 'admin') redirect('/admin');

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16">
          <h1 className="text-xl font-semibold">Spotify Compartido</h1>
          <nav className="flex items-center gap-4">
            <span className="text-sm text-muted">{member.name}</span>
            <form action={async () => { 'use server'; const sb = await getSupabaseServer(); await sb.auth.signOut(); }} method="POST">
              <button type="submit" className="btn btn-ghost text-sm">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}