'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';

const OPEN_PATHS = ['/login', '/reset-password'];

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const isOpen = OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function verifyAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && !isOpen) {
        setAuthenticated(false);
        router.replace('/login');
      } else if (session && pathname === '/login') {
        setAuthenticated(true);
        router.replace('/');
      } else {
        setAuthenticated(!!session || isOpen);
      }
      setChecking(false);
    }

    verifyAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isOpen) {
        setAuthenticated(false);
        router.replace('/login');
      } else if (session && pathname === '/login') {
        setAuthenticated(true);
        router.replace('/');
      } else {
        setAuthenticated(!!session || isOpen);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase, isOpen]);

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

  if (!authenticated && !isOpen) {
    return null;
  }

  return <>{children}</>;
};