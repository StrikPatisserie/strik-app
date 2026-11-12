export type OrderPrintLine = {
  quantity?: number;
  description: string;
  attention?: string[];
  instructions?: string[];
};
export type OrderPrintData = {
  customer: string;
  reference: string;
  delivery: string;
  location?: { label: string; address: string };
  lines: OrderPrintLine[];
  notes: string[];
};
export type OrderPrintOptions = { format: "a4" | "zebra"; copies: number; products: boolean };
export const PRINT_SIZES = { a4: { width: 210, height: 297 }, zebra: { width: 76, height: 51 } } as const;
const mm = 72 / 25.4;

export function validatePrintOptions(options: OrderPrintOptions) {
  if (!options || !Object.hasOwn(PRINT_SIZES, options.format) || !Number.isInteger(options.copies)
    || options.copies < 1 || options.copies > 100 || typeof options.products !== "boolean") {
    throw Error("Kies een afdrukformaat en 1 tot 100 exemplaren.");
  }
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

function lineAttention(row: OrderPrintLine) {
  return [...new Set([...(row.attention || []), ...attentionLabels(row.description)]
    .map(label => label.toLocaleUpperCase("nl-NL")))];
}

function productDescription(row: OrderPrintLine) {
  const labels = lineAttention(row);
  // Move complete exception phrases to the adjacent column without changing
  // qualified instructions such as "niet glutenvrij".
  return row.description.split(" · ").filter(part => {
    const words = part.split(/,\s*/).map(word => word.toLocaleUpperCase("nl-NL"));
    return !words.every(word => labels.includes(word));
  }).join(" · ");
}

/** Canvas preserves company names and symbols beyond the standard PDF fonts.
 * Physical page sizes are set separately in points, at 300 dpi for thermal print. */
export async function createOrderPrint(data: OrderPrintData, options: OrderPrintOptions) {
  validatePrintOptions(options);
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const size = PRINT_SIZES[options.format];
  const width = size.width * mm;
  const height = size.height * mm;
  const scale = 300 / 72;
  const margin = (options.format === "a4" ? 12 : 3) * mm;
  const available = width - margin * 2;
  const topMargin = margin + (options.format === "a4" ? 10 * mm : 0);
  const logoResponse = options.format === "a4" ? await fetch("/STRIK_LOGO_2021_BW.png", { cache: "force-cache" }) : null;
  if (logoResponse && !logoResponse.ok) throw Error("Het Strik-logo kon niet worden geladen. Probeer het printvel opnieuw te maken.");
  const logo = logoResponse ? await pdf.embedPng(await logoResponse.arrayBuffer()) : null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw Error("Dit apparaat kan het printvel niet maken.");
  context.scale(scale, scale);
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "black";
  context.textBaseline = "top";
  let y = topMargin;

  function font(size: number, bold = false) {
    context!.font = `${bold ? 700 : 400} ${size}px Arial, sans-serif`;
  }
  function wrap(value: string, maxWidth = available) {
    const result: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && context!.measureText(`${line} ${word}`).width > maxWidth) {
          result.push(line);
          line = "";
        }
        if (context!.measureText(word).width > maxWidth) {
          for (const character of Array.from(word)) {
            if (line && context!.measureText(line + character).width > maxWidth) {
              result.push(line);
              line = "";
            }
            line += character;
          }
        } else line += `${line ? " " : ""}${word}`;
      }
      result.push(line);
    }
    return result;
  }
  function line(text: string, leading: number, x = margin) {
    context!.fillText(text, x, y);
    y += leading;
  }

  if (options.format === "a4") {
    let nameSize = 34;
    font(nameSize, true);
    while (wrap(data.customer).length > 2 && nameSize > 20) font(--nameSize, true);
    for (const text of wrap(data.customer)) line(text, nameSize * 1.15);
    y += 8;
    font(13, true);
    for (const text of wrap(`Levering · ${data.delivery || "In overleg"}`)) line(text, 17);
    if (data.reference && !/^(?:folder-|b2b-)|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/i.test(data.reference)) {
      font(8);
      line(data.reference, 12);
    }
    y += 10;
    const blockTop = y;

    let addressFontSize = 11;
    font(addressFontSize);
    let addressLines = data.location ? wrap(data.location.address) : [];
    while (addressLines.length * addressFontSize * 1.25 > 70 * mm) {
      addressFontSize *= .9;
      font(addressFontSize);
      addressLines = wrap(data.location!.address);
    }
    const addressLeading = addressFontSize * 1.25;
    const addressHeight = data.location ? 14 + addressLines.length * addressLeading : 0;
    const addressTop = height - 36 * mm - addressHeight;
    const bodySpace = addressTop - blockTop - 14;
    const productLabels = new Set(data.lines.flatMap(lineAttention));
    const hasRowDetails = data.lines.some(row => lineAttention(row).length || row.instructions?.some(Boolean));
    const notes = [...new Set(data.notes.map(note => note.trim()).filter(Boolean))];

    // Measuring and drawing share one layout, so the full order fits on one
    // A4 page per copy, including its exceptions and delivery address.
    function orderBlock(fontSize: number, draw: boolean) {
      const padding = fontSize * .35;
      const leading = fontSize * 1.2;
      const quantityWidth = fontSize * 3.4;
      const detailWidth = hasRowDetails ? available * .35 : 0;
      const descriptionX = margin + quantityWidth + padding;
      const detailX = width - margin - detailWidth;
      const descriptionWidth = detailX - descriptionX - padding * 2;
      const headerHeight = fontSize * 2;
      let cursor = blockTop + headerHeight;
      if (draw) {
        context!.fillStyle = "#eeeeee";
        context!.fillRect(margin, blockTop, available, headerHeight);
        context!.fillStyle = "black";
        font(fontSize * .64, true);
        context!.fillText("AANTAL", margin + padding, blockTop + padding);
        context!.fillText("BESTELLING", descriptionX, blockTop + padding);
        if (hasRowDetails) context!.fillText("BIJZONDERHEDEN / VERPAKKING", detailX + padding, blockTop + padding);
      }
      for (const row of data.lines) {
        font(fontSize, true);
        const description = wrap(productDescription(row), descriptionWidth);
        const labels = lineAttention(row);
        const chips: { text: string; x: number; y: number; width: number }[] = [];
        let chipX = 0;
        let chipY = 0;
        const chipHeight = fontSize * 1.15;
        font(fontSize * .67, true);
        for (const label of labels) {
          for (const text of wrap(label, detailWidth - padding * 4)) {
            const chipWidth = context!.measureText(text).width + padding * 2;
            if (chipX && chipX + chipWidth > detailWidth - padding * 2) {
              chipX = 0;
              chipY += chipHeight + fontSize * .3;
            }
            chips.push({ text, x: chipX, y: chipY, width: chipWidth });
            chipX += chipWidth + fontSize * .3;
          }
        }
        const chipSpace = chips.length ? chipY + chipHeight + fontSize * .25 : 0;
        font(fontSize * .85);
        const instructions = [...new Set(row.instructions || [])]
          .flatMap(instruction => wrap(instruction, detailWidth - padding * 2));
        const instructionLeading = fontSize;
        const rowHeight = Math.max(description.length * leading, chipSpace + instructions.length * instructionLeading) + padding * 2;
        if (draw) {
          context!.fillStyle = "black";
          font(fontSize, true);
          if (row.quantity !== undefined) {
            context!.fillText(`${row.quantity.toLocaleString("nl-NL")}×`, margin + padding, cursor + padding);
          }
          description.forEach((text, index) => context!.fillText(text, descriptionX, cursor + padding + index * leading));
          for (const chip of chips) {
            context!.fillStyle = "black";
            context!.fillRect(detailX + padding + chip.x, cursor + padding + chip.y, chip.width, chipHeight);
            context!.fillStyle = "white";
            font(fontSize * .67, true);
            context!.fillText(chip.text, detailX + padding * 2 + chip.x, cursor + padding + chip.y + fontSize * .25);
          }
          context!.fillStyle = "black";
          font(fontSize * .85);
          instructions.forEach((text, index) => context!.fillText(text, detailX + padding, cursor + padding + chipSpace + index * instructionLeading));
          context!.fillStyle = "#cccccc";
          context!.fillRect(margin, cursor + rowHeight, available, .5);
          context!.fillStyle = "black";
        }
        cursor += rowHeight;
      }
      if (draw) {
        context!.strokeStyle = "#bbbbbb";
        context!.lineWidth = .6;
        context!.strokeRect(margin, blockTop, available, cursor - blockTop);
      }
      if (notes.length) cursor += padding * 2;
      for (const note of notes) {
        font(fontSize * .8);
        const textLines = wrap(note, available - padding * 2);
        const labels = attentionLabels(note).filter(label => !productLabels.has(label));
        if (labels.length) {
          if (draw) {
            font(fontSize * .72, true);
            context!.fillText(labels.join(" · "), margin + padding, cursor);
          }
          cursor += leading;
        }
        if (draw) {
          font(fontSize * .8);
          textLines.forEach((text, index) => context!.fillText(text, margin + padding, cursor + index * leading));
        }
        cursor += textLines.length * leading + padding;
      }
      return cursor - blockTop;
    }
    let bodyFontSize = 11.5;
    if (orderBlock(bodyFontSize, false) > bodySpace) {
      let minimum = 0;
      let maximum = bodyFontSize;
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = (minimum + maximum) / 2;
        if (orderBlock(candidate, false) <= bodySpace) minimum = candidate;
        else maximum = candidate;
      }
      bodyFontSize = minimum;
    }
    orderBlock(bodyFontSize, true);

    if (data.location) {
      y = addressTop;
      context.fillRect(margin, y - 8, available, .7);
      font(8, true);
      line(data.location.label.toLocaleUpperCase("nl-NL"), 14);
      font(addressFontSize);
      for (const text of addressLines) line(text, addressLeading);
    }
  } else {
    let nameSize = 14;
    font(nameSize, true);
    while (wrap(data.customer).length * nameSize * 1.1 > 18 * mm && nameSize > 7) font(--nameSize, true);
    if (wrap(data.customer).length * nameSize * 1.1 > 18 * mm) throw Error("De klantnaam past niet leesbaar op dit etiket. Gebruik het A4-verdeelvel.");
    for (const text of wrap(data.customer)) line(text, nameSize * 1.1);
    y += 3;
    font(7);
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
    y = Math.max(y + 4, 27 * mm);
    font(9, true);
    line("IN DEZE OMDOOS", 15);
    context.lineWidth = .4;
    context.strokeStyle = "#777";
    for (const position of [38, 45]) {
      context.beginPath();
      context.moveTo(margin, position * mm);
      context.lineTo(width - margin, position * mm);
      context.stroke();
    }
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(Error("PDF maken is mislukt.")), "image/png",
  ));
  const image = await pdf.embedPng(await blob.arrayBuffer());
  for (let copy = 0; copy < options.copies; copy++) {
    const sheet = pdf.addPage([width, height]);
    sheet.drawImage(image, { x: 0, y: 0, width, height });
    if (logo) {
      const logoSize = 23 * mm;
      sheet.drawImage(logo, { x: (width - logoSize) / 2, y: 8 * mm, width: logoSize, height: logoSize });
    }
  }
  pdf.setTitle(`${data.customer} · ${options.format === "a4" ? "Verdeelvel" : "Omdoosetiket"}`);
  pdf.setCreator("STRAK Gepland");
  pdf.catalog.set(PDFName.of("ViewerPreferences"), pdf.context.obj({ PrintScaling: PDFName.of("None") }));
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
