import pptxgen from 'pptxgenjs';
import { ProductionHandoverDocument } from '@/types';
import { trainingSentence } from '@/utils/crewStanding';

const BG = '0F172A';
const CARD = '1E293B';
const LINE = '334155';
const AMBER = 'F59E0B';
const MUTED = '94A3B8';
const TEXT = 'F8FAFC';

function addTitle(slide: pptxgen.Slide, title: string, subtitle: string) {
  slide.background = { color: BG };
  slide.addText(title, { x: 0.6, y: 0.35, w: 12.1, h: 0.5, fontSize: 26, bold: true, color: AMBER });
  slide.addText(subtitle, { x: 0.6, y: 0.9, w: 12.1, h: 0.32, fontSize: 14, color: MUTED });
}

function card(slide: pptxgen.Slide, pptx: pptxgen, title: string, body: string) {
  slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.5, w: 12.1, h: 5.4, fill: { color: CARD }, line: { color: LINE, width: 1.25 } });
  slide.addText(title, { x: 0.9, y: 1.7, w: 11.5, h: 0.4, fontSize: 16, bold: true, color: AMBER });
  slide.addText(body, { x: 0.9, y: 2.2, w: 11.5, h: 4.4, fontSize: 15, color: TEXT, valign: 'top' });
}

function chunks<T>(items: T[], size: number) {
  if (items.length === 0) return [[] as T[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

function addTable(slide: pptxgen.Slide, headers: string[], rows: string[][], colW: number[]) {
  const header = headers.map((text) => ({ text, options: { bold: true, fill: { color: CARD }, color: AMBER } }));
  const body = rows.map((row, index) => {
    const bg = index % 2 === 0 ? '162032' : BG;
    return row.map((text, cell) => ({ text, options: { fill: { color: bg }, color: TEXT, bold: cell === 0 } }));
  });
  slide.addTable([header, ...body], {
    x: 0.5, y: 1.45, w: 12.3, colW,
    fontSize: 13, border: { pt: 0.5, color: LINE }, valign: 'middle',
  });
}

export async function generateProductionHandoverPptx(input: {
  shiftName: string;
  shiftDate: string | null;
  crew: string | null;
  supervisor: string | null;
  document: ProductionHandoverDocument;
}) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'WIDESCREEN_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDESCREEN_16_9';
  pptx.author = 'Mine Shift Workboard';
  pptx.title = `Production handover ${input.shiftName}`;
  const when = input.shiftDate ? new Date(input.shiftDate).toLocaleDateString() : '';
  const subtitle = [input.shiftName, input.crew, when, input.supervisor].filter(Boolean).join(' · ');
  const document = input.document;

  const cover = pptx.addSlide();
  addTitle(cover, 'Production handover', subtitle);
  cover.addText(
    [
      `${document.allocations.length} machines crewed`,
      `${document.notCrewed.length} still need an operator`,
      `${document.inWorkshop.length} not available`,
      `${document.delays.length} delays`,
      `${document.safetyIncidents.length} safety item${document.safetyIncidents.length === 1 ? '' : 's'}`,
    ].join('\n'),
    { x: 0.6, y: 1.6, w: 12, h: 2.4, fontSize: 22, color: TEXT },
  );
  if (document.summary) {
    cover.addText(document.summary, { x: 0.6, y: 4.2, w: 12, h: 2.6, fontSize: 15, color: MUTED, valign: 'top' });
  }

  const incidents = pptx.addSlide();
  addTitle(incidents, 'Safety and incidents', subtitle);
  if (document.safetyIncidents.length === 0) {
    incidents.addText('Nothing reported this shift.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    addTable(
      incidents,
      ['What happened', 'Where', 'For the next crew'],
      document.safetyIncidents.slice(0, 7).map((incident) => [incident.what || 'Incident', incident.where || '—', incident.action || '—']),
      [4.2, 3.2, 4.9],
    );
  }

  const focus = pptx.addSlide();
  addTitle(focus, 'Safety focus / share', subtitle);
  card(focus, pptx, 'Watch this shift', document.safetyFocus?.trim() || 'No safety share recorded.');

  const training = pptx.addSlide();
  addTitle(training, 'Training and ERT', subtitle);
  training.addText(
    [
      ...(document.inTraining ?? []).map((row) => trainingSentence(row)),
      `Trainer assessors: ${(document.assessorsOnSite ?? []).join(', ') || 'none on this crew'}`,
      `ERT: ${(document.ertOnSite ?? []).join(', ') || 'none on this crew'}`,
    ].join('\n\n'),
    { x: 0.6, y: 1.5, w: 12, h: 5.2, fontSize: 16, color: TEXT, valign: 'top' },
  );

  const oce = document.oce;
  const oceSlide = pptx.addSlide();
  addTitle(oceSlide, 'OCE report', subtitle);
  if (!oce) {
    oceSlide.addText('No OCE report uploaded for this shift.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    card(oceSlide, pptx, oce.fileName || 'Examiner report', [
      oce.briefing.summary || 'The report is attached. No briefing was written.',
      oce.briefing.restrictions.length ? `\nRestrictions: ${oce.briefing.restrictions.join('; ')}` : '',
      oce.briefing.hazards.length ? `\nHazards: ${oce.briefing.hazards.join('; ')}` : '',
    ].join(''));
  }

  chunks(document.allocations, 8).forEach((page, index, pages) => {
    const slide = pptx.addSlide();
    addTitle(slide, `Crew on machines${pages.length > 1 ? ` (${index + 1}/${pages.length})` : ''}`, subtitle);
    if (page.length === 0) {
      slide.addText('No operators are allocated yet.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
      return;
    }
    addTable(slide, ['Unit', 'Machine', 'Operator', 'Where'], page.map((row) => [row.fleetId, row.machine, row.operator, row.location || '—']), [1.8, 4.2, 3.2, 3.1]);
  });

  if ((document.seatChanges ?? []).length > 0) {
    const slide = pptx.addSlide();
    addTitle(slide, 'Operator changes', subtitle);
    slide.addText(
      document.seatChanges.map((row) => `${row.fleetId}: ${row.text}${row.cab ? ` ${row.cab}` : ''}`).join('\n'),
      { x: 0.6, y: 1.5, w: 12, h: 5.2, fontSize: 16, color: TEXT, valign: 'top' },
    );
  }

  if (document.delays.length > 0) {
    const slide = pptx.addSlide();
    addTitle(slide, 'Delays', subtitle);
    addTable(slide, ['Unit', 'What is holding it'], document.delays.slice(0, 8).map((row) => [row.fleetId || 'Pit', row.reason]), [2.2, 10.1]);
  }

  const down = pptx.addSlide();
  addTitle(down, 'Not running', subtitle);
  const parked = [
    ...document.notCrewed.map((row) => [row.fleetId, row.machine, 'Needs an operator']),
    ...document.inWorkshop.map((row) => [row.fleetId, row.location || 'Workshop', row.expected ? `Expected ${row.expected}` : 'Not available']),
  ];
  if (parked.length === 0) {
    down.addText('Every production machine is crewed.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    addTable(down, ['Unit', 'Detail', 'Status'], parked.slice(0, 8), [2.2, 6.2, 3.9]);
  }

  const fileBits = ['Production_Handover', input.crew, input.shiftName, input.shiftDate].filter(Boolean);
  await pptx.writeFile({ fileName: `${fileBits.join('_').replace(/\s+/g, '_')}.pptx` });
}
