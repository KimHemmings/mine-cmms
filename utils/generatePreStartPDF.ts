import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_SITE_NAME } from '@/utils/siteBrand';

export interface PreStartPerson {
  display_name: string;
  trade: string;
  department?: string | null;
  away?: boolean | null;
  allocated?: string | null;
  location?: string | null;
  roleNote?: string | null;
}

export interface PreStartShiftDetails {
  date: Date;
  shiftName: string;
  crew: string | null;
  safetyAwareness?: string | null;
}

function fileDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(date: Date) {
  return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function shiftWord(shiftName: string) {
  return shiftName.toLowerCase().includes('night') ? 'Night' : 'Day';
}

export function generatePreStartSheet(crewList: PreStartPerson[], shiftDetails: PreStartShiftDetails, siteName = DEFAULT_SITE_NAME) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const crew = shiftDetails.crew?.trim() || 'Crew not set';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(siteName, pageWidth / 2, 10, { align: 'center' });
  doc.setFontSize(20);
  doc.text('Pre-Start Sign-On Sheet', pageWidth / 2, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    `Date: ${displayDate(shiftDetails.date)}    Shift: ${shiftWord(shiftDetails.shiftName)}    Crew: ${crew}`,
    pageWidth / 2,
    26,
    { align: 'center' },
  );
  doc.text('Supervisor: ______________', pageWidth / 2, 33, { align: 'center' });

  let startY = 38;
  const focus = shiftDetails.safetyAwareness?.trim();
  if (focus) {
    const lines = doc.splitTextToSize(focus, pageWidth - 32).slice(0, 8);
    const boxHeight = 14 + lines.length * 5;
    doc.setDrawColor(180, 83, 9);
    doc.setFillColor(255, 251, 235);
    doc.rect(12, 36, pageWidth - 24, boxHeight, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(146, 64, 14);
    doc.text('SAFETY AWARENESS / PRE-START FOCUS', 16, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(lines, 16, 48);
    startY = 36 + boxHeight + 4;
  }

  const people = crewList.filter((person) => !person.away).sort((a, b) => a.display_name.localeCompare(b.display_name));
  const body = (people.length > 0 ? people : [{ display_name: '', trade: '', allocated: '', location: '' }]).map((person) => [
    person.display_name,
    person.trade + (person.roleNote ? ` (${person.roleNote})` : ''),
    person.allocated?.trim() || '',
    person.location?.trim() || '',
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY,
    head: [['Name', 'Trade / Role', 'Allocated Unit', 'Location', 'Time In', 'Signature', 'Fit for Work?']],
    body,
    theme: 'grid',
    styles: {
      minCellHeight: 15,
      fontSize: 10,
      textColor: [15, 23, 42],
      lineColor: [148, 163, 184],
      lineWidth: 0.2,
      valign: 'middle',
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      minCellHeight: 10,
    },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 46 },
      2: { cellWidth: 48 },
      3: { cellWidth: 48 },
      4: { cellWidth: 20 },
      5: { minCellWidth: 40 },
      6: { cellWidth: 24 },
    },
    margin: { left: 12, right: 12 },
  });

  doc.save(`Pre-Start_SignOn_${fileDate(shiftDetails.date)}.pdf`);
}
