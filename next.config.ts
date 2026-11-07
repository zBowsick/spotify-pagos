import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    // Los comprobantes se sirven desde Supabase Storage, no del dominio de Next.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  experimental: {
    // Server Actions usan form-data multipart; se permiten tamaños mayores.
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;