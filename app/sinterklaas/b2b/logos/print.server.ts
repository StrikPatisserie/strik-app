import "server-only";
import { PDFDocument, PrintScaling, type PDFImage, type PDFEmbeddedPage } from "pdf-lib";
import { createCanvas, loadImage, DOMMatrix, ImageData, Path2D, type SKRSContext2D } from "@napi-rs/canvas";
import { logoPrintLayout, type PrintLogo } from "./model";
import { packedLogoPrintLayout } from "./packedLayout";

type FileLogo = { id: string; name?: string; customer?: string; summary?: string; printSummary?: string; content_type: string; bytes_base64: string };
const cm = 72 / 2.54;

async function logoThumbnail(file: FileLogo, bytes: Buffer) {
  let preview = bytes;
  if (file.content_type === "application/pdf") {
    const globals = globalThis as unknown as Record<string, unknown>;
    globals.DOMMatrix ||= DOMMatrix;
    globals.ImageData ||= ImageData;
    globals.Path2D ||= Path2D;
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      const result = await parser.getScreenshot({ first: 1, desiredWidth: 200, imageBuffer: true, imageDataUrl: false });
      if (!result.pages[0]) throw Error("Geen logovoorbeeld beschikbaar.");
      preview = Buffer.from(result.pages[0].data);
    } finally {
      await parser.destroy();
    }
  }
  const image = await loadImage(preview);
  if (image.width * image.height > 25000000) throw Error("Afbeelding te groot.");
  const canvas = createCanvas(160, 160);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 160, 160);
  const scale = Math.min(160 / image.width, 160 / image.height);
  context.drawImage(image, (160 - image.width * scale) / 2, (160 - image.height * scale) / 2, image.width * scale, image.height * scale);
  const pixels = context.getImageData(0, 0, 160, 160);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const gray = Math.round(.299 * pixels.data[offset] + .587 * pixels.data[offset + 1] + .114 * pixels.data[offset + 2]);
    pixels.data[offset] = gray;
    pixels.data[offset + 1] = gray;
    pixels.data[offset + 2] = gray;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toBuffer("image/png");
}

async function printHeader(customer: string, file: FileLogo, thumbnail: Buffer) {
  const canvas = createCanvas(1600, 120);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(await loadImage(thumbnail), 0, 2, 100, 100);
  context.fillStyle = "#111";
  const title = (file.customer || customer).replace(/\s+/g, " ").trim();
  let size = 44;
  do {
    context.font = `bold ${size}px sans-serif`;
    if (context.measureText(title).width <= 1450) break;
    size--;
  } while (size > 14);
  context.fillText(title, 125, 52);
  context.font = "22px sans-serif";
  const subtitle = file.summary || file.name || "Logo";
  const words = subtitle.split(/\s+/);
  let line = "";
  let baseline = 82;
  for (let index = 0; index < words.length; index++) {
    const next = `${line} ${words[index]}`.trim();
    if (context.measureText(next).width > 1450 && line) {
      context.fillText(line, 125, baseline);
      baseline += 24;
      line = words[index];
      if (baseline > 106) break;
    } else line = next;
    if (baseline === 106 && index < words.length - 1 && context.measureText(`${line} ${words[index + 1]}…`).width > 1450) {
      line += "…";
      break;
    }
  }
  if (baseline <= 106) context.fillText(line, 125, baseline, 1450);
  context.fillRect(0, 115, 1600, 2);
  return canvas.toBuffer("image/png");
}

function headerLines(context: SKRSContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function packedPrintHeader(customer: string, file: FileLogo, thumbnail: Buffer, widthCm: number, heightCm: number) {
  const pixelsPerCm = 120;
  const canvas = createCanvas(Math.round(widthCm * pixelsPerCm), Math.round(heightCm * pixelsPerCm));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const thumbnailSize = 48;
  context.drawImage(await loadImage(thumbnail), 0, 5, thumbnailSize, thumbnailSize);
  const textX = thumbnailSize + 10;
  const textWidth = canvas.width - textX - 4;
  const title = (file.customer || customer).replace(/\s+/g, " ").trim();
  let titleSize = 30;
  let titleLines: string[];
  do {
    context.font = `bold ${titleSize}px sans-serif`;
    titleLines = headerLines(context, title, textWidth);
    if (titleLines.length <= 2) break;
    titleSize--;
  } while (titleSize > 24);
  context.fillStyle = "#111";
  let baseline = titleSize + 2;
  for (const line of titleLines.slice(0, 3)) {
    context.fillText(line, textX, baseline, textWidth);
    baseline += titleSize + 2;
  }
  context.font = "24px sans-serif";
  const summary = file.printSummary || file.summary || file.name || "Logo";
  const lines = headerLines(context, summary, canvas.width - 4);
  const availableLines = Math.max(1, Math.floor((canvas.height - 6 - baseline - 23) / 26) + 1);
  for (let index = 0; index < Math.min(lines.length, availableLines); index++) {
    let line = lines[index];
    if (index === availableLines - 1 && lines.length > availableLines) line += "…";
    context.fillText(line, 0, baseline + 23, canvas.width - 4);
    baseline += 26;
  }
  context.fillStyle = "#aaa";
  context.fillRect(0, canvas.height - 3, canvas.width, 1);
  return canvas.toBuffer("image/png");
}

export async function createLogoPrint(items: PrintLogo[], files: FileLogo[], customer: string, options: { packGroups?: boolean } = {}) {
  if (!customer?.trim()) throw Error("De klantnaam kon niet worden geladen. Vernieuw de bestelling.");
  const packed = options.packGroups ? packedLogoPrintLayout(items) : null;
  const layout = packed?.cells || logoPrintLayout(items);
  const pdf = await PDFDocument.create();
  const images = new Map<string, PDFImage | PDFEmbeddedPage>();
  const headers = new Map<string, PDFImage>();
  const thumbnails = new Map<string, Buffer>();
  for (const id of new Set(layout.map(cell => cell.id))) {
    const file = files.find(file => file.id === id);
    if (!file) throw Error("Een gekozen logo is niet meer beschikbaar. Vernieuw de lijst.");
    const bytes = Buffer.from(file.bytes_base64, "base64");
    try {
      const thumbnail = await logoThumbnail(file, bytes);
      if (packed) thumbnails.set(id, thumbnail);
      else headers.set(id, await pdf.embedPng(await printHeader(customer, file, thumbnail)));
      if (file.content_type === "application/pdf") {
        const source = await PDFDocument.load(bytes);
        if (!source.getPageCount()) throw Error("Lege PDF.");
        images.set(id, await pdf.embedPage(source.getPage(0)));
      } else if (file.content_type === "image/jpeg") {
        images.set(id, await pdf.embedJpg(bytes));
      } else if (file.content_type === "image/png") {
        images.set(id, await pdf.embedPng(bytes));
      } else if (file.content_type === "image/webp") {
        const image = await loadImage(bytes);
        const canvas = createCanvas(image.width, image.height);
        canvas.getContext("2d").drawImage(image, 0, 0);
        images.set(id, await pdf.embedPng(canvas.toBuffer("image/png")));
      } else throw Error("Onbekend formaat.");
    } catch {
      throw Error("Een logo kan niet worden verwerkt. Gebruik een geldige PNG, JPG, WebP of een onbeveiligde PDF.");
    }
  }
  for (const cell of layout) {
    if (pdf.getPageCount() <= cell.page) {
      const page = pdf.addPage();
      page.setSize(21 * cm, 29.7 * cm);
      if (!packed) page.drawImage(headers.get(cell.id)!, { x: .5 * cm, y: (29.7 - .5 - 1.5) * cm, width: 20 * cm, height: 1.5 * cm });
    }
    const page = pdf.getPage(cell.page);
    const image = images.get(cell.id)!;
    const scale = Math.min(cell.width * cm / image.width, cell.height * cm / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const options = {
      x: cell.x * cm + (cell.width * cm - width) / 2,
      y: (29.7 - cell.y - cell.height) * cm + (cell.height * cm - height) / 2,
      width,
      height,
    };
    if (files.find(file => file.id === cell.id)?.content_type === "application/pdf") page.drawPage(image as PDFEmbeddedPage, options);
    else page.drawImage(image as PDFImage, options);
  }
  for (const header of packed?.headers || []) {
    const key = `${header.id}:${header.width}`;
    let image = headers.get(key);
    if (!image) {
      const file = files.find(file => file.id === header.id)!;
      image = await pdf.embedPng(await packedPrintHeader(customer, file, thumbnails.get(header.id)!, header.width, header.height));
      headers.set(key, image);
    }
    pdf.getPage(header.page).drawImage(image, { x: header.x * cm, y: (29.7 - header.y - header.height) * cm,
      width: header.width * cm, height: header.height * cm });
  }
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  pdf.setTitle(`${customer} · logo printvel`);
  pdf.setCreator("Strik Team app");
  return pdf.save();
}
