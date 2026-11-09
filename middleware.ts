import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const cookies = request.cookies;
  const all = cookies.getAll();
  const hasSession = all.some(c =>
    c.name.includes('auth-token') || c.name.includes('authToken')
  );

  const isProtected = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/admin');
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');

  if (!hasSession && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/:path*'] };