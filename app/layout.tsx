import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spotify Compartido – Pagos',
  description: 'Control de pagos y coberturas para el plan familiar de Spotify',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#5747e6" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}