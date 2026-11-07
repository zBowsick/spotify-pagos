'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Client-side redirect after hydration
    router.replace('/auth/login');
  }, [router]);

  return null;
}