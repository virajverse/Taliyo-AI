"use client";
// Use dynamic imports inside handlers so build succeeds even if deps aren't installed yet.

export default function ExportMenu({ content = "", fileName = "taliyo-output" }) {
  async function exportPDF() {
    let jsPDF;
    try {
      ({ jsPDF } = await import("jspdf"));
    } catch (e) {
      alert("PDF export requires 'jspdf'. Please install: npm install jspdf");
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const maxWidth = 515; // page width - margins
    const lines = doc.splitTextToSize(content, maxWidth);
    let y = margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    lines.forEach((line) => {
      if (y > 800) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 18;
    });
    doc.save(`${fileName}.pdf`);
  }

  async function exportDocx() {
    let Document, Packer, Paragraph, TextRun;
    try {
      ({ Document, Packer, Paragraph, TextRun } = await import("docx"));
    } catch (e) {
      alert("DOCX export requires 'docx'. Please install: npm install docx");
      return;
    }
    const paragraphs = String(content || "").split("\n\n").map((p) =>
      new Paragraph({ children: [ new TextRun({ text: p, size: 24 }) ] })
    );
    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button className="btn-glass px-3 py-1.5 text-xs" onClick={exportPDF}>Export PDF</button>
      <button className="btn-glass px-3 py-1.5 text-xs" onClick={exportDocx}>Export DOCX</button>
    </div>
  );
}
