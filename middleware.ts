import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const cookies = request.cookies;
  const hasSession = Array.from(cookies.getAll()).some(c =>
    c.name.startsWith('sb-') && c.name.includes('auth-token')
  );

  if (!hasSession && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] };