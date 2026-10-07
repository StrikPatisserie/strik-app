import "server-only";

import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import type {
  AllergenKey,
  PriceCard,
  PriceCardPrintSession,
} from "../management/prijskaartjes/priceCardTypes";

const CARD_WIDTH_MM = 85;
const CARD_HEIGHT_MM = 55;
const POINTS_PER_MM = 72 / 25.4;
const PDF_WIDTH = CARD_WIDTH_MM * POINTS_PER_MM;
const PDF_HEIGHT = CARD_HEIGHT_MM * POINTS_PER_MM;
const PIXEL_WIDTH = 1004;
const PIXEL_HEIGHT = 650;

const ALLERGEN_X: Record<AllergenKey, number> = {
  selderij: 0,
  vis: 102,
  schaaldier: 205,
  mosterd: 307,
  sulfiet: 409,
  weekdier: 511,
  lupine: 613,
  pinda: 715,
  soja: 817,
  noten: 919,
  sesam: 1021,
  lactose: 1123,
  gluten: 1225,
  alcohol: 1327,
  ei: 1429,
  vegetarisch: 1614,
};

let fontsReady = false;

function publicAsset(...parts: string[]) {
  return path.join(process.cwd(), "public", ...parts);
}

function registerFonts() {
  if (fontsReady) return;
  GlobalFonts.registerFromPath(publicAsset("fonts", "GothamLight.otf"), "StrikGothamLight");
  GlobalFonts.registerFromPath(publicAsset("fonts", "Gotham Bold.otf"), "StrikGothamBold");
  GlobalFonts.registerFromPath(publicAsset("fonts", "GothamBlack.otf"), "StrikGothamBlack");
  fontsReady = true;
}

function roundedRect(
  context: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function wrappedLines(context: SKRSContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || context.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitLines(input: {
  context: SKRSContext2D;
  text: string;
  maxWidth: number;
  maxLines: number;
  startSize: number;
  minSize: number;
  family: string;
}) {
  for (let size = input.startSize; size >= input.minSize; size -= 2) {
    input.context.font = `${size}px "${input.family}"`;
    const lines = wrappedLines(input.context, input.text, input.maxWidth);
    if (
      lines.length <= input.maxLines &&
      lines.every((line) => input.context.measureText(line).width <= input.maxWidth)
    ) {
      return { lines, size };
    }
  }
  input.context.font = `${input.minSize}px "${input.family}"`;
  return {
    lines: wrappedLines(input.context, input.text, input.maxWidth).slice(0, input.maxLines),
    size: input.minSize,
  };
}

function drawCenteredLines(
  context: SKRSContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  size: number,
  lineHeight: number
) {
  lines.forEach((line, index) => {
    context.fillText(line, centerX, startY + index * size * lineHeight);
  });
}

function formatPrice(priceCents: number) {
  const safe = Math.max(0, Math.round(priceCents));
  return {
    euros: Math.floor(safe / 100).toLocaleString("nl-NL"),
    cents: String(safe % 100).padStart(2, "0"),
  };
}

async function renderCard(card: PriceCard) {
  registerFonts();
  const canvas = createCanvas(PIXEL_WIDTH, PIXEL_HEIGHT);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PIXEL_WIDTH, PIXEL_HEIGHT);

  context.strokeStyle = "#161616";
  context.lineWidth = 10;
  roundedRect(context, 7, 7, PIXEL_WIDTH - 14, PIXEL_HEIGHT - 14, 34);
  context.stroke();

  const logoPromise = loadImage(publicAsset("STRIK_LOGO_2021_BW.png"));
  const allergenPromise = card.allergens.length
    ? loadImage(publicAsset("allergenen-icons.png"))
    : Promise.resolve(null);
  const themePromise = card.theme === "geen"
    ? Promise.resolve(null)
    : loadImage(
        card.theme === "sint"
          ? publicAsset("APP_icons_strik_SINT.svg")
          : publicAsset("evaluation-icons", "kerst.svg")
      );
  const [logo, allergenSprite, themeIcon] = await Promise.all([
    logoPromise,
    allergenPromise,
    themePromise,
  ]);

  if (themeIcon) {
    if (card.theme === "kerst") {
      context.fillStyle = "#ffffff";
      context.strokeStyle = "#161616";
      context.lineWidth = 7;
      context.beginPath();
      context.arc(88, 84, 70, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.drawImage(themeIcon, 43, 39, 90, 90);
    } else {
      context.drawImage(themeIcon, 17, 10, 145, 165);
    }
  }

  const titleLeft = card.theme === "geen" ? 72 : 155;
  const titleRight = 930;
  const titleCenter = (titleLeft + titleRight) / 2;
  const title = fitLines({
    context,
    text: card.name.toLocaleUpperCase("nl-NL"),
    maxWidth: titleRight - titleLeft,
    maxLines: 3,
    startSize: card.name.length <= 12 ? 88 : 76,
    minSize: 44,
    family: "StrikGothamBlack",
  });
  const description = card.description
    ? fitLines({
        context,
        text: card.description,
        maxWidth: 760,
        maxLines: 3,
        startSize: card.description.length <= 65 ? 39 : 34,
        minSize: 26,
        family: "StrikGothamLight",
      })
    : { lines: [] as string[], size: 0 };
  const titleHeight = title.lines.length * title.size * 0.94;
  const descriptionHeight = description.lines.length * description.size * 1.12;
  const copyHeight = titleHeight + (description.lines.length ? 28 + descriptionHeight : 0);
  const copyTop = Math.max(140, 330 - copyHeight / 2);

  context.fillStyle = "#161616";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = `${title.size}px "StrikGothamBlack"`;
  drawCenteredLines(context, title.lines, titleCenter, copyTop, title.size, 0.94);

  if (description.lines.length) {
    context.font = `${description.size}px "StrikGothamLight"`;
    drawCenteredLines(
      context,
      description.lines,
      545,
      copyTop + titleHeight + 28,
      description.size,
      1.12
    );
  }

  context.fillStyle = "#161616";
  roundedRect(context, 2, 493, 330, 155, 22);
  context.fill();
  context.fillRect(2, 555, 330, 93);
  context.fillRect(2, 493, 70, 155);

  const price = formatPrice(card.priceCents);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (card.pricePrefix) {
    context.font = '24px "StrikGothamBold"';
    context.fillText(card.pricePrefix.toLocaleUpperCase("nl-NL"), 166, 520);
  }
  context.font = '80px "StrikGothamBlack"';
  context.fillText(`€ ${price.euros}`, 150, card.pricePrefix ? 578 : 568);
  const wholeWidth = context.measureText(`€ ${price.euros}`).width;
  context.font = '38px "StrikGothamBlack"';
  context.textAlign = "left";
  context.fillText(`,${price.cents}`, 150 + wholeWidth / 2 + 4, card.pricePrefix ? 558 : 548);

  if (allergenSprite && card.allergens.length) {
    const shown = card.allergens.slice(0, 8);
    const iconSize = Math.min(66, 360 / shown.length);
    const gap = 5;
    const totalWidth = shown.length * iconSize + (shown.length - 1) * gap;
    let x = 370 + Math.max(0, (390 - totalWidth) / 2);
    for (const allergen of shown) {
      context.drawImage(
        allergenSprite,
        ALLERGEN_X[allergen],
        0,
        88,
        107,
        x,
        548,
        iconSize,
        iconSize
      );
      x += iconSize + gap;
    }
  }

  context.drawImage(logo, 842, 522, 120, 120);
  return canvas.toBuffer("image/png");
}

export function priceCardPdfFilename(session: PriceCardPrintSession) {
  const day = new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date()).replace(/-/g, "");
  const safeName = session.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `prijskaartjes-${day}${safeName ? `-${safeName}` : ""}.pdf`;
}

export async function createPriceCardPdf(session: PriceCardPrintSession) {
  const document = await PDFDocument.create();
  document.setTitle(session.name);
  document.setAuthor("Strik Patisserie");
  document.setSubject("Evolis Zenius prijskaartjes 85 x 55 mm");
  document.setCreator("Strik Team app");

  for (const item of session.items) {
    const png = await renderCard(item.card);
    const embedded = await document.embedPng(png);
    for (let copy = 0; copy < item.quantity; copy += 1) {
      const page = document.addPage([PDF_WIDTH, PDF_HEIGHT]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: PDF_WIDTH,
        height: PDF_HEIGHT,
      });
    }
  }

  return Buffer.from(await document.save({ useObjectStreams: true }));
}
