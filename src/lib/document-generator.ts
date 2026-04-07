import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

export interface DocumentContent {
  title: string;
  content: string;
  type: 'pdf' | 'docx';
}

export function detectDocumentRequest(message: string): { isDocumentRequest: boolean; type: 'pdf' | 'docx' | null } {
  const lowerMessage = message.toLowerCase();
  
  const pdfPatterns = [
    /make\s*(me\s*)?(this\s*)?(a\s*)?pdf/i,
    /make\s*(me\s*)?(this\s*)?(into\s*)?(a\s*)?pdf/i,
    /make\s*(this\s*)?(as\s*)?(a\s*)?pdf/i,
    /create\s*(me\s*)?(a\s*)?pdf/i,
    /generate\s*(me\s*)?(a\s*)?pdf/i,
    /turn\s*(this\s*)?(into\s*)?(a\s*)?pdf/i,
    /convert\s*(this\s*)?(to\s*)?(a\s*)?pdf/i,
    /as\s*(a\s*)?pdf/i,
    /in\s*pdf(\s*format)?/i,
    /pdf\s*(file|document|format)/i,
    /export\s*(as\s*)?(a\s*)?pdf/i,
    /save\s*(as\s*)?(a\s*)?pdf/i,
    /give\s*(me\s*)?(this\s*)?(as\s*)?(a\s*)?pdf/i,
    /want\s*(this\s*)?(as\s*)?(a\s*)?pdf/i,
    /need\s*(this\s*)?(as\s*)?(a\s*)?pdf/i,
    /into\s*(a\s*)?pdf/i,
    /to\s*(a\s*)?pdf/i,
  ];
  
  const docxPatterns = [
    /make\s*(me\s*)?(this\s*)?(a\s*)?(word|docx?|document)/i,
    /make\s*(me\s*)?(this\s*)?(into\s*)?(a\s*)?(word|docx?)/i,
    /make\s*(this\s*)?(as\s*)?(a\s*)?(word|docx?)/i,
    /create\s*(me\s*)?(a\s*)?(word|docx?|document)/i,
    /generate\s*(me\s*)?(a\s*)?(word|docx?|document)/i,
    /turn\s*(this\s*)?(into\s*)?(a\s*)?(word|docx?)/i,
    /convert\s*(this\s*)?(to\s*)?(a\s*)?(word|docx?)/i,
    /as\s*(a\s*)?(word|docx?)\s*(document|file)?/i,
    /in\s*(word|docx?)(\s*format)?/i,
    /(word|docx?)\s*(file|document|format)/i,
    /export\s*(as\s*)?(a\s*)?(word|docx?)/i,
    /save\s*(as\s*)?(a\s*)?(word|docx?)/i,
    /give\s*(me\s*)?(this\s*)?(as\s*)?(a\s*)?(word|docx?)/i,
    /want\s*(this\s*)?(as\s*)?(a\s*)?(word|docx?)/i,
    /need\s*(this\s*)?(as\s*)?(a\s*)?(word|docx?)/i,
    /into\s*(a\s*)?(word|docx?)/i,
    /to\s*(a\s*)?(word|docx?)/i,
    /\.docx?(\s|$)/i,
  ];
  
  for (const pattern of pdfPatterns) {
    if (pattern.test(message)) {
      return { isDocumentRequest: true, type: 'pdf' };
    }
  }
  
  for (const pattern of docxPatterns) {
    if (pattern.test(message)) {
      return { isDocumentRequest: true, type: 'docx' };
    }
  }
  
  return { isDocumentRequest: false, type: null };
}

export function parseMarkdownToStructure(content: string): Array<{ type: 'heading' | 'paragraph' | 'list-item'; level?: number; text: string }> {
  const lines = content.split('\n');
  const structure: Array<{ type: 'heading' | 'paragraph' | 'list-item'; level?: number; text: string }> = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      structure.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].replace(/\*\*/g, '').replace(/\*/g, ''),
      });
      continue;
    }
    
    const listMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
    if (listMatch) {
      structure.push({
        type: 'list-item',
        text: listMatch[1].replace(/\*\*/g, '').replace(/\*/g, ''),
      });
      continue;
    }
    
    const numberedListMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    if (numberedListMatch) {
      structure.push({
        type: 'list-item',
        text: numberedListMatch[1].replace(/\*\*/g, '').replace(/\*/g, ''),
      });
      continue;
    }
    
    structure.push({
      type: 'paragraph',
      text: trimmedLine.replace(/\*\*/g, '').replace(/\*/g, ''),
    });
  }
  
  return structure;
}

export async function generatePDF(title: string, content: string): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;
  
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(33, 33, 33);
  
  const titleLines = pdf.splitTextToSize(title, contentWidth);
  checkPageBreak(titleLines.length * 10 + 15);
  pdf.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 10 + 15;
  
  pdf.setDrawColor(66, 133, 244);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition - 10, pageWidth - margin, yPosition - 10);
  
  const structure = parseMarkdownToStructure(content);
  
  for (const item of structure) {
    if (item.type === 'heading') {
      const fontSize = item.level === 1 ? 18 : item.level === 2 ? 16 : 14;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(33, 33, 33);
      
      const headingLines = pdf.splitTextToSize(item.text, contentWidth);
      checkPageBreak(headingLines.length * (fontSize / 2.5) + 8);
      yPosition += 5;
      pdf.text(headingLines, margin, yPosition);
      yPosition += headingLines.length * (fontSize / 2.5) + 5;
    } else if (item.type === 'list-item') {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(66, 66, 66);
      
      const bulletText = `• ${item.text}`;
      const listLines = pdf.splitTextToSize(bulletText, contentWidth - 5);
      checkPageBreak(listLines.length * 5 + 3);
      pdf.text(listLines, margin + 5, yPosition);
      yPosition += listLines.length * 5 + 3;
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(66, 66, 66);
      
      const paragraphLines = pdf.splitTextToSize(item.text, contentWidth);
      checkPageBreak(paragraphLines.length * 5 + 5);
      pdf.text(paragraphLines, margin, yPosition);
      yPosition += paragraphLines.length * 5 + 5;
    }
  }
  
  const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_${Date.now()}.pdf`;
  pdf.save(fileName);
}

export async function generateDocx(title: string, content: string): Promise<void> {
  const structure = parseMarkdownToStructure(content);
  
  const children: Paragraph[] = [];
  
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 48,
          color: '212121',
        }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 },
    })
  );
  
  for (const item of structure) {
    if (item.type === 'heading') {
      const headingLevel = item.level === 1 ? HeadingLevel.HEADING_1 
        : item.level === 2 ? HeadingLevel.HEADING_2 
        : HeadingLevel.HEADING_3;
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.text,
              bold: true,
              size: item.level === 1 ? 36 : item.level === 2 ? 32 : 28,
            }),
          ],
          heading: headingLevel,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (item.type === 'list-item') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${item.text}`,
              size: 22,
            }),
          ],
          spacing: { before: 60, after: 60 },
          indent: { left: 720 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.text,
              size: 22,
            }),
          ],
          spacing: { before: 120, after: 120 },
        })
      );
    }
  }
  
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
  
  const blob = await Packer.toBlob(doc);
  const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_${Date.now()}.docx`;
  saveAs(blob, fileName);
}

export async function generateDocument(title: string, content: string, type: 'pdf' | 'docx'): Promise<void> {
  if (type === 'pdf') {
    await generatePDF(title, content);
  } else {
    await generateDocx(title, content);
  }
}

export function extractTitleFromContent(content: string): string {
  const lines = content.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      return headingMatch[1].replace(/\*\*/g, '').replace(/\*/g, '').trim();
    }
  }
  
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/\*\*/g, '').replace(/\*/g, '').trim();
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  }
  
  return 'Document';
}
