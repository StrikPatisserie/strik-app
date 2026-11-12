import "server-only";
import { PDFDocument, PrintScaling, type PDFImage, type PDFEmbeddedPage } from "pdf-lib";
import { createCanvas, loadImage, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { logoPrintLayout, type PrintLogo } from "./model";

type FileLogo = { id: string; name?: string; content_type: string; bytes_base64: string };
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
  const title = customer.replace(/\s+/g, " ").trim();
  let size = 44;
  do {
    context.font = `bold ${size}px sans-serif`;
    if (context.measureText(title).width <= 1450) break;
    size--;
  } while (size > 14);
  context.fillText(title, 125, 52);
  context.font = "22px sans-serif";
  context.fillText(file.name || "Logo", 125, 86, 1450);
  context.fillRect(0, 115, 1600, 2);
  return canvas.toBuffer("image/png");
}

export async function createLogoPrint(items: PrintLogo[], files: FileLogo[], customer: string) {
  if (!customer?.trim()) throw Error("De klantnaam kon niet worden geladen. Vernieuw de bestelling.");
  const layout = logoPrintLayout(items);
  const pdf = await PDFDocument.create();
  const images = new Map<string, PDFImage | PDFEmbeddedPage>();
  const headers = new Map<string, PDFImage>();
  for (const id of new Set(layout.map(cell => cell.id))) {
    const file = files.find(file => file.id === id);
    if (!file) throw Error("Een gekozen logo is niet meer beschikbaar. Vernieuw de lijst.");
    const bytes = Buffer.from(file.bytes_base64, "base64");
    try {
      const thumbnail = await logoThumbnail(file, bytes);
      headers.set(id, await pdf.embedPng(await printHeader(customer, file, thumbnail)));
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
      page.drawImage(headers.get(cell.id)!, { x: .5 * cm, y: (29.7 - .5 - 1.5) * cm, width: 20 * cm, height: 1.5 * cm });
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
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  pdf.setTitle(`${customer} · logo printvel`);
  pdf.setCreator("Strik Team app");
  return pdf.save();
}
