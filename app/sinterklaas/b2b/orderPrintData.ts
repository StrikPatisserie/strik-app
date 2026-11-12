import { BUSINESS_PICKUP_LOCATIONS } from "../../lib/businessPickupLocations";
import { b2bLetterHasLogo, b2bLetterLineLabel } from "../b2bLetterLines";
import type { B2BLetterLine, SinterklaasB2BOrder } from "../types";
import { letterGroupMatchesOrder, parseLetterGroup } from "./groupedLetterOrders";
import type { OrderPrintData, OrderPrintLine } from "./orderPrint";

type ParsedPrintOrder = {
  delivery: string;
  productLines: { productId: string; quantity: number; description: string }[];
  otherText: string;
};

type PrintEntry = { row: OrderPrintLine; letter?: B2BLetterLine };
const individualGiftWrap = "Alles apart in cadeaupapier verpakken.";
const normalize = (value: string) => value.toLocaleLowerCase("nl-NL").replace(/\s+/g, " ").trim();

function instructionText(value: string) {
  return value
    .replace(/\s*\(€\s*[\d.,]+\s+incl\. btw per letter\)/gi, "")
    .replace(/^inclusief cadeaupapier\b/i, "Apart in cadeaupapier")
    .trim();
}

function instructionEntry(entries: PrintEntry[], quantity: number, description: string) {
  const letter = description.match(/\b(spuitletter|vormletter) ([A-Z]) (klein|groot)\s*·\s*(melk|puur|wit)\b/i);
  const matches = entries.filter(entry => {
    if (entry.row.quantity !== quantity) return false;
    if (!letter || !entry.letter) return normalize(entry.row.description) === normalize(description);
    const source = entry.letter;
    const exceptions = ["notenvrij", "vegan", "glutenvrij", "lactosevrij"]
      .filter(exception => description.toLocaleLowerCase("nl-NL").split(/ · |,\s*/).includes(exception));
    return source.letter === letter[2].toUpperCase()
      && source.style === (letter[1].toLowerCase() === "spuitletter" ? "spuit" : "vorm")
      && source.size === letter[3].toLowerCase()
      && source.chocolate === letter[4].toLowerCase()
      && source.withLogo === /\beigen logo\b/i.test(description)
      && source.exceptions.length === exceptions.length
      && source.exceptions.every(exception => exceptions.includes(exception));
  });
  return matches.length === 1 ? matches[0] : null;
}

function orderLocation(order: SinterklaasB2BOrder): OrderPrintData["location"] {
  const method = order.deliveryMethod.trim();
  if (/afhal|afhaal|ophal|halen/i.test(method)) {
    const location = BUSINESS_PICKUP_LOCATIONS.find(item => {
      const name = item.label.split(" · ")[0];
      return normalize(method).includes(item.id) || normalize(method).includes(normalize(name));
    });
    return { label: "Afhaaladres", address: location?.label || method };
  }
  if (order.deliveryAddress.trim() || /bezorg|lever|brengen/i.test(method)) {
    return { label: "Bezorgadres", address: order.deliveryAddress.trim() || "Adres nog afspreken" };
  }
  return method ? { label: "Levering", address: method } : undefined;
}

export function buildB2BOrderPrintData(order: SinterklaasB2BOrder, parsed: ParsedPrintOrder): OrderPrintData {
  const group = parseLetterGroup(order.letterOrderText);
  const groupMatches = group && letterGroupMatchesOrder(group, order);
  const entries: PrintEntry[] = parsed.productLines
    .filter(line => !order.letterLines.length || !["chocoladeletter", "chocolade-vormletter"].includes(line.productId))
    .map(line => ({ row: { quantity: line.quantity, description: line.description } }));

  if (groupMatches) {
    for (const company of group.rows) {
      const quantity = company.melk + company.wit + company.puur;
      if (!quantity) continue;
      const flavours = (["melk", "wit", "puur"] as const)
        .filter(flavour => company[flavour] > 0)
        .map(flavour => `${company[flavour]} ${flavour} Q`);
      entries.push({ row: {
        quantity,
        description: `${company.company} · grote vormletters · ${flavours.join(" · ")}`,
        attention: company.withLogo ? ["EIGEN LOGO"] : [],
      } });
    }
  } else {
    for (const original of order.letterLines) {
      const letter = { ...original, withLogo: b2bLetterHasLogo(order, original) };
      entries.push({ letter, row: {
        quantity: letter.quantity,
        description: b2bLetterLineLabel(letter).replace(/^\d+× /, ""),
        attention: [...letter.exceptions, ...(letter.withLogo ? ["EIGEN LOGO"] : [])],
      } });
    }
  }

  const hasStructuredRows = entries.length > 0;
  if (!hasStructuredRows && order.orderText.trim()) entries.push({ row: { description: order.orderText } });
  const notes: string[] = [];
  for (const raw of (hasStructuredRows ? parsed.otherText : "").split(/\r?\n/)) {
    const text = raw.trim();
    if (!text || /^(?:PRODUCTEN EN PRIJS|OVERIGE ORDERAFSPRAKEN)$/.test(text)) continue;
    const detail = text.match(/^Bij\s+(\d+)\s*[×x]\s+(.+?):\s*(.+)$/i);
    const entry = detail && instructionEntry(entries, Number(detail[1]), detail[2]);
    if (entry) {
      entry.row.instructions = [...(entry.row.instructions || []), instructionText(detail[3])];
    } else notes.push(text);
  }

  for (const text of order.packaging.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
    if (text === individualGiftWrap || /^Per stuk in cadeaupapier\b/i.test(text)) {
      for (const entry of entries) {
        entry.row.instructions = [...(entry.row.instructions || []), text === individualGiftWrap ? "Apart in cadeaupapier" : text];
      }
    } else if (text !== "Verpakking aangevraagd; zie aanvraag voor inhoud en cadeaupapier."
      || !entries.some(entry => entry.row.instructions?.length)) {
      notes.push(text);
    }
  }
  if (group && !groupMatches) notes.push("Controleer de verdeling per bedrijf bij deze bestelling.");
  const logoOnRows = entries.some(entry => entry.row.attention?.includes("EIGEN LOGO") || /\beigen logo\b/i.test(entry.row.description));
  const generatedLogoNote = order.logo === "Eigen logo aangevraagd; bestand en uitvoering nog afstemmen.";
  if (order.logo.trim() && (!generatedLogoNote || !logoOnRows)) notes.push(order.logo);
  if (order.textInstructions.trim()) notes.push(order.textInstructions);

  return {
    customer: order.customerName,
    reference: order.id,
    delivery: parsed.delivery,
    location: orderLocation(order),
    lines: entries.map(entry => ({ ...entry.row, instructions: [...new Set(entry.row.instructions || [])] })),
    notes: [...new Set(notes)],
  };
}
