export type OrderPrintData = {
  customer: string;
  reference: string;
  delivery: string;
  lines: { quantity?: number; description: string; attention?: string[] }[];
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
  const logoResponse = options.format === "a4" ? await fetch("/STRIK_LOGO_2021_BW.png", { cache: "force-cache" }) : null;
  if (logoResponse && !logoResponse.ok) throw Error("Het Strik-logo kon niet worden geladen. Probeer het printvel opnieuw te maken.");
  const logo = logoResponse ? await pdf.embedPng(await logoResponse.arrayBuffer()) : null;
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
  // Keep content above the logo, with generous clearance for office printers.
  const contentBottom = height - 36 * mm;
  function a4Header(continued = false) {
    page();
    font(9, true); line(continued ? "VERDEELVEL · VERVOLG" : "VERDEELVEL", 22);
    font(38, true);
    const nameLines = wrap(data.customer);
    for (const text of nameLines) {
      if (y + 44 > contentBottom) { page(); font(38, true); }
      line(text, 44);
    }
    y += 10;
    font(15, true);
    for (const text of wrap(`Levering · ${data.delivery || "In overleg"}`)) line(text, 20);
    // Machine identifiers have no value on a crate. Human order numbers do.
    if (data.reference && !/^(?:folder-|b2b-)|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/i.test(data.reference)) {
      font(9); line(data.reference, 14);
    }
    y += 10;
    context.fillRect(margin, y, available, 1.5);
    y += 20;
  }
  function spaceFor(required: number) {
    if (y + required > contentBottom) a4Header(true);
  }
  function attentionLabels(description: string) {
    const labels: string[] = [];
    if (/\b(?:eigen logo|met logo|logo op)\b/i.test(description)) labels.push("EIGEN LOGO");
    for (const label of description.match(/\b(?:glutenvrij|notenvrij|lactosevrij|vegan|allergie|allergenen)\b/gi) || []) {
      const negated = new RegExp(`\\b(?:niet|geen|nooit)\\s+(?:[\\p{L}-]+\\s+){0,3}${label}\\b`, "iu").test(description);
      labels.push(negated ? "ALLERGIE / DIEET" : label.toLocaleUpperCase("nl-NL"));
    }
    return labels;
  }
  function attentionChips(labels: string[]) {
    let x = margin + 14;
    let rowStarted = false;
    for (const label of [...new Set(labels.map(value => value.toLocaleUpperCase("nl-NL")))]) {
      font(9, true);
      for (const text of wrap(label, available - 30)) {
        const chipWidth = context.measureText(text).width + 14;
        if (x + chipWidth > width - margin) { y += 24; x = margin + 14; rowStarted = false; }
        if (y + 20 > contentBottom) { a4Header(true); x = margin + 14; rowStarted = false; }
        font(9, true);
        context.fillStyle = "black";
        context.fillRect(x, y, chipWidth, 19);
        context.fillStyle = "white";
        context.fillText(text, x + 7, y + 5);
        context.fillStyle = "black";
        x += chipWidth + 6;
        rowStarted = true;
      }
    }
    if (rowStarted) y += 25;
  }
  function productRow(row: OrderPrintData["lines"][number]) {
    const descriptionX = margin + 14;
    const prefix = row.quantity === undefined ? "" : `${row.quantity.toLocaleString("nl-NL")} × `;
    font(15, true);
    const lines = wrap(`${prefix}${row.description}`, available - 14);
    const labels = [...(row.attention || []), ...attentionLabels(row.description)];
    // Move ordinary rows as a unit. Extra-long descriptions can continue safely.
    spaceFor(Math.min(lines.length * 21 + (labels.length ? 27 : 0) + 18, 140));
    for (const [index, text] of lines.entries()) {
      spaceFor(21);
      font(15, index === 0);
      if (index === 0) {
        context.beginPath(); context.arc(margin + 3, y + 8, 2.4, 0, Math.PI * 2); context.fill();
      }
      line(text, 21, descriptionX);
    }
    if (labels.length) { y += 5; attentionChips(labels); }
    y += 10;
    context.fillStyle = "#d5d5d5"; context.fillRect(margin, y, available, .5);
    context.fillStyle = "black"; y += 13;
  }
  const productAttention = new Set(data.lines.flatMap(row => [...(row.attention || []), ...attentionLabels(row.description)]).map(value => value.toLocaleUpperCase("nl-NL")));
  function note(value: string) {
    const labels = attentionLabels(value).filter(label => !productAttention.has(label));
    if (labels.length) attentionChips(labels);
    font(11);
    for (const text of wrap(value, available - 14)) {
      spaceFor(16); font(11); line(text, 16, margin + 14);
    }
    y += 8;
  }
  if (options.format === "a4") {
    a4Header();
    for (const row of data.lines) productRow(row);
    if (data.notes.length) {
      spaceFor(55); y += 8; font(9, true); line("AFSPRAKEN", 20);
      for (const value of data.notes) note(value);
    }
    for (let i = 0; i < canvases.length; i++) {
      const footer = canvases[i].getContext("2d")!;
      footer.font = "9px Arial, sans-serif";
      footer.fillStyle = "black";
      footer.textAlign = "right";
      if (canvases.length > 1) footer.fillText(`${i + 1} / ${canvases.length}`, width - margin, height - 12 * mm);
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
    for (const image of pages) {
      const sheet = pdf.addPage([width, height]);
      sheet.drawImage(image, { x: 0, y: 0, width, height });
      if (logo) {
        const logoSize = 23 * mm;
        sheet.drawImage(logo, { x: (width - logoSize) / 2, y: 8 * mm, width: logoSize, height: logoSize });
      }
    }
  }
  pdf.setTitle(`${data.customer} · ${options.format === "a4" ? "Verdeelvel" : "Omdoosetiket"}`);
  pdf.setCreator("STRAK Gepland");
  pdf.catalog.set(PDFName.of("ViewerPreferences"), pdf.context.obj({ PrintScaling: PDFName.of("None") }));
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
