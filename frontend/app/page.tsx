'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';
import { useClientAuth } from './context/ClientAuthContext';

export default function Home() {
  const router = useRouter();
  const { user: adminUser, loading: adminLoading } = useAuth();
  const { user: clientUser, loading: clientLoading } = useClientAuth();

  useEffect(() => {
    if (!adminLoading && !clientLoading) {
      if (clientUser) {
        router.push('/client/dashboard');
      } else if (adminUser) {
        router.push('/admin/dashboard');
      } else {
        router.push('/client/login');
      }
    }
  }, [adminUser, clientUser, adminLoading, clientLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
