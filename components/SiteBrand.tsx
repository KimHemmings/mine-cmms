'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { DEFAULT_SITE_NAME, SITE_ID } from '@/utils/siteBrand';

const SiteBrandContext = createContext<{ name: string; save: (name: string) => Promise<boolean> }>({
  name: DEFAULT_SITE_NAME,
  save: async () => false,
});

export function SiteBrandProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState(DEFAULT_SITE_NAME);

  useEffect(() => {
    const supabase = createClient();
    void supabase.from('sites').select('name').eq('id', SITE_ID).maybeSingle().then(({ data }) => {
      const next = typeof data?.name === 'string' ? data.name.trim() : '';
      if (next) setName(next);
    });
  }, []);

  const value = useMemo(() => ({
    name,
    save: async (nextName: string) => {
      const trimmed = nextName.trim() || DEFAULT_SITE_NAME;
      const supabase = createClient();
      const { error } = await supabase.from('sites').update({ name: trimmed }).eq('id', SITE_ID);
      if (error) return false;
      setName(trimmed);
      return true;
    },
  }), [name]);

  return <SiteBrandContext.Provider value={value}>{children}</SiteBrandContext.Provider>;
}

export function useSiteBrand() {
  return useContext(SiteBrandContext);
}
