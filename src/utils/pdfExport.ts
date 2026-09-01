import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuditData {
  tenders: any[];
  bids: any[];
  contracts: any[];
  blockchainRecords: any[];
  disputes: any[];
  reports: any[];
}

export function generateAuditPDF(data: AuditData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Cover / Header ──
  doc.setFillColor(15, 41, 66); // #0f2942
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Procurement Audit Trail Report', pageWidth / 2, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });
  doc.text('Decentralized Public E-Procurement Ecosystem', pageWidth / 2, 35, { align: 'center' });

  y = 52;
  doc.setTextColor(15, 41, 66);

  // ── Summary Statistics ──
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, y);
  y += 8;

  const stats = [
    ['Total Tenders', String(data.tenders.length)],
    ['Total Bids', String(data.bids.length)],
    ['Active Contracts', String(data.contracts.length)],
    ['Blockchain Records', String(data.blockchainRecords.length)],
    ['On-Chain Transactions', String(data.blockchainRecords.filter(r => r.onChain).length)],
    ['Disputes / Objections', String(data.disputes.length)],
    ['Whistleblower Reports', String(data.reports.filter((r: any) => r.type !== 'evaluation_report').length)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Count']],
    body: stats,
    theme: 'grid',
    headStyles: { fillColor: [15, 41, 66], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ── Tenders ──
  if (data.tenders.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Tenders', 14, y);
    y += 8;

    const tenderRows = data.tenders.map((t: any) => [
      t.id,
      t.title?.substring(0, 40) || '—',
      t.status || '—',
      t.budget ? `AFN ${Number(t.budget).toLocaleString()}` : '—',
      t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['ID', 'Title', 'Status', 'Budget', 'Date']],
      body: tenderRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 41, 66], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 1: { cellWidth: 55 } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ── Contracts ──
  if (data.contracts.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Contracts', 14, y);
    y += 8;

    const contractRows = data.contracts.map((c: any) => [
      c.id,
      c.tenderTitle?.substring(0, 35) || '—',
      c.supplierName || '—',
      c.amount ? `AFN ${Number(c.amount).toLocaleString()}` : '—',
      c.progress !== undefined ? `${c.progress}%` : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['ID', 'Tender', 'Supplier', 'Amount', 'Progress']],
      body: contractRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 41, 66], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ── Blockchain Verification Records ──
  if (data.blockchainRecords.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Blockchain Verification Records', 14, y);
    y += 8;

    const bcRows = data.blockchainRecords.slice(0, 30).map((r: any) => [
      r.type?.replace(/_/g, ' ') || '—',
      r.onChain ? 'On-Chain' : 'Simulated',
      r.transactionHash ? `${r.transactionHash.slice(0, 14)}...` : '—',
      r.timestamp ? new Date(r.timestamp).toLocaleString() : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Action', 'Mode', 'TX Hash', 'Timestamp']],
      body: bcRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 41, 66], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: { 2: { font: 'courier' } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ── Disputes ──
  if (data.disputes.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Disputes & Complaints', 14, y);
    y += 8;

    const disputeRows = data.disputes.map((d: any) => [
      d.id,
      d.title?.substring(0, 35) || '—',
      d.type?.replace(/_/g, ' ') || '—',
      d.status || '—',
      d.resolution?.decision || 'Pending',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['ID', 'Title', 'Type', 'Status', 'Decision']],
      body: disputeRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 41, 66], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ── Whistleblower Reports (anonymized) ──
  const wbReports = data.reports.filter((r: any) => r.type !== 'evaluation_report');
  if (wbReports.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Whistleblower Reports (Anonymized)', 14, y);
    y += 8;

    const reportRows = wbReports.map((r: any) => [
      r.id,
      r.category || '—',
      r.severity || '—',
      r.status || '—',
      r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Report ID', 'Category', 'Severity', 'Status', 'Date']],
      body: reportRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 41, 66], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Footer on all pages ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} — Decentralized Public E-Procurement Ecosystem — Audit Trail`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`procurement-audit-report-${new Date().toISOString().split('T')[0]}.pdf`);
}
