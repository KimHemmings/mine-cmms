import { jsPDF } from 'jspdf';
import type { HandoverMachineLine, HandoverSnapshot, SavedHandover } from '@/types';

type HandoverPdfInput = Pick<
  SavedHandover,
  'shift_name' | 'shift_date' | 'crew' | 'supervisor' | 'document' |
  'outgoing_signed_by' | 'outgoing_signed_at' | 'oncoming_signed_by' | 'oncoming_signed_at'
>;

const PAGE_MARGIN = 10;

function cleanText(value: string) {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '');
}

function filePart(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Unknown';
}

export function handoverPdfFilename(handover: Pick<HandoverPdfInput, 'shift_name' | 'shift_date' | 'crew'>) {
  return `Shift_Handover_${handover.shift_date?.slice(0, 10) || 'Undated'}_${filePart(handover.shift_name)}_${filePart(handover.crew ?? 'Unknown_Crew')}`;
}

export function printHandoverDocument(title: string) {
  const originalTitle = document.title;
  const restoreTitle = () => {
    document.title = originalTitle;
  };
  window.addEventListener('afterprint', restoreTitle, { once: true });
  document.title = title;
  try {
    window.print();
  } catch (error) {
    window.removeEventListener('afterprint', restoreTitle);
    restoreTitle();
    throw error;
  }
}

function dateLabel(value: string | null) {
  if (!value) return 'Undated';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value.slice(0, 10)
    : parsed.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timestampLabel(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}

function machineNotes(machine: HandoverMachineLine, document: HandoverSnapshot) {
  const notes = document.machine_summaries?.[machine.machineId]
    ?? document.machine_summaries?.[machine.fleetId]
    ?? [];
  const jobs = machine.orders.map((order) => {
    const components = order.components?.filter(Boolean).join(' / ');
    const workOrder = order.woNumber?.trim();
    const title = `${components ? `${components} - ` : ''}${order.task || 'Job not recorded'}`;
    return `${title}${workOrder ? ` (${/^WO/i.test(workOrder) ? workOrder : `WO ${workOrder}`})` : ''}`;
  });
  const lines = [...jobs, ...notes.map((note) => `- ${note}`)];
  return lines.length > 0 ? lines.join('\n') : 'No job or shift notes recorded.';
}

export async function exportHandoverPdf(handover: HandoverPdfInput) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const bottom = pageHeight - PAGE_MARGIN;
  const lineHeight = 4.2;
  let y = PAGE_MARGIN;

  const newPage = () => {
    pdf.addPage();
    y = PAGE_MARGIN;
  };
  const ensureSpace = (height: number) => {
    if (y + height > bottom) newPage();
  };
  const wrapped = (text: string, width: number, fontSize = 9) => {
    pdf.setFontSize(fontSize);
    return pdf.splitTextToSize(cleanText(text), width) as string[];
  };
  const drawSectionTitle = (title: string, repeat = false) => {
    ensureSpace(9);
    pdf.setFillColor(241, 245, 249);
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(PAGE_MARGIN, y, contentWidth, 7, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text(cleanText(title).toUpperCase(), PAGE_MARGIN + 2.5, y + 4.8);
    y += repeat ? 9 : 10;
  };
  const drawParagraph = (text: string, fontSize = 9, bold = false, indent = 1) => {
    const lines = wrapped(text, contentWidth - indent * 2, fontSize);
    const height = Math.max(lineHeight, lines.length * lineHeight) + 1;
    ensureSpace(Math.min(height, pageHeight - PAGE_MARGIN * 2));
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(30, 41, 59);
    for (const line of lines) {
      if (y + lineHeight > bottom) newPage();
      pdf.text(line, PAGE_MARGIN + indent, y + 3);
      y += lineHeight;
    }
    y += 1;
  };

  const document = handover.document;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text('MAINTENANCE SHIFT HANDOVER', PAGE_MARGIN, y + 5);
  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const metadata = [
    `Date: ${dateLabel(handover.shift_date)}`,
    `Shift: ${handover.shift_name || 'Not recorded'}`,
    `Outgoing Crew: ${document.outgoingCrew ?? handover.crew ?? 'Not recorded'}`,
    `Incoming Crew: ${document.incomingCrew ?? 'Not recorded'}`,
    `Supervisor: ${handover.supervisor ?? 'Not recorded'}`,
  ];
  for (const line of pdf.splitTextToSize(cleanText(metadata.join('    |    ')), contentWidth) as string[]) {
    pdf.text(line, PAGE_MARGIN, y + 3);
    y += lineHeight;
  }
  y += 2;

  const shiftSummary = (document.shift_summary ?? document.summary ?? '').trim();
  const summaryColumnWidth = contentWidth;
  const summaryCards = [
    { title: 'SHIFT SUMMARY', text: shiftSummary || 'No summary recorded.', lines: wrapped(shiftSummary || 'No summary recorded.', summaryColumnWidth - 8, 9) },
  ];
  const summaryLineCapacity = () => Math.max(1, Math.floor((bottom - y - 12) / lineHeight));
  const summaryOffsets = summaryCards.map(() => 0);
  do {
    if (bottom - y < 19) newPage();
    const linesPerCard = summaryCards.map((card, index) =>
      card.lines.slice(summaryOffsets[index], summaryOffsets[index] + summaryLineCapacity()));
    const rowLineCount = Math.max(...linesPerCard.map((lines) => lines.length), 1);
    const boxHeight = Math.max(19, rowLineCount * lineHeight + 12);
    summaryCards.forEach((card, index) => {
      const x = PAGE_MARGIN + index * (summaryColumnWidth + 4);
      pdf.setDrawColor(148, 163, 184);
      pdf.setFillColor(248, 250, 252);
      pdf.setLineWidth(0.6);
      pdf.roundedRect(x, y, summaryColumnWidth, boxHeight, 2, 2, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text(
        summaryOffsets[index] === 0 ? card.title : `${card.title} (CONTINUED)`,
        x + 4,
        y + 5,
      );
      pdf.setFont('helvetica', 'normal');
      let summaryY = y + 10;
      for (const line of linesPerCard[index]) {
        pdf.text(line, x + 4, summaryY);
        summaryY += lineHeight;
      }
      summaryOffsets[index] += linesPerCard[index].length;
    });
    y += boxHeight + 3;
    if (summaryCards.some((card, index) => summaryOffsets[index] < card.lines.length)) newPage();
  } while (summaryCards.some((card, index) => summaryOffsets[index] < card.lines.length));

  drawSectionTitle('Safety & Incidents');
  const safetyEntries = [
    ...(document.safetyIncidents ?? []).map((incident) =>
      `${incident.what || 'Incident'}${incident.where ? ` - ${incident.where}` : ''}${incident.action ? ` - Action: ${incident.action}` : ''}`),
    ...(document.log ?? [])
      .filter((entry) => entry.category === 'SAFETY')
      .map((entry) => `${entry.fleet_id ? `${entry.fleet_id} - ` : ''}${entry.details}${entry.action_required ? ` - Action: ${entry.action_required}` : ''}`),
  ];
  if (safetyEntries.length === 0) drawParagraph('Nothing reported this shift.');
  else safetyEntries.forEach((entry) => drawParagraph(`- ${entry}`));

  drawSectionTitle('Safety Focus / Share');
  drawParagraph(document.safetyFocus?.trim() || 'No safety share recorded.');

  const drawMachineTable = (title: string, machines: HandoverMachineLine[], finalColumn: string, released: boolean) => {
    const sorted = [...machines].sort((a, b) => a.fleetId.localeCompare(b.fleetId));
    const columns = [
      { title: 'UNIT', width: 43 },
      { title: 'JOB & SHIFT NOTES', width: 141 },
      { title: 'CREW', width: 45 },
      { title: finalColumn.toUpperCase(), width: contentWidth - 229 },
    ];
    const drawTableHeader = () => {
      pdf.setFillColor(226, 232, 240);
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(PAGE_MARGIN, y, contentWidth, 7, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(51, 65, 85);
      let x = PAGE_MARGIN + 2;
      columns.forEach((column) => {
        pdf.text(column.title, x, y + 4.8);
        x += column.width;
      });
      y += 7;
    };
    const drawTableTitle = (continuation = false) => {
      ensureSpace(18);
      drawSectionTitle(`${title}${continuation ? ' (continued)' : ''}`);
      drawTableHeader();
    };

    drawTableTitle();
    if (sorted.length === 0) {
      drawParagraph(released ? 'No machines released.' : 'No machines handed over.');
      return;
    }

    for (const machine of sorted) {
      const crew = machine.orders.map((order) => order.fitter).filter(Boolean).join(', ') || 'Unassigned';
      const unit = `${machine.fleetId} [${machine.priority || 'P3'}]\n${machine.makeModel || 'Model not recorded'}\n${machine.location || 'Location not recorded'}`;
      const expected = released
        ? (timestampLabel(machine.actualUp ?? null) ?? 'Not recorded')
        : (timestampLabel(machine.expectedUp) ?? 'Not recorded');
      const cells = [
        wrapped(unit, columns[0].width - 4, 8),
        wrapped(machineNotes(machine, document), columns[1].width - 4, 8),
        wrapped(crew, columns[2].width - 4, 8),
        wrapped(expected, columns[3].width - 4, 8),
      ];
      const rowLines = Math.max(...cells.map((cell) => cell.length), 1);
      const availableLines = Math.max(1, Math.floor((bottom - PAGE_MARGIN - 8) / lineHeight));
      let offset = 0;
      while (offset < rowLines) {
        const remainingHeight = bottom - y;
        if (remainingHeight < lineHeight + 2) {
          newPage();
          drawTableTitle(true);
        }
        const linesThisPage = Math.max(1, Math.min(
          rowLines - offset,
          Math.floor((bottom - y) / lineHeight),
          availableLines,
        ));
        const rowHeight = linesThisPage * lineHeight + 2;
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(PAGE_MARGIN, y, contentWidth, rowHeight);
        let x = PAGE_MARGIN;
        cells.forEach((cell, index) => {
          const visibleLines = cell.slice(offset, offset + linesThisPage);
          pdf.setFont('helvetica', index === 0 ? 'bold' : 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(30, 41, 59);
          visibleLines.forEach((line, lineIndex) => pdf.text(line, x + 2, y + 3.2 + lineIndex * lineHeight));
          x += columns[index].width;
          if (index < columns.length - 1) pdf.line(x, y, x, y + rowHeight);
        });
        y += rowHeight;
        offset += linesThisPage;
        if (offset < rowLines) {
          newPage();
          drawTableTitle(true);
        }
      }
    }
    y += 3;
  };

  drawMachineTable('Still Down', document.handedOver ?? [], 'Expected Back', false);
  drawMachineTable('Released', document.released ?? [], 'Release Time', true);

  drawSectionTitle('OCE report');
  const oceBody = document.oce?.sourceText ?? '';
  if (!oceBody.trim()) {
    drawParagraph(document.oce?.fileName
      ? 'This PDF has no extractable text layer. Paste the report so a section is not missed.'
      : 'No OCE report for this shift.');
  } else {
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    oceBody.replace(/\r\n/g, '\n').split('\n').forEach((line) => {
      const pieces = pdf.splitTextToSize(line.length ? line : ' ', contentWidth) as string[];
      pieces.forEach((piece) => {
        ensureSpace(lineHeight);
        pdf.text(piece, PAGE_MARGIN, y);
        y += lineHeight;
      });
    });
  }

  pdf.save(`${handoverPdfFilename(handover)}.pdf`);
}
