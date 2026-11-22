import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ManagementSnapshot } from '@/utils/managementGaps';
import { DEFAULT_SITE_NAME } from '@/utils/siteBrand';

export function generateManagementSummary(snapshot: ManagementSnapshot, crewLabel: string, siteName = DEFAULT_SITE_NAME) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(siteName, pageWidth / 2, 8, { align: 'center' });
  doc.setFontSize(16);
  doc.text('Superintendent Briefing', pageWidth / 2, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${crewLabel} · ${new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, 21, { align: 'center' });

  autoTable(doc, {
    startY: 25,
    head: [['Fleet availability', 'Manning gap', 'Training bottlenecks', 'Statutory risk']],
    body: [[
      `${snapshot.availabilityPct}% · ${snapshot.ready} ready / ${snapshot.total} total · ${snapshot.down} down`,
      `${snapshot.unmanned} ready units unallocated · ${snapshot.ticketedOperators} ticketed operators · OT/contractor ${snapshot.productionReliancePct}% prod, ${snapshot.workshopReliancePct}% workshop`,
      `${snapshot.shortModels} shortfall · ${snapshot.noCribModels} no crib relief · ${snapshot.zeroTickets} with 0 tickets`,
      `${snapshot.overdueEtus} overdue ETUs`,
    ]],
    styles: { fontSize: 8, cellPadding: 1.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    margin: { left: 10, right: 10 },
  });

  const afterKpi = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
  autoTable(doc, {
    startY: afterKpi + 4,
    head: [['Crew', 'Department', 'Permanent', 'Away', 'Overtime', 'Contractors', 'OT/Contractor %', 'Unallocated']],
    body: snapshot.manning.map((row) => [
      `${row.letter} Crew`,
      row.department === 'production' ? 'Production' : 'Workshop',
      String(row.permanent),
      String(row.away),
      String(row.overtime),
      String(row.contractors),
      `${row.reliancePct}%`,
      String(row.unallocated),
    ]),
    styles: { fontSize: 8, cellPadding: 1.2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    margin: { left: 10, right: 10 },
  });

  const afterManning = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90;
  autoTable(doc, {
    startY: afterManning + 4,
    head: [['Model', 'Total', 'Healthy', 'A', 'B', 'C', 'D', 'In training', 'Gap']],
    body: snapshot.models.map((row) => [
      row.model,
      String(row.total),
      String(row.healthy),
      String(row.ticketed.A),
      String(row.ticketed.B),
      String(row.ticketed.C),
      String(row.ticketed.D),
      String(row.inTraining),
      row.risk,
    ]),
    styles: { fontSize: 7.5, cellPadding: 1, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    margin: { left: 10, right: 10 },
  });

  const stamp = new Date();
  const fileDate = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, '0')}-${String(stamp.getDate()).padStart(2, '0')}`;
  doc.save(`Management_Gap_Snapshot_${fileDate}.pdf`);
}
