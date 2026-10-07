import "server-only";

import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import type {
  PriceCard,
  PriceCardPrintSession,
} from "../management/prijskaartjes/priceCardTypes";

const CARD_WIDTH_MM = 85;
const CARD_HEIGHT_MM = 55;
const POINTS_PER_MM = 72 / 25.4;
const PDF_WIDTH = CARD_WIDTH_MM * POINTS_PER_MM;
const PDF_HEIGHT = CARD_HEIGHT_MM * POINTS_PER_MM;
const BREAD_PDF_WIDTH = CARD_HEIGHT_MM * POINTS_PER_MM;
const BREAD_PDF_HEIGHT = CARD_WIDTH_MM * POINTS_PER_MM;
const PIXEL_WIDTH = 1004;
const PIXEL_HEIGHT = 650;
const BREAD_PIXEL_WIDTH = PIXEL_HEIGHT;
const BREAD_PIXEL_HEIGHT = PIXEL_WIDTH;

let fontsReady = false;

function publicAsset(...parts: string[]) {
  return path.join(process.cwd(), "public", ...parts);
}

function registerFonts() {
  if (fontsReady) return;
  GlobalFonts.registerFromPath(publicAsset("fonts", "GothamLight.otf"), "StrikGothamLight");
  GlobalFonts.registerFromPath(publicAsset("fonts", "Gotham Bold.otf"), "StrikGothamBold");
  GlobalFonts.registerFromPath(publicAsset("fonts", "GothamBlack.otf"), "StrikGothamBlack");
  GlobalFonts.registerFromPath(publicAsset("fonts", "GothamCondensed-Book.otf"), "StrikGothamCondensedBook");
  GlobalFonts.registerFromPath(publicAsset("fonts", "GothamCondensed-Bold.otf"), "StrikGothamCondensedBold");
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
  lineHeight: number;
  maxHeight: number;
}) {
  for (let size = input.startSize; size >= input.minSize; size -= 2) {
    input.context.font = `${size}px "${input.family}"`;
    const lines = wrappedLines(input.context, input.text, input.maxWidth);
    if (
      lines.length <= input.maxLines &&
      lines.every((line) => input.context.measureText(line).width <= input.maxWidth) &&
      lines.length * size * input.lineHeight <= input.maxHeight
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

  const logoPromise = loadImage(publicAsset("STRIK_LOGO_2021_BW.png"));
  const shownAllergens = card.allergens.slice(0, 8);
  const allergenPromise = Promise.all(
    shownAllergens.map((allergen) =>
      loadImage(publicAsset("allergens", `${allergen}.svg`))
    )
  );
  const themePromise = card.theme === "geen"
    ? Promise.resolve(null)
    : loadImage(
        card.theme === "sint"
          ? publicAsset("APP_icons_strik_SINT.svg")
          : publicAsset("evaluation-icons", "kerst.svg")
      );
  const [logo, allergenIcons, themeIcon] = await Promise.all([
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

  const titleLeft = card.theme === "geen" ? 62 : 178;
  const titleRight = 942;
  const titleCenter = (titleLeft + titleRight) / 2;
  const title = fitLines({
    context,
    text: card.name.toLocaleUpperCase("nl-NL"),
    maxWidth: titleRight - titleLeft,
    maxLines: 1,
    startSize: 155,
    minSize: 34,
    family: "StrikGothamBlack",
    lineHeight: 0.91,
    maxHeight: card.description ? 125 : 190,
  });
  const description = card.description
      ? fitLines({
        context,
        text: card.description,
        maxWidth: 900,
        maxLines: 3,
        startSize: 70,
        minSize: 22,
        family: "StrikGothamLight",
        lineHeight: 1.08,
        maxHeight: 150,
      })
    : { lines: [] as string[], size: 0 };
  const titleHeight = title.lines.length * title.size * 0.94;
  const descriptionHeight = description.lines.length * description.size * 1.08;
  const copyHeight = titleHeight + (description.lines.length ? 26 + descriptionHeight : 0);
  const copyTop = Math.max(72, 235 - copyHeight / 2);

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
      1.08
    );
  }

  const priceOptions = card.priceOptions.slice(0, 3);
  if (priceOptions.length >= 2) {
    const labelStartSize = priceOptions.length === 2 ? 27 : 23;
    const valueSize = priceOptions.length === 2 ? 46 : 39;
    const centsSize = priceOptions.length === 2 ? 25 : 21;
    const euroSize = priceOptions.length === 2 ? 27 : 23;
    const rowGap = 26;
    const paddingX = 22;
    const rows = priceOptions.map((option) => {
      const label = option.label.toLocaleUpperCase("nl-NL");
      let labelSize = labelStartSize;
      context.font = `${labelSize}px "StrikGothamBold"`;
      while (labelSize > 16 && context.measureText(label).width > 240) {
        labelSize -= 1;
        context.font = `${labelSize}px "StrikGothamBold"`;
      }
      const labelWidth = context.measureText(label).width;
      const formatted = formatPrice(option.priceCents);
      const whole = formatted.euros;
      const cents = `,${formatted.cents}`;
      context.font = `700 ${euroSize}px Arial`;
      const euroWidth = context.measureText("€").width;
      context.font = `${valueSize}px "StrikGothamBlack"`;
      const wholeWidth = context.measureText(whole).width;
      context.font = `${centsSize}px "StrikGothamBlack"`;
      const centsWidth = context.measureText(cents).width;
      const valueWidth = wholeWidth + centsWidth - 2;
      return {
        label,
        labelSize,
        labelWidth,
        whole,
        cents,
        euroWidth,
        wholeWidth,
        valueWidth,
      };
    });
    const priceBlockWidth = Math.min(
      480,
      Math.max(
        315,
        Math.ceil(Math.max(...rows.map((row) =>
          paddingX * 2 + row.labelWidth + rowGap + row.euroWidth + 6 + row.valueWidth
        )))
      )
    );

    context.fillStyle = "#161616";
    roundedRect(context, 2, 493, priceBlockWidth, 155, 22);
    context.fill();
    context.fillRect(2, 555, priceBlockWidth, 93);
    context.fillRect(2, 493, 70, 155);

    const rowHeight = priceOptions.length === 2 ? 58 : 46;
    const rowsHeight = rowHeight * rows.length;
    const firstCenterY = 493 + (155 - rowsHeight) / 2 + rowHeight / 2;
    context.fillStyle = "#ffffff";
    context.textBaseline = "middle";
    rows.forEach((row, index) => {
      const centerY = firstCenterY + index * rowHeight;
      context.textAlign = "left";
      context.font = `${row.labelSize}px "StrikGothamBold"`;
      context.fillText(row.label, paddingX, centerY);
      const valueLeft = priceBlockWidth - paddingX - row.valueWidth;
      const euroLeft = valueLeft - row.euroWidth - 6;
      context.font = `700 ${euroSize}px Arial`;
      context.fillText("€", euroLeft, centerY + 1);
      context.font = `${valueSize}px "StrikGothamBlack"`;
      context.fillText(row.whole, valueLeft, centerY);
      context.font = `${centsSize}px "StrikGothamBlack"`;
      context.fillText(row.cents, valueLeft + row.wholeWidth - 2, centerY - valueSize * 0.2);
    });
  } else {
    const price = formatPrice(card.priceCents);
    const mainPrice = `€ ${price.euros}`;
    const centsPrice = `,${price.cents}`;
    const priceLeft = 22;
    context.font = '80px "StrikGothamBlack"';
    const mainPriceWidth = context.measureText(mainPrice).width;
    context.font = '38px "StrikGothamBlack"';
    const centsPriceWidth = context.measureText(centsPrice).width;
    const priceBlockWidth = Math.max(
      235,
      Math.ceil(priceLeft + mainPriceWidth + 4 + centsPriceWidth + 20)
    );

    context.fillStyle = "#161616";
    roundedRect(context, 2, 493, priceBlockWidth, 155, 22);
    context.fill();
    context.fillRect(2, 555, priceBlockWidth, 93);
    context.fillRect(2, 493, 70, 155);

    context.fillStyle = "#ffffff";
    context.textBaseline = "middle";
    if (card.pricePrefix) {
      context.font = '28px "StrikGothamBold"';
      context.textAlign = "center";
      context.fillText(
        card.pricePrefix.toLocaleUpperCase("nl-NL"),
        priceBlockWidth / 2,
        514
      );
    }
    context.font = '80px "StrikGothamBlack"';
    context.textAlign = "left";
    context.fillText(mainPrice, priceLeft, card.pricePrefix ? 590 : 568);
    context.font = '38px "StrikGothamBlack"';
    context.fillText(
      centsPrice,
      priceLeft + mainPriceWidth + 4,
      card.pricePrefix ? 570 : 548
    );
  }

  if (allergenIcons.length) {
    const groupWidth = 860;
    const gap = 6;
    const slotWidth = Math.min(
      100,
      (groupWidth - (allergenIcons.length - 1) * gap) / allergenIcons.length
    );
    const circleSize = Math.min(92, slotWidth - 4);
    const totalWidth = allergenIcons.length * slotWidth + (allergenIcons.length - 1) * gap;
    const startX = (PIXEL_WIDTH - totalWidth) / 2;
    const circleY = 398;

    allergenIcons.forEach((icon, index) => {
      const x = startX + index * (slotWidth + gap);
      const centerX = x + slotWidth / 2;
      context.strokeStyle = "#161616";
      context.lineWidth = 4;
      context.beginPath();
      context.arc(centerX, circleY + circleSize / 2, circleSize / 2, 0, Math.PI * 2);
      context.stroke();

      const symbolSize = circleSize * 0.64;
      context.drawImage(
        icon,
        centerX - symbolSize / 2,
        circleY + (circleSize - symbolSize) / 2,
        symbolSize,
        symbolSize
      );
    });
  }

  context.drawImage(logo, 842, 522, 120, 120);
  return canvas.toBuffer("image/png");
}

function drawBreadWordmark(context: SKRSContext2D, y: number) {
  const label = "STRIK PATISSERIE";
  context.fillStyle = "#161616";
  context.font = '27px "StrikGothamCondensedBook"';
  context.textAlign = "left";
  context.textBaseline = "top";
  const labelWidth = context.measureText(label).width;
  const gap = 21;
  const startX = (BREAD_PIXEL_WIDTH - labelWidth * 3 - gap * 2) / 2;
  for (let index = 0; index < 3; index += 1) {
    context.fillText(label, startX + index * (labelWidth + gap), y);
  }
}

async function renderBreadCard(card: PriceCard) {
  registerFonts();
  const canvas = createCanvas(BREAD_PIXEL_WIDTH, BREAD_PIXEL_HEIGHT);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, BREAD_PIXEL_WIDTH, BREAD_PIXEL_HEIGHT);

  drawBreadWordmark(context, 17);
  drawBreadWordmark(context, 963);

  const title = fitLines({
    context,
    text: card.name.toLocaleUpperCase("nl-NL"),
    maxWidth: 560,
    maxLines: 3,
    startSize: 92,
    minSize: 38,
    family: "StrikGothamBlack",
    lineHeight: 0.85,
    maxHeight: 170,
  });
  const description = card.description
    ? fitLines({
        context,
        text: card.description,
        maxWidth: 560,
        maxLines: 4,
        startSize: 55,
        minSize: 27,
        family: "StrikGothamCondensedBook",
        lineHeight: 0.98,
        maxHeight: 145,
      })
    : { lines: [] as string[], size: 0 };
  const legalName = card.legalName
    ? fitLines({
        context,
        text: card.legalName.toLocaleUpperCase("nl-NL"),
        maxWidth: 560,
        maxLines: 2,
        startSize: 52,
        minSize: 25,
        family: "StrikGothamLight",
        lineHeight: 1,
        maxHeight: 82,
      })
    : { lines: [] as string[], size: 0 };
  const titleHeight = title.lines.length * title.size * 0.85;
  const prefixHeight = card.pricePrefix ? 54 : 0;
  const legalNameHeight = legalName.lines.length * legalName.size;
  const descriptionHeight = description.lines.length * description.size * 0.98;
  const sectionCount = [legalNameHeight, prefixHeight, descriptionHeight].filter(Boolean).length;
  const copyGap = sectionCount ? 14 : 0;
  const totalCopyHeight =
    titleHeight + legalNameHeight + prefixHeight + descriptionHeight + sectionCount * copyGap;
  const copyTop = Math.max(66, 300 - totalCopyHeight / 2);

  context.fillStyle = "#161616";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = `${title.size}px "StrikGothamBlack"`;
  drawCenteredLines(context, title.lines, BREAD_PIXEL_WIDTH / 2, copyTop, title.size, 0.85);

  let nextY = copyTop + titleHeight;
  if (legalName.lines.length) {
    nextY += copyGap;
    context.font = `${legalName.size}px "StrikGothamLight"`;
    drawCenteredLines(
      context,
      legalName.lines,
      BREAD_PIXEL_WIDTH / 2,
      nextY,
      legalName.size,
      1
    );
    nextY += legalNameHeight;
  }
  if (card.pricePrefix) {
    nextY += copyGap;
    context.font = '43px "StrikGothamCondensedBook"';
    context.fillText(card.pricePrefix, BREAD_PIXEL_WIDTH / 2, nextY);
    nextY += prefixHeight;
  }
  if (description.lines.length) {
    nextY += copyGap;
    context.font = `${description.size}px "StrikGothamCondensedBook"`;
    drawCenteredLines(
      context,
      description.lines,
      BREAD_PIXEL_WIDTH / 2,
      nextY,
      description.size,
      0.98
    );
  }

  const priceOptions = card.priceOptions.slice(0, 3);
  if (priceOptions.length >= 2) {
    const left = 76;
    const right = BREAD_PIXEL_WIDTH - 76;
    const top = 570;
    const rowHeight = priceOptions.length === 2 ? 108 : 78;
    context.strokeStyle = "#161616";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(right, top);
    context.stroke();

    priceOptions.forEach((option, index) => {
      const rowTop = top + index * rowHeight;
      const formatted = formatPrice(option.priceCents);
      context.fillStyle = "#161616";
      context.textBaseline = "middle";
      context.textAlign = "left";
      context.font = `${priceOptions.length === 2 ? 43 : 36}px "StrikGothamCondensedBook"`;
      context.fillText(option.label, left + 8, rowTop + rowHeight / 2);
      const wholeSize = priceOptions.length === 2 ? 76 : 58;
      const centsSize = priceOptions.length === 2 ? 37 : 29;
      const cents = `,${formatted.cents}`;
      context.font = `${wholeSize}px "StrikGothamCondensedBold"`;
      const wholeWidth = context.measureText(formatted.euros).width;
      context.font = `${centsSize}px "StrikGothamCondensedBold"`;
      const centsWidth = context.measureText(cents).width;
      const valueLeft = right - 8 - wholeWidth - centsWidth + 3;
      context.textAlign = "left";
      context.font = `${wholeSize}px "StrikGothamCondensedBold"`;
      context.fillText(formatted.euros, valueLeft, rowTop + rowHeight / 2);
      context.font = `${centsSize}px "StrikGothamCondensedBold"`;
      context.fillText(
        cents,
        valueLeft + wholeWidth - 3,
        rowTop + rowHeight / 2 - wholeSize * 0.22
      );
      context.beginPath();
      context.moveTo(left, rowTop + rowHeight);
      context.lineTo(right, rowTop + rowHeight);
      context.stroke();
    });
  } else {
    const price = formatPrice(card.priceCents);
    const cents = `,${price.cents}`;
    context.textBaseline = "top";
    context.font = '320px "StrikGothamBlack"';
    const wholeWidth = context.measureText(price.euros).width;
    context.font = '134px "StrikGothamBlack"';
    const centsWidth = context.measureText(cents).width;
    const combinedWidth = wholeWidth + centsWidth - 13;
    const startX = (BREAD_PIXEL_WIDTH - combinedWidth) / 2;
    context.fillStyle = "#161616";
    context.textAlign = "left";
    context.font = '320px "StrikGothamBlack"';
    context.fillText(price.euros, startX, 545);
    context.font = '134px "StrikGothamBlack"';
    context.fillText(cents, startX + wholeWidth - 13, 566);
  }

  context.fillStyle = "#161616";
  roundedRect(context, 139, 832, 372, 5, 3);
  context.fill();

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
  document.setSubject("Evolis Zenius prijskaartjes 85 x 55 mm en broodkaartjes 55 x 85 mm");
  document.setCreator("Strik Team app");

  for (const item of session.items) {
    const isBread = item.card.category === "brood";
    const png = isBread ? await renderBreadCard(item.card) : await renderCard(item.card);
    const embedded = await document.embedPng(png);
    for (let copy = 0; copy < item.quantity; copy += 1) {
      const pageWidth = isBread ? BREAD_PDF_WIDTH : PDF_WIDTH;
      const pageHeight = isBread ? BREAD_PDF_HEIGHT : PDF_HEIGHT;
      const page = document.addPage([pageWidth, pageHeight]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }
  }

  return Buffer.from(await document.save({ useObjectStreams: true }));
}
