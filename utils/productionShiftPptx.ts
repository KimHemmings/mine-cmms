import pptxgen from 'pptxgenjs';

const BG = '0F172A';
const CARD = '1E293B';
const LINE = '334155';
const AMBER = 'F59E0B';
const MUTED = '94A3B8';
const TEXT = 'F8FAFC';

export interface ProductionShiftDeck {
  shiftName: string;
  shiftWindow: string;
  dateLabel: string;
  crew: string;
  supervisor: string;
  down: {
    fleetId: string;
    makeModel: string;
    priority: string;
    reason: string;
    hold: string;
    eta: string;
  }[];
  seats: { unit: string; people: string; location: string }[];
  checks: { label: string; status: string; notes: string }[];
  notes: { when: string; details: string }[];
  oce: { status: string; file: string };
  tarps: { name: string; level: string; note: string }[];
  incidents: { category: string; location: string; summary: string; flags: string }[];
  safety: string;
  production: { rom: string; overburden: string; delays: string; services: string; servicesNotes: string };
  signoff: { outgoing: string; oncoming: string };
}

function addTitle(slide: pptxgen.Slide, title: string, subtitle: string) {
  slide.background = { color: BG };
  slide.addText(title, { x: 0.5, y: 0.28, w: 12.3, h: 0.48, fontSize: 26, bold: true, color: AMBER });
  slide.addText(subtitle, { x: 0.5, y: 0.8, w: 12.3, h: 0.32, fontSize: 14, color: MUTED });
}

function addTable(slide: pptxgen.Slide, headers: string[], rows: string[][], colW: number[]) {
  const header = headers.map((text) => ({ text, options: { bold: true, fill: { color: CARD }, color: AMBER } }));
  const body = rows.map((row, index) => {
    const bg = index % 2 === 0 ? '162032' : BG;
    return row.map((text, cell) => ({ text, options: { fill: { color: bg }, color: TEXT, bold: cell === 0 } }));
  });
  slide.addTable([header, ...body], {
    x: 0.4, y: 1.35, w: 12.5, colW,
    fontSize: 12, border: { pt: 0.5, color: LINE }, valign: 'middle',
  });
}

function pages<T>(items: T[], size: number) {
  if (items.length === 0) return [[] as T[]];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export async function generateProductionShiftPptx(deck: ProductionShiftDeck) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'WIDESCREEN_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDESCREEN_16_9';
  pptx.author = 'Mine Shift Workboard';
  pptx.title = `Production Shift Handover ${deck.shiftName}`;
  const subtitle = [deck.shiftName, deck.shiftWindow, deck.dateLabel, deck.crew, deck.supervisor].filter(Boolean).join(' · ');

  const cover = pptx.addSlide();
  addTitle(cover, 'Production Shift Handover', subtitle);
  cover.addText(
    [
      `${deck.down.length} machine${deck.down.length === 1 ? '' : 's'} down in the workshop`,
      `${deck.incidents.length} incident${deck.incidents.length === 1 ? '' : 's'}`,
      `${deck.tarps.filter((row) => row.level !== 'Normal').length} active TARP${deck.tarps.filter((row) => row.level !== 'Normal').length === 1 ? '' : 's'}`,
      `${deck.notes.length} pit note${deck.notes.length === 1 ? '' : 's'}`,
    ].join('\n'),
    { x: 0.6, y: 1.8, w: 12, h: 2.2, fontSize: 22, color: TEXT },
  );

  const oceSlide = pptx.addSlide();
  addTitle(oceSlide, 'OCE report and sign-off', subtitle);
  addTable(oceSlide, ['Item', 'Detail'], [
    ['OCE report status', deck.oce.status || 'Pending Upload'],
    ['OCE report file', deck.oce.file || '—'],
    ['Outgoing supervisor / OCE', deck.signoff.outgoing || 'Not signed'],
    ['Oncoming supervisor / OCE', deck.signoff.oncoming || 'Not signed'],
  ], [4.2, 8.3]);

  const tarpRows = deck.tarps.map((row) => [row.name, row.level, row.note || '—']);
  const tarpSlide = pptx.addSlide();
  addTitle(tarpSlide, 'Active TARPs', subtitle);
  addTable(tarpSlide, ['TARP', 'Level', 'Trigger note'], tarpRows.length ? tarpRows : [['—', '—', '—']], [4.2, 2.4, 5.9]);

  const incidentRows = deck.incidents.map((row) => [row.category, row.location || '—', row.summary || '—', row.flags || '—']);
  const incidentSlide = pptx.addSlide();
  addTitle(incidentSlide, 'Incidents, near misses and HPIs', subtitle);
  if (incidentRows.length === 0) {
    incidentSlide.addText('No incidents logged for this shift.', { x: 0.6, y: 1.8, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    addTable(incidentSlide, ['Category', 'Location', 'Summary', 'Flags'], incidentRows, [2.6, 2.4, 5.1, 2.4]);
  }

  const safetySlide = pptx.addSlide();
  addTitle(safetySlide, 'Safety awareness and pre-start focus', subtitle);
  safetySlide.addText(deck.safety.trim() || 'No safety awareness note for this shift.', {
    x: 0.6, y: 1.6, w: 12, h: 4.8, fontSize: 20, color: TEXT,
  });

  const productionSlide = pptx.addSlide();
  addTitle(productionSlide, 'Shift production actuals and pit services', subtitle);
  addTable(productionSlide, ['Item', 'Actual'], [
    ['ROM coal (tonnes)', deck.production.rom || '—'],
    ['Prime overburden (BCMs)', deck.production.overburden || '—'],
    ['Major non-mechanical delays', deck.production.delays || '—'],
    ['Pit services', deck.production.services || 'Normal'],
    ['Services notes', deck.production.servicesNotes || '—'],
  ], [4.6, 7.9]);

  const checkRows = deck.checks.map((row) => [row.label, row.status, row.notes || '—']);
  const checksSlide = pptx.addSlide();
  addTitle(checksSlide, 'Statutory pit and OCE checks', subtitle);
  if (checkRows.length === 0) {
    checksSlide.addText('No statutory checks recorded.', { x: 0.6, y: 1.8, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    addTable(checksSlide, ['Check', 'Status', 'Notes'], checkRows, [5.2, 2.8, 4.5]);
  }

  const downRows = deck.down.map((row) => [row.fleetId, row.makeModel, row.priority, row.reason, row.hold, row.eta]);
  pages(downRows, 8).forEach((slice, page, all) => {
    const slide = pptx.addSlide();
    addTitle(slide, all.length > 1 ? `Down fleet and workshop ETAs (${page + 1}/${all.length})` : 'Down fleet and workshop ETAs', subtitle);
    if (slice.length === 0) {
      slide.addText('Nothing is down in the workshop.', { x: 0.6, y: 1.8, w: 12, h: 0.4, fontSize: 18, color: TEXT });
    } else {
      addTable(slide, ['Fleet', 'Make / Model', 'Priority', 'Down for', 'Hold', 'Expected back up'], slice, [1.5, 2.1, 2.2, 2.6, 1.9, 2.2]);
    }
  });

  const seatRows = deck.seats.map((row) => [row.unit, row.people, row.location || '—']);
  pages(seatRows, 8).forEach((slice, page, all) => {
    const slide = pptx.addSlide();
    addTitle(slide, all.length > 1 ? `Operator and equipment allocations (${page + 1}/${all.length})` : 'Operator and equipment allocations', subtitle);
    if (slice.length === 0) {
      slide.addText('No production operators are on this crew.', { x: 0.6, y: 1.8, w: 12, h: 0.4, fontSize: 18, color: TEXT });
    } else {
      addTable(slide, ['Unit', 'Operators', 'Location'], slice, [3.2, 6.2, 3.1]);
    }
  });

  const noteRows = deck.notes.map((row) => [row.when || '—', row.details]);
  pages(noteRows, 8).forEach((slice, page, all) => {
    const slide = pptx.addSlide();
    addTitle(slide, all.length > 1 ? `Pit and production notes (${page + 1}/${all.length})` : 'Pit and production notes', subtitle);
    if (slice.length === 0) {
      slide.addText('No pit notes for this shift yet.', { x: 0.6, y: 1.8, w: 12, h: 0.4, fontSize: 18, color: TEXT });
    } else {
      addTable(slide, ['When', 'Note'], slice, [2.4, 10.1]);
    }
  });

  await pptx.writeFile({ fileName: `Production_Shift_Handover_${deck.dateLabel.replace(/[^\dA-Za-z]+/g, '_') || 'shift'}.pptx` });
}
