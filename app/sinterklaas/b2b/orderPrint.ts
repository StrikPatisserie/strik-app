export type OrderPrintData = {
  customer: string;
  reference: string;
  delivery: string;
  lines: { quantity?: number; description: string }[];
  notes: string[];
};
export type OrderPrintOptions = { format: "a4" | "zebra"; copies: number; products: boolean };
export const PRINT_SIZES = { a4: { width: 210, height: 297 }, zebra: { width: 76, height: 51 } } as const;
const mm = 72 / 25.4;

export function validatePrintOptions(options: OrderPrintOptions) {
  if (!options || !(Object.hasOwn(PRINT_SIZES, options.format)) || !Number.isInteger(options.copies) || options.copies < 1 || options.copies > 100 || typeof options.products !== "boolean") {
    throw Error("Kies een afdrukformaat en 1 tot 100 exemplaren.");
  }
}

/** Canvas preserves company names and symbols beyond the standard PDF fonts.
 * Physical page sizes are set separately in points, at 300 dpi for thermal print. */
export async function createOrderPrint(data: OrderPrintData, options: OrderPrintOptions) {
  validatePrintOptions(options);
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const size = PRINT_SIZES[options.format];
  const width = size.width * mm, height = size.height * mm;
  const scale = 300 / 72;
  const canvases: HTMLCanvasElement[] = [];
  let context!: CanvasRenderingContext2D;
  let y = 0;
  const margin = (options.format === "a4" ? 12 : 3) * mm;
  const available = width - margin * 2;
  function page() {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
    context = canvas.getContext("2d")!;
    if (!context) throw Error("Dit apparaat kan het printvel niet maken.");
    context.scale(scale, scale); context.fillStyle = "white"; context.fillRect(0, 0, width, height);
    context.fillStyle = "black"; context.textBaseline = "top";
    canvases.push(canvas); y = margin;
  }
  function font(size: number, bold = false) { context.font = `${bold ? 700 : 400} ${size}px Arial, sans-serif`; }
  function wrap(value: string, maxWidth = available) {
    const result: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && context.measureText(`${line} ${word}`).width > maxWidth) { result.push(line); line = ""; }
        if (context.measureText(word).width > maxWidth) {
          for (const character of Array.from(word)) {
            if (line && context.measureText(line + character).width > maxWidth) { result.push(line); line = ""; }
            line += character;
          }
        } else line += `${line ? " " : ""}${word}`;
      }
      result.push(line);
    }
    return result;
  }
  function line(text: string, leading: number, x = margin) { context.fillText(text, x, y); y += leading; }
  function a4Header(continued = false) {
    page(); font(10); line("STRAK GEPLAND", 22);
    font(30, true);
    for (const text of wrap(data.customer)) {
      if (y > height - 100 * mm) { page(); font(30, true); }
      line(text, 34);
    }
    y += 8; font(10);
    for (const text of wrap([data.delivery, data.reference, continued ? "Vervolg" : ""].filter(Boolean).join(" · "))) line(text, 15);
    y += 8; context.fillRect(margin, y, available, 1); y += 16;
  }
  function a4Text(value: string, bold = false) {
    font(12, bold);
    for (const text of wrap(value)) {
      if (y + 17 > height - 18 * mm) { a4Header(true); font(12, bold); }
      line(text, 17);
    }
    y += 7;
  }
  if (options.format === "a4") {
    a4Header();
    for (const row of data.lines) a4Text(`${row.quantity === undefined ? "" : `${row.quantity.toLocaleString("nl-NL")} × `}${row.description}`);
    if (data.notes.length) { y += 6; for (const note of data.notes) a4Text(note); }
    for (let i = 0; i < canvases.length; i++) {
      const footer = canvases[i].getContext("2d")!;
      footer.font = "9px Arial, sans-serif";
      footer.fillText(`${i + 1} / ${canvases.length}`, margin, height - 11 * mm);
    }
  } else {
    page();
    let nameSize = 14;
    font(nameSize, true);
    while (wrap(data.customer).length * nameSize * 1.1 > 18 * mm && nameSize > 7) font(--nameSize, true);
    if (wrap(data.customer).length * nameSize * 1.1 > 18 * mm) throw Error("De klantnaam past niet leesbaar op dit etiket. Gebruik het A4-verdeelvel.");
    for (const text of wrap(data.customer)) line(text, nameSize * 1.1);
    y += 3; font(7);
    // The customer heading is complete. Only the order summary may be shortened.
    const summary = [data.delivery, options.products ? data.lines.map(row => `${row.quantity === undefined ? "" : `${row.quantity}× `}${row.description}`).join(" · ") : ""].filter(Boolean).join(" · ");
    const room = Math.max(0, Math.floor((25 * mm - y) / 9));
    const summaryLines = wrap(summary);
    for (const [index, text] of summaryLines.slice(0, room).entries()) {
      let value = text;
      if (index === room - 1 && summaryLines.length > room) {
        while (context.measureText(`${value}…`).width > available) value = value.slice(0, -1);
        value += "…";
      }
      line(value, 9);
    }
    y = Math.max(y + 4, 27 * mm); font(9, true); line("IN DEZE OMDOOS", 15);
    context.lineWidth = 0.4; context.strokeStyle = "#777";
    for (const position of [38, 45]) { context.beginPath(); context.moveTo(margin, position * mm); context.lineTo(width - margin, position * mm); context.stroke(); }
  }
  const pages = [];
  for (const canvas of canvases) {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error("PDF maken is mislukt.")), "image/png"));
    pages.push(await pdf.embedPng(await blob.arrayBuffer()));
  }
  for (let copy = 0; copy < options.copies; copy++) {
    for (const image of pages) pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  pdf.setTitle(`${data.customer} · ${options.format === "a4" ? "Verdeelvel" : "Omdoosetiket"}`);
  pdf.setCreator("STRAK Gepland");
  pdf.catalog.set(PDFName.of("ViewerPreferences"), pdf.context.obj({ PrintScaling: PDFName.of("None") }));
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
