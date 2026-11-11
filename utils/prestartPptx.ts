import pptxgen from 'pptxgenjs';

const BG = '0F172A';
const CARD = '1E293B';
const LINE = '334155';
const AMBER = 'F59E0B';
const MUTED = '94A3B8';
const TEXT = 'F8FAFC';

export interface PrestartBriefing {
  shiftName: string;
  shiftDate: string | null;
  allocations: { fleetId: string; machine: string; operator: string; passout: string }[];
  unallocated: { fleetId: string; machine: string; reason: string }[];
  unavailable: { fleetId: string; where: string; expected: string }[];
  staleAuthorisations: { person: string; item: string; expires: string; state: string }[];
  stalePassouts: { person: string; fleetId: string; expires: string; state: string }[];
}

function addTitle(slide: pptxgen.Slide, title: string, subtitle: string) {
  slide.background = { color: BG };
  slide.addText(title, { x: 0.6, y: 0.35, w: 12.1, h: 0.5, fontSize: 26, bold: true, color: AMBER });
  slide.addText(subtitle, { x: 0.6, y: 0.9, w: 12.1, h: 0.32, fontSize: 14, color: MUTED });
}

function chunks<T>(items: T[], size: number) {
  if (items.length === 0) return [[] as T[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

function addTable(slide: pptxgen.Slide, headers: string[], rows: string[][], colW: number[]) {
  const headerOpts = { bold: true, fill: { color: CARD }, color: AMBER };
  const header = headers.map((text) => ({ text, options: headerOpts }));
  const body = rows.map((row, index) => {
    const bg = index % 2 === 0 ? '162032' : BG;
    return row.map((text, cell) => ({ text, options: { fill: { color: bg }, color: TEXT, bold: cell === 0 } }));
  });
  slide.addTable([header, ...body], {
    x: 0.5, y: 1.45, w: 12.3, colW,
    fontSize: 13, border: { pt: 0.5, color: LINE }, valign: 'middle',
  });
}

export async function generatePrestartPptx(briefing: PrestartBriefing) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'WIDESCREEN_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDESCREEN_16_9';
  pptx.author = 'Mine Shift Workboard';
  pptx.title = `Prestart ${briefing.shiftName}`;
  const when = briefing.shiftDate ? new Date(briefing.shiftDate).toLocaleDateString() : '';
  const subtitle = [briefing.shiftName, when].filter(Boolean).join(' · ') || 'This shift';

  const cover = pptx.addSlide();
  addTitle(cover, 'Production prestart', subtitle);
  cover.addText(
    [
      `${briefing.allocations.length} machine${briefing.allocations.length === 1 ? '' : 's'} have an operator`,
      `${briefing.unallocated.length} still need a suitable operator`,
      `${briefing.staleAuthorisations.length} authorisation${briefing.staleAuthorisations.length === 1 ? '' : 's'} out of date`,
      `${briefing.stalePassouts.length} pass-out${briefing.stalePassouts.length === 1 ? '' : 's'} out of date`,
      `${briefing.unavailable.length} machine${briefing.unavailable.length === 1 ? '' : 's'} still in the workshop`,
    ].join('\n'),
    { x: 0.6, y: 1.6, w: 12, h: 3, fontSize: 22, color: TEXT },
  );

  chunks(briefing.allocations, 8).forEach((page, index, pages) => {
    const slide = pptx.addSlide();
    addTitle(slide, `Operators on machines${pages.length > 1 ? ` (${index + 1}/${pages.length})` : ''}`, subtitle);
    if (page.length === 0) {
      slide.addText('No operators are allocated yet.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
      return;
    }
    addTable(
      slide,
      ['Unit', 'Machine', 'Operator', 'Pass-out'],
      page.map((row) => [row.fleetId, row.machine, row.operator, row.passout]),
      [2, 4.3, 3.2, 2.8],
    );
  });

  chunks(briefing.unallocated, 8).forEach((page, index, pages) => {
    const slide = pptx.addSlide();
    addTitle(slide, `Still needs an operator${pages.length > 1 ? ` (${index + 1}/${pages.length})` : ''}`, subtitle);
    if (page.length === 0) {
      slide.addText('Every available machine has an operator.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
      return;
    }
    addTable(
      slide,
      ['Unit', 'Machine', 'Why'],
      page.map((row) => [row.fleetId, row.machine, row.reason]),
      [2.2, 4.5, 5.6],
    );
  });

  const stale = pptx.addSlide();
  addTitle(stale, 'Out of date', subtitle);
  const staleLines = [
    ...briefing.staleAuthorisations.map((row) => `${row.person} · ${row.item} · ${row.state} ${row.expires}`),
    ...briefing.stalePassouts.map((row) => `${row.person} · ${row.fleetId} pass-out · ${row.state} ${row.expires}`),
  ];
  stale.addText(staleLines.join('\n') || 'Nothing is due or expired.', {
    x: 0.6, y: 1.5, w: 12, h: 5.2, fontSize: 16, color: TEXT, valign: 'top',
  });

  const down = pptx.addSlide();
  addTitle(down, 'Not available from the workshop', subtitle);
  if (briefing.unavailable.length === 0) {
    down.addText('No production machines are still in the workshop.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    addTable(
      down,
      ['Unit', 'Where', 'Expected back'],
      briefing.unavailable.slice(0, 8).map((row) => [row.fleetId, row.where, row.expected]),
      [2.5, 5, 4.8],
    );
  }

  const fileBits = ['Production_Prestart', briefing.shiftName, briefing.shiftDate].filter(Boolean);
  await pptx.writeFile({ fileName: `${fileBits.join('_').replace(/\s+/g, '_')}.pptx` });
}
