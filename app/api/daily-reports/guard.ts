import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { canViewDailyMaintenanceReports } from '@/utils/dailyReportsAccess';

export async function requireDailyReportsAccess() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return { supabase, denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('access_level, active')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.active || !canViewDailyMaintenanceReports(profile)) {
    return { supabase, denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { supabase, denied: null };
}
