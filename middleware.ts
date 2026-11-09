import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Solo proteger rutas de panel; la autenticación la validan las propias páginas/APIs.
  // Evitamos tocar cookies aquí para no romper la sincronización de Supabase.
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] };