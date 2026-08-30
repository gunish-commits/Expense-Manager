// lib/utils/pdfGenerator.ts
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Group, Expense, Settlement, SettleUpPayment } from '@/types';

/**
 * Generates and downloads a beautiful, formatted PDF report of the group's
 * expenses, settlements, and the simplified "who pays whom" settle up directions.
 */
export function generateGroupPDF(
  group: Group,
  expenses: Expense[],
  settlements: Settlement[],
  simplification: SettleUpPayment[]
): void {
  const doc = new jsPDF();
  
  // Draw header block (Slate 900)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 35, 'F');
  
  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${group.name} - Settlement Report`, 15, 18);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175); // Slate 400
  doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} • SplitAdvanced`, 15, 27);
  
  let currentY = 48;
  
  // 1. Settlement Plan Section
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Smart Settlement Plan (Minimal Payments)', 15, currentY);
  
  currentY += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  
  if (simplification.length === 0) {
    doc.setTextColor(22, 163, 74); // Green 600
    doc.text('✓ Group is fully settled. No payments are currently pending!', 15, currentY);
    currentY += 12;
  } else {
    simplification.forEach(item => {
      // Draw bullet
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text('•', 15, currentY);
      
      // debtor name
      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.text(item.from_name, 20, currentY);
      const debtorWidth = doc.getTextWidth(item.from_name);
      
      // " pays "
      doc.setTextColor(71, 85, 105);
      doc.setFont('Helvetica', 'normal');
      doc.text(' pays ', 20 + debtorWidth, currentY);
      const paysWidth = doc.getTextWidth(' pays ');
      
      // creditor name
      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.text(item.to_name, 20 + debtorWidth + paysWidth, currentY);
      const creditorWidth = doc.getTextWidth(item.to_name);
      
      // ":"
      doc.setTextColor(71, 85, 105);
      doc.setFont('Helvetica', 'normal');
      doc.text(' :', 20 + debtorWidth + paysWidth + creditorWidth, currentY);
      const colonWidth = doc.getTextWidth(' :');
      
      // amount
      doc.setTextColor(99, 102, 241); // Indigo 500
      doc.setFont('Helvetica', 'bold');
      doc.text(` ₹${item.amount.toFixed(2)}`, 20 + debtorWidth + paysWidth + creditorWidth + colonWidth, currentY);
      
      currentY += 6;
    });
    currentY += 8;
  }

  // 2. Expenses Table Section
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Group Expenses Log', 15, currentY);
  currentY += 4;

  const expenseRows = expenses.map(exp => [
    exp.date,
    exp.description,
    exp.category,
    exp.added_by_profile?.name || 'Unknown',
    `INR ${Number(exp.amount).toFixed(2)}`
  ]);

  (doc as any).autoTable({
    startY: currentY,
    head: [['Date', 'Description', 'Category', 'Paid By', 'Amount']],
    body: expenseRows,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' }, // Indigo 600
    styles: { fontSize: 8.5 },
    margin: { left: 15, right: 15 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // 3. Settlements Table Section
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Settlement History', 15, currentY);
  currentY += 4;

  const settlementRows = settlements.map(s => [
    s.date,
    s.from_profile?.name || 'Unknown',
    s.to_profile?.name || 'Unknown',
    s.note || '-',
    `INR ${Number(s.amount).toFixed(2)}`
  ]);

  (doc as any).autoTable({
    startY: currentY,
    head: [['Date', 'From Member', 'To Member', 'Note', 'Amount']],
    body: settlementRows,
    theme: 'striped',
    headStyles: { fillColor: [13, 148, 136], fontStyle: 'bold' }, // Teal 600
    styles: { fontSize: 8.5 },
    margin: { left: 15, right: 15 }
  });

  // Footer on all pages (handled simply here by saving)
  const groupCleanName = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`${groupCleanName}_settlement_report.pdf`);
}
