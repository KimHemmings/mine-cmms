'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function verifyAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && pathname !== '/login') {
        setAuthenticated(false);
        router.replace('/login');
      } else if (session && pathname === '/login') {
        setAuthenticated(true);
        router.replace('/');
      } else {
        setAuthenticated(!!session || pathname === '/login');
      }
      setChecking(false);
    }

    verifyAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && pathname !== '/login') {
        setAuthenticated(false);
        router.replace('/login');
      } else if (session && pathname === '/login') {
        setAuthenticated(true);
        router.replace('/');
      } else {
        setAuthenticated(!!session || pathname === '/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Checking Access...
        </span>
      </div>
    );
  }

  if (!authenticated && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
};