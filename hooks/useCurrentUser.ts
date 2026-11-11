'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { UserProfile } from '@/types';

export function useCurrentUser() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = user
        ? await supabase
            .from('profiles')
            .select('id, display_name, employee_id, role, active, crew_member_id')
            .eq('id', user.id)
            .maybeSingle()
        : { data: null };

      if (!cancelled) {
        setProfile(data?.active ? (data as UserProfile) : null);
        setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [supabase, reloadKey]);

  const displayName = profile
    ? profile.employee_id
      ? `${profile.display_name} (#${profile.employee_id})`
      : profile.display_name
    : '';

  return { profile, displayName, loading, reload: () => setReloadKey((key) => key + 1) };
}
