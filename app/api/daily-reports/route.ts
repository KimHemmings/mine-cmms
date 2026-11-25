import { NextResponse } from 'next/server';
import { requireDailyReportsAccess } from './guard';
import { fetchDailyReportSource } from '@/utils/dailyReportsData';

export async function GET() {
  const { supabase, denied } = await requireDailyReportsAccess();
  if (denied) return denied;
  try {
    const source = await fetchDailyReportSource(supabase);
    return NextResponse.json(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the daily reports.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
