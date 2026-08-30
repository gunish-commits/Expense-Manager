// app/documents/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DocumentsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/personal?tab=bills');
  }, [router]);
  return null;
}
