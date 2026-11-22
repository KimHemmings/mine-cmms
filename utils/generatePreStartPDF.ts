import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { departmentLabel } from '@/utils/permissions';

export interface PreStartPerson {
  display_name: string;
  trade: string;
  department?: string | null;
  away?: boolean | null;
  allocated?: string | null;
  roleNote?: string | null;
}

export interface PreStartShiftDetails {
  date: Date;
  shiftName: string;
  crew: string | null;
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

export function generatePreStartSheet(crewList: PreStartPerson[], shiftDetails: PreStartShiftDetails) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const crew = shiftDetails.crew?.trim() || 'Crew not set';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Pre-Start Sign-On Sheet', pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    `Date: ${displayDate(shiftDetails.date)}    Shift: ${shiftWord(shiftDetails.shiftName)}    Crew: ${crew}`,
    pageWidth / 2,
    24,
    { align: 'center' },
  );
  doc.text('Supervisor: ______________', pageWidth / 2, 31, { align: 'center' });

  const people = crewList.filter((person) => !person.away).sort((a, b) => a.display_name.localeCompare(b.display_name));
  const body = (people.length > 0 ? people : [{ display_name: '', trade: '', department: '', allocated: '' }]).map((person) => [
    person.display_name,
    person.trade + (person.roleNote ? ` (${person.roleNote})` : ''),
    person.department ? departmentLabel(person.department) : '',
    person.allocated?.trim() || '',
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 36,
    head: [['Name', 'Trade / Role', 'Department', 'Allocated Unit', 'Time In', 'Signature', 'Fit for Work?']],
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
      0: { cellWidth: 44 },
      1: { cellWidth: 46 },
      2: { cellWidth: 28 },
      3: { cellWidth: 42 },
      4: { cellWidth: 22 },
      5: { minCellWidth: 60 },
      6: { cellWidth: 28 },
    },
    margin: { left: 12, right: 12 },
  });

  doc.save(`Pre-Start_SignOn_${fileDate(shiftDetails.date)}.pdf`);
}
