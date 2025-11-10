import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

export const exportToPDF = (
  data: any[],
  filename: string,
  title: string,
  companyName?: string,
  dateRange?: string,
  summary?: Record<string, any>
) => {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(20);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });
  
  let yPos = 30;
  
  // Company name and date range
  doc.setFontSize(10);
  if (companyName) {
    doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
  }
  if (dateRange) {
    doc.text(dateRange, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
  }
  
  yPos += 5;
  
  // Summary statistics
  if (summary && Object.keys(summary).length > 0) {
    doc.setFontSize(12);
    doc.text('Summary', 14, yPos);
    yPos += 7;
    
    doc.setFontSize(9);
    Object.entries(summary).forEach(([key, value]) => {
      doc.text(`${key}: ${value}`, 14, yPos);
      yPos += 5;
    });
    
    yPos += 5;
  }
  
  // Data table
  const headers = Object.keys(data[0]);
  const tableData = data.map(row => 
    headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );
  
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: yPos,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 10 },
  });
  
  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${totalPages} • Generated ${new Date().toLocaleString()}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};
