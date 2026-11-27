import { distributionDateLabel, type DistributionDay, type DistributionOptions, type DistributionRow } from "./distributionList";

const mm = 72 / 25.4;
const width = 210 * mm, height = 297 * mm, margin = 9 * mm;
const available = width - 2 * margin;
const columns = [available * .035, available * .175, available * .565, available * .225];
const top = margin + 43, bottom = height - margin - 18;
type TextLine = { text: string; bold: boolean; size: number };
type Block = { row: DistributionRow; cells: TextLine[][]; height: number };

/** One measured A4 per delivery day. Stop instead of clipping/losing instructions. */
export async function createDistributionPdf(days: DistributionDay[], options: DistributionOptions) {
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const canvas = document.createElement("canvas"), scale = 3;
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Het printvoorbeeld kon niet worden gemaakt. Probeer opnieuw.");
  ctx.scale(scale, scale); ctx.textBaseline = "top";
  const font = (size: number, bold: boolean) => { ctx.font = `${bold ? 700 : 400} ${size}px Arial, sans-serif`; };
  function wrap(text: string, maxWidth: number, size: number, bold = false): TextLine[] {
    font(size, bold);
    const lines: TextLine[] = [];
    let line = "";
    const push = () => { if (line) lines.push({ text: line, bold, size }); line = ""; };
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (line && ctx!.measureText(`${line} ${word}`).width > maxWidth) push();
      if (ctx!.measureText(word).width > maxWidth) {
        for (const char of word) { if (line && ctx!.measureText(line + char).width > maxWidth) push(); line += char; }
      } else line += `${line ? " " : ""}${word}`;
    }
    push(); return lines;
  }
  function customerLines(text: string, maxWidth: number, size: number) {
    // Keep long company-name words intact whenever a slightly smaller name fits.
    let nameSize = size;
    while (nameSize > 7.5) {
      font(nameSize, true);
      if (text.split(/\s+/).every(word => ctx!.measureText(word).width <= maxWidth)) break;
      nameSize = Math.max(7.5, nameSize - .25);
    }
    return wrap(text, maxWidth, nameSize, true);
  }
  const previews: string[] = [], layout: { date: string; fontSize: number; count: number }[] = [];
  for (const [index, day] of days.entries()) {
    function measure(size: number): Block[] {
      return day.rows.map(row => {
        const cells = [[], customerLines(row.customer, columns[1] - 8, size + .6),
          [...row.products.flatMap(product => wrap(product, columns[2] - 9, size, true)), ...wrap(row.notes.join(" • "), columns[2] - 9, size - .3)],
          [...wrap(row.locationLabel, columns[3] - 5, size, true), ...wrap(row.address, columns[3] - 5, size - .3)]];
        const cellHeight = (cell: TextLine[], i: number) => cell.reduce((sum, line) => sum + line.size * 1.16, 0) + (i === 1 && row.logo ? 14 : 0);
        return { row, cells, height: Math.max(18, ...cells.map(cellHeight)) + 9 };
      });
    }
    let size = 10.5, blocks = measure(size);
    while (blocks.reduce((sum, block) => sum + block.height, 0) > bottom - top && size > 7.5) {
      size = Math.max(7.5, size - .25); blocks = measure(size);
    }
    if (blocks.reduce((sum, block) => sum + block.height, 0) > bottom - top) {
      throw Error(`${distributionDateLabel(day.date)} past met ${day.rows.length} bestellingen niet leesbaar op één A4. Kort lange orderafspraken in of gebruik het werkoverzicht. Er is niets weggelaten.`);
    }
    layout.push({ date: day.date, fontSize: size, count: day.rows.length });
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, height); ctx.fillStyle = "black";
    font(22, true); ctx.fillText(distributionDateLabel(day.date), margin, margin);
    const subtitle = `${day.date.slice(0, 4)} · ${day.rows.length} bestellingen`;
    font(9, false); ctx.fillText(subtitle, width - margin - ctx.measureText(subtitle).width, margin + 8);
    function rule(y: number) { ctx!.strokeStyle = "black"; ctx!.lineWidth = .7; ctx!.beginPath(); ctx!.moveTo(margin, y); ctx!.lineTo(width - margin, y); ctx!.stroke(); }
    rule(top - 5);
    let y = top;
    for (const block of blocks) {
      ctx.lineWidth = .9; ctx.strokeRect(margin + 1, y + 5, 12, 12);
      let x = margin;
      block.cells.forEach((cell, i) => {
        let lineY = y + 4;
        for (const line of cell) { font(line.size, line.bold); ctx!.fillText(line.text, x + (i ? 4 : 0), lineY); lineY += line.size * 1.16; }
        if (i === 1 && block.row.logo) {
          ctx!.lineWidth = .6; ctx!.strokeRect(x + 4, lineY + 2, 30, 10);
          font(6.5, true); ctx!.fillText("LOGO", x + 8, lineY + 3.5);
        }
        x += columns[i];
      });
      y += block.height; rule(y);
    }
    font(7, false);
    const stamp = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(options.generatedAt));
    ctx.fillText(`Strik · Verdeellijst · Vaste leverdagen · Opgehaald ${stamp}`, margin, height - margin - 6);
    const pageNumber = `${index + 1} / ${days.length}`;
    ctx.fillText(pageNumber, width - margin - ctx.measureText(pageNumber).width, height - margin - 6);
    const image = canvas.toDataURL("image/png"); previews.push(image);
    const artwork = await pdf.embedPng(image);
    pdf.addPage([width, height]).drawImage(artwork, { x: 0, y: 0, width, height });
  }
  pdf.setTitle(`Strik verdeellijst ${options.from} t-m ${options.to}`);
  pdf.setCreator("STRAK Gepland");
  pdf.catalog.set(PDFName.of("ViewerPreferences"), pdf.context.obj({ PrintScaling: PDFName.of("None") }));
  return { blob: new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" }), previews, pages: days.length, layout };
}
