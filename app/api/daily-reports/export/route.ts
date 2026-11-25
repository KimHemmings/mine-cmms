import { NextResponse } from 'next/server';
import { requireDailyReportsAccess } from '../guard';
import { fetchDailyReportSource } from '@/utils/dailyReportsData';
import { buildDailyReport, dailyReportCsv, DatePreset, ReportFilter } from '@/utils/dailyReports';

export async function GET(req: Request) {
  const { supabase, denied } = await requireDailyReportsAccess();
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const preset = (url.searchParams.get('preset') || '14d') as DatePreset;
    const filter: ReportFilter = {
      assetQuery: url.searchParams.get('asset') ?? '',
      area: url.searchParams.get('area') || 'all',
      machineClass: url.searchParams.get('class') || 'all',
      preset: ['24h', '7d', '14d', '30d', 'mtd', 'custom'].includes(preset) ? preset : '14d',
      start: url.searchParams.get('start') ?? '',
      end: url.searchParams.get('end') ?? '',
      lookbackDays: Number(url.searchParams.get('lookback') || 14) || 14,
    };
    const source = await fetchDailyReportSource(supabase);
    const csv = dailyReportCsv(buildDailyReport(source.assets, source.orders, filter));
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="daily-maintenance-report.csv"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not export the daily report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
