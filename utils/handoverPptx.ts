// utils/handoverPptx.ts
import pptxgen from 'pptxgenjs';
import { Asset, MachineWorkOrder } from '@/types';

export interface CustomSlideData {
  id: string;
  title: string;
  notes: string;
}

interface HandoverPptxPayload {
  shiftName: string;
  supervisor: string;
  weather: string;
  safetyFocus: string;
  manning: string;
  nextShiftPriorities: string;
  activeAssets: Asset[];
  workOrders: MachineWorkOrder[];
  customSlides: CustomSlideData[];
}

export async function generateHandoverPptx(data: HandoverPptxPayload) {
  const pptx = new pptxgen();

  pptx.defineLayout({ name: 'WIDESCREEN_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDESCREEN_16_9';

  const BG_COLOR = '0F172A';
  const CARD_BG = '1E293B';
  const BORDER_COLOR = '334155';

  // --- SLIDE 1: Title, Weather & Safety ---
  const slide1 = pptx.addSlide();
  slide1.background = { color: BG_COLOR };

  slide1.addText(`SHIFT HANDOVER: ${data.shiftName.toUpperCase()}`, {
    x: 0.8, y: 0.5, w: 11.7, h: 0.6, fontSize: 26, bold: true, color: 'F59E0B'
  });
  slide1.addText(`Supervisor: ${data.supervisor || 'Workshop Management'}  |  Date: ${new Date().toLocaleDateString()}  |  Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, {
    x: 0.8, y: 1.1, w: 11.7, h: 0.4, fontSize: 13, color: '94A3B8'
  });

  slide1.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.8, w: 5.65, h: 4.9, fill: { color: CARD_BG }, line: { color: BORDER_COLOR, width: 1.5 } });
  slide1.addText('🌦️ Weather & Pit Conditions', { x: 1.1, y: 2.05, w: 5.0, h: 0.4, fontSize: 17, bold: true, color: '38BDF8' });
  slide1.addText(data.weather?.trim() || 'Normal operating conditions. Haul roads clear and operational.', {
    x: 1.1, y: 2.6, w: 5.0, h: 3.8, fontSize: 15, color: 'F1F5F9', valign: 'top', lineSpacing: 22
  });

  slide1.addShape(pptx.ShapeType.rect, { x: 6.85, y: 1.8, w: 5.65, h: 4.9, fill: { color: CARD_BG }, line: { color: BORDER_COLOR, width: 1.5 } });
  slide1.addText('⚠️ Safety & Statutory Focus', { x: 7.15, y: 2.05, w: 5.0, h: 0.4, fontSize: 17, bold: true, color: 'EF4444' });
  slide1.addText(data.safetyFocus?.trim() || 'Positive isolation audits, verify zero energy state, maintain 3-point contact on mobile plant.', {
    x: 7.15, y: 2.6, w: 5.0, h: 3.8, fontSize: 15, color: 'F1F5F9', valign: 'top', lineSpacing: 22
  });

  // --- SLIDE 2: Active Workshop Fleet (Table with Hotshots) ---
  const slide2 = pptx.addSlide();
  slide2.background = { color: BG_COLOR };

  slide2.addText(`Active Workshop Fleet & In-Pit Work (${data.activeAssets.length} Units Down)`, {
    x: 0.8, y: 0.5, w: 11.7, h: 0.6, fontSize: 24, bold: true, color: 'F59E0B'
  });
  slide2.addText('Current status of open maintenance jobs & in-transit hotshots handed over', {
    x: 0.8, y: 1.1, w: 11.7, h: 0.35, fontSize: 13, color: '94A3B8'
  });

  const tableHeaders = [
    { text: 'Unit', options: { bold: true, fill: { color: '1E293B' }, color: 'F59E0B' } },
    { text: 'Location', options: { bold: true, fill: { color: '1E293B' }, color: 'F59E0B' } },
    { text: 'Task / Event Description', options: { bold: true, fill: { color: '1E293B' }, color: 'F59E0B' } },
    { text: 'Stage', options: { bold: true, fill: { color: '1E293B' }, color: 'F59E0B' } },
    { text: 'Allocated', options: { bold: true, fill: { color: '1E293B' }, color: 'F59E0B' } },
  ];

  const tableRows = data.activeAssets.slice(0, 7).map((asset, idx) => {
    const orders = data.workOrders.filter((w) => w.asset_id === asset.id);
    const mainWo = orders.find((w) => w.is_main_event) || orders[0];
    const hotshots = orders.flatMap((w) => w.parts || []).filter((p) => p.is_special_run);

    let taskText = mainWo?.task_description || asset.shift_task || 'Unscheduled Breakdown';
    if (hotshots.length > 0) {
      const hs = hotshots[0];
      const etaStr = hs.eta ? new Date(hs.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
      taskText += `\n[🔥 HOTSHOT: ${(hs as any).description || hs.part_number} | ETA ${etaStr}]`;
    }

    const rowBg = idx % 2 === 0 ? '162032' : '0F172A';
    return [
      { text: `${asset.fleet_id}\n(${asset.make_model})`, options: { fill: { color: rowBg }, color: 'FFFFFF', bold: true } },
      { text: asset.location || 'In Pit', options: { fill: { color: rowBg }, color: 'CBD5E1' } },
      { text: taskText, options: { fill: { color: rowBg }, color: hotshots.length > 0 ? 'FCD34D' : 'F8FAFC' } },
      { text: (mainWo?.stage || asset.shift_stage || 'IN_PROGRESS').replace('_', ' '), options: { fill: { color: rowBg }, color: 'FCD34D', bold: true } },
      { text: mainWo?.fitter_assigned || 'Unassigned', options: { fill: { color: rowBg }, color: 'CBD5E1' } },
    ];
  });

  slide2.addTable([tableHeaders, ...tableRows], {
    x: 0.8,
    y: 1.6,
    w: 11.7,
    colW: [1.5, 1.9, 4.8, 1.8, 1.7],
    fontSize: 11,
    border: { pt: 0.75, color: BORDER_COLOR },
    align: 'left',
    valign: 'middle',
  });

  // --- SLIDE 3: Manning & Next Shift Line-Up ---
  const slide3 = pptx.addSlide();
  slide3.background = { color: BG_COLOR };

  slide3.addText('Manning, Support Equipment & Line-Up', {
    x: 0.8, y: 0.5, w: 11.7, h: 0.6, fontSize: 26, bold: true, color: 'F59E0B'
  });
  slide3.addText('Crew distribution and priorities for the incoming shift', {
    x: 0.8, y: 1.1, w: 11.7, h: 0.4, fontSize: 13, color: '94A3B8'
  });

  slide3.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.8, w: 5.65, h: 4.9, fill: { color: CARD_BG }, line: { color: BORDER_COLOR, width: 1.5 } });
  slide3.addText('👷 Trade Manning & Crew Notes', { x: 1.1, y: 2.05, w: 5.0, h: 0.4, fontSize: 17, bold: true, color: '38BDF8' });
  slide3.addText(data.manning?.trim() || 'Full crew available. All service trucks operational. Zero unscheduled absenteeism.', {
    x: 1.1, y: 2.6, w: 5.0, h: 3.8, fontSize: 15, color: 'F1F5F9', valign: 'top', lineSpacing: 22
  });

  slide3.addShape(pptx.ShapeType.rect, { x: 6.85, y: 1.8, w: 5.65, h: 4.9, fill: { color: CARD_BG }, line: { color: BORDER_COLOR, width: 1.5 } });
  slide3.addText('🎯 Incoming Shift Priorities', { x: 7.15, y: 2.05, w: 5.0, h: 0.4, fontSize: 17, bold: true, color: '10B981' });
  slide3.addText(data.nextShiftPriorities?.trim() || 'Receive and fit hotshot components upon delivery. Complete outstanding PM inspections.', {
    x: 7.15, y: 2.6, w: 5.0, h: 3.8, fontSize: 15, color: 'F1F5F9', valign: 'top', lineSpacing: 22
  });

  // --- SLIDE 4+: Dynamic Custom Slides ---
  data.customSlides.forEach((custom, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: BG_COLOR };

    slide.addText(custom.title?.trim() || `Special Operations Topic #${idx + 1}`, {
      x: 0.8, y: 0.5, w: 11.7, h: 0.6, fontSize: 24, bold: true, color: 'F59E0B'
    });

    slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.5, w: 11.7, h: 5.2, fill: { color: CARD_BG }, line: { color: BORDER_COLOR, width: 1.5 } });
    slide.addText(custom.notes?.trim() || 'No additional notes provided.', {
      x: 1.2, y: 1.9, w: 10.9, h: 4.4, fontSize: 16, color: 'F8FAFC', valign: 'top', lineSpacing: 24
    });
  });

  await pptx.writeFile({
    fileName: `Handover_${data.shiftName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pptx`
  });
}