import pptxgen from 'pptxgenjs';
import { HandoverCarryJob, HandoverPartLine, HandoverSlide, HandoverSnapshot } from '@/types';
import { handoverNotesFor } from '@/utils/handoverNotes';
import { formatDateTime } from '@/utils/helpers';
import { partStatusLabel, stageLabel } from '@/utils/handoverDocument';

export type CustomSlideData = HandoverSlide;

const BG = '0F172A';
const CARD = '1E293B';
const LINE = '334155';
const AMBER = 'F59E0B';
const MUTED = '94A3B8';
const TEXT = 'F8FAFC';
const ROWS_PER_SLIDE = 7;

export interface CrewBriefingInput {
  shiftName: string;
  shiftDate: string | null;
  crew: string | null;
  supervisor: string | null;
  document: HandoverSnapshot;
}

function addTitle(slide: pptxgen.Slide, title: string, subtitle: string) {
  slide.background = { color: BG };
  slide.addText(title, { x: 0.6, y: 0.35, w: 12.1, h: 0.5, fontSize: 26, bold: true, color: AMBER });
  slide.addText(subtitle, { x: 0.6, y: 0.9, w: 12.1, h: 0.32, fontSize: 14, color: MUTED });
}

function card(slide: pptxgen.Slide, pptx: pptxgen, x: number, y: number, w: number, h: number, title: string, body: string) {
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: CARD }, line: { color: LINE, width: 1.25 } });
  slide.addText(title, { x: x + 0.3, y: y + 0.2, w: w - 0.6, h: 0.4, fontSize: 16, bold: true, color: AMBER });
  slide.addText(body, { x: x + 0.3, y: y + 0.7, w: w - 0.6, h: h - 1, fontSize: 15, color: TEXT, valign: 'top' });
}

function chunks<T>(items: T[], size: number) {
  if (items.length === 0) return [[] as T[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

function jobLine(job: HandoverCarryJob) {
  return `${job.woNumber ? `WO ${job.woNumber}: ` : ''}${job.task}`;
}

function addTable(slide: pptxgen.Slide, headers: string[], rows: string[][], colW: number[]) {
  const headerOpts = { bold: true, fill: { color: '1E293B' }, color: AMBER };
  const header = headers.map((text) => ({ text, options: headerOpts }));
  const body = rows.map((row, index) => {
    const bg = index % 2 === 0 ? '162032' : '0F172A';
    return row.map((text, cell) => ({ text, options: { fill: { color: bg }, color: TEXT, bold: cell === 0 } }));
  });
  slide.addTable([header, ...body], {
    x: 0.5, y: 1.45, w: 12.3, colW,
    fontSize: 13, border: { pt: 0.5, color: LINE }, valign: 'middle',
  });
}

export async function generateHandoverPptx(input: CrewBriefingInput) {
  const { document } = input;
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'WIDESCREEN_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDESCREEN_16_9';
  pptx.author = 'Mine Shift Workboard';

  const allocation = document.allocation ?? { panel: null, people: [], withOutgoing: [], needsName: [] };
  const parts = document.parts ?? [];
  const panel = allocation.panel;
  const when = input.shiftDate ? new Date(input.shiftDate).toLocaleDateString() : '';
  const from = [input.shiftName, input.crew, when].filter(Boolean).join(' · ');
  const subtitle = `From ${from || 'the outgoing shift'} · ${input.supervisor || 'Workshop management'}`;
  pptx.title = panel ? `Briefing for ${panel}` : `Crew briefing ${input.shiftName}`;

  const weather = handoverNotesFor(document.log, ['WEATHER']);
  const safety = handoverNotesFor(document.log, ['SAFETY']);
  const manning = handoverNotesFor(document.log, ['MANNING']);
  const priorities = handoverNotesFor(document.log, ['PRIORITY']);
  const watches = handoverNotesFor(document.log, ['WATCHLIST']);
  const compliance = handoverNotesFor(document.log, ['BRAKE_TEST', 'TOOLING']);

  const cover = pptx.addSlide();
  addTitle(cover, panel ? `Briefing for ${panel}` : 'Crew briefing', subtitle);
  const jobCount = new Set(
    allocation.people.flatMap((person) => person.jobs.map((job) => `${job.fleetId}|${job.woNumber ?? ''}|${job.task}`))
  ).size;
  const coverLine = panel
    ? `${jobCount} job${jobCount === 1 ? '' : 's'} already with ${panel}` +
      (allocation.needsName.length ? ` · ${allocation.needsName.length} need a name` : '') +
      (parts.length ? ` · ${parts.length} part${parts.length === 1 ? '' : 's'} outstanding` : '')
    : `${document.handedOver.length} machine${document.handedOver.length === 1 ? '' : 's'} still down`;
  cover.addText(coverLine, { x: 0.6, y: 1.45, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  if (document.released.length) {
    cover.addText(`Released this shift: ${document.released.map((machine) => machine.fleetId).join(', ')}`, {
      x: 0.6, y: 1.95, w: 12, h: 0.35, fontSize: 14, color: MUTED,
    });
  }

  const safetyRows = [
    ...(document.safetyIncidents ?? []).map((incident) => [incident.what || 'Incident', incident.where || '—', incident.action || '—']),
    ...document.log
      .filter((entry) => entry.category === 'SAFETY')
      .map((entry) => [entry.details, entry.fleet_id || '—', entry.action_required || '—']),
  ];
  const safetySlide = pptx.addSlide();
  addTitle(safetySlide, 'Safety and incidents', subtitle);
  if (safetyRows.length === 0) {
    safetySlide.addText('Nothing reported this shift.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    chunks(safetyRows, ROWS_PER_SLIDE).forEach((slice, page, pages) => {
      const slide = page === 0 ? safetySlide : pptx.addSlide();
      if (page > 0) addTitle(slide, `Safety and incidents (${page + 1}/${pages.length})`, subtitle);
      addTable(slide, ['What happened', 'Where', 'For the next crew'], slice, [4.2, 3.2, 4.9]);
    });
  }

  const focusSlide = pptx.addSlide();
  addTitle(focusSlide, 'Safety focus / share', subtitle);
  card(focusSlide, pptx, 0.6, 1.5, 12.1, 5.4, 'Watch this shift', document.safetyFocus?.trim() || 'No safety share recorded.');

  const trainingSlide = pptx.addSlide();
  addTitle(trainingSlide, 'Training and ERT', subtitle);
  const trainingLines = [
    ...(document.inTraining ?? []).map((row) => `${row.name}: ${row.level} for ${row.skill}. Assessor ${row.assessor}${row.assessorOnSite ? '' : ' is not on this shift'}.`),
    `Trainer assessors: ${(document.assessorsOnSite ?? []).join(', ') || 'none on this crew'}`,
    `ERT: ${(document.ertOnSite ?? []).join(', ') || 'none on this crew'}`,
  ];
  trainingSlide.addText(trainingLines.join('\n\n') || 'No one on this crew is under supervision.', {
    x: 0.6, y: 1.5, w: 12, h: 5.2, fontSize: 16, color: TEXT, valign: 'top',
  });

  const oce = document.oce;
  const oceSlide = pptx.addSlide();
  addTitle(oceSlide, 'OCE report', subtitle);
  if (!oce) {
    oceSlide.addText('No OCE report uploaded for this shift.', { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
  } else {
    card(oceSlide, pptx, 0.6, 1.45, 12.1, 3.3, oce.fileName || 'Examiner report', oce.briefing.summary || 'The report is attached. No briefing was written.');
    const points = [
      ...oce.briefing.restrictions.map((item) => `Restriction: ${item}`),
      ...oce.briefing.hazards.map((item) => `Hazard: ${item}`),
      ...oce.briefing.conditions.map((item) => `Condition: ${item}`),
    ];
    oceSlide.addText(points.join('\n') || 'No extra restrictions were pulled from the report.', {
      x: 0.9, y: 4.95, w: 11.5, h: 2, fontSize: 13, color: TEXT, valign: 'top',
    });
  }
  const coverNotes = [
    safety && { title: 'Safety', body: safety },
    weather && { title: 'Weather and roads', body: weather },
  ].filter((item): item is { title: string; body: string } => Boolean(item));
  coverNotes.forEach((note, index) => {
    const x = index === 0 ? 0.6 : 6.95;
    card(cover, pptx, coverNotes.length === 1 ? 0.6 : x, 2.55, coverNotes.length === 1 ? 12.1 : 5.8, 4.3, note.title, note.body);
  });

  if (panel) {
    const allocated = [
      ...allocation.people.flatMap((person) =>
        person.jobs.map((job) => [person.name, job.fleetId, jobLine(job), stageLabel(job.stage)])
      ),
      ...allocation.people
        .filter((person) => person.jobs.length === 0)
        .map((person) => [person.name, '—', 'No job allocated', '—']),
    ];
    chunks(allocated, ROWS_PER_SLIDE).forEach((slice, page, pages) => {
      const slide = pptx.addSlide();
      addTitle(slide, `Jobs for ${panel}${pages.length > 1 ? ` (${page + 1}/${pages.length})` : ''}`, subtitle);
      if (slice.length === 0) {
        slide.addText(`No one is rostered on ${panel}.`, { x: 0.6, y: 1.7, w: 12, h: 0.4, fontSize: 18, color: TEXT });
      } else {
        addTable(slide, ['Who', 'Unit', 'Job', 'Status'], slice, [2.4, 1.6, 6.1, 2.2]);
      }
    });

    const notTheirs = [
      ...allocation.needsName.map((job) => ['Needs a name', job.fleetId, jobLine(job), stageLabel(job.stage)]),
      ...allocation.withOutgoing.map((job) => [job.names.join(', ') || 'Outgoing crew', job.fleetId, jobLine(job), stageLabel(job.stage)]),
    ];
    if (notTheirs.length > 0) {
      chunks(notTheirs, ROWS_PER_SLIDE).forEach((slice, page, pages) => {
        const slide = pptx.addSlide();
        addTitle(slide, `Not with ${panel} yet${pages.length > 1 ? ` (${page + 1}/${pages.length})` : ''}`, subtitle);
        addTable(slide, ['Who', 'Unit', 'Job', 'Status'], slice, [2.4, 1.6, 6.1, 2.2]);
      });
    }
  }

  if (parts.length > 0) {
    chunks(parts, ROWS_PER_SLIDE).forEach((slice, page, pages) => {
      const slide = pptx.addSlide();
      addTitle(slide, `Parts and hotshots${pages.length > 1 ? ` (${page + 1}/${pages.length})` : ''}`, subtitle);
      addTable(
        slide,
        ['Unit', 'Part', 'Status', 'ETA'],
        slice.map((part) => partRow(part)),
        [1.6, 6.3, 2.2, 2.2]
      );
    });
  }

  const machines = document.handedOver;
  chunks(machines, ROWS_PER_SLIDE).forEach((slice, page, pages) => {
    const slide = pptx.addSlide();
    addTitle(slide, `Still down${pages.length > 1 ? ` (${page + 1}/${pages.length})` : ''}`, subtitle);
    if (slice.length === 0) {
      slide.addText('No machines are being handed over.', { x: 0.6, y: 1.8, w: 12, h: 0.4, fontSize: 18, color: TEXT });
      return;
    }
    addTable(
      slide,
      ['Unit', 'Where', 'Job', 'Expected back'],
      slice.map((machine) => [
        machine.fleetId,
        machine.location,
        machine.orders.map((order) => `${order.woNumber ? `WO ${order.woNumber}: ` : ''}${order.task}`).join('\n') || 'No open job',
        formatDateTime(machine.expectedUp),
      ]),
      [1.8, 2.2, 6.1, 2.2]
    );
  });

  const machineNotes = document.machineNotes ?? [];
  if (machineNotes.length > 0) {
    chunks(machineNotes, ROWS_PER_SLIDE).forEach((slice, page, pages) => {
      const slide = pptx.addSlide();
      addTitle(slide, `What was noted${pages.length > 1 ? ` (${page + 1}/${pages.length})` : ''}`, subtitle);
      addTable(
        slide,
        ['Unit', 'This shift'],
        slice.map((note) => [note.fleetId, note.summary]),
        [2.2, 10.1]
      );
    });
  }

  const followUp = [priorities && `Priorities: ${priorities}`, watches && `Watch: ${watches}`, manning && `Manning: ${manning}`, compliance && `Checks: ${compliance}`]
    .filter(Boolean)
    .join('\n\n');
  if (followUp) {
    const slide = pptx.addSlide();
    addTitle(slide, 'Also for this crew', subtitle);
    card(slide, pptx, 0.6, 1.5, 12.1, 5.4, 'From the shift log', followUp);
  }

  document.customSlides.forEach((custom, index) => {
    const slide = pptx.addSlide();
    addTitle(slide, custom.title.trim() || `Extra slide ${index + 1}`, subtitle);
    card(slide, pptx, 0.6, 1.5, 12.1, 5.4, 'Notes', custom.notes.trim() || 'No notes added.');
  });

  const fileBits = ['Crew_Briefing', panel, input.shiftName, input.shiftDate].filter(Boolean);
  await pptx.writeFile({ fileName: `${fileBits.join('_').replace(/\s+/g, '_')}.pptx` });
}

function partRow(part: HandoverPartLine) {
  const name = `${part.hotshot ? 'Hotshot: ' : ''}${part.description}${part.po ? ` (${part.po})` : ''}`;
  return [part.fleetId, name, partStatusLabel(part.status), part.eta ? formatDateTime(part.eta) : '—'];
}
