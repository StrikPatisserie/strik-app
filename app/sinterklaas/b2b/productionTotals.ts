import { editableFolderOrderText } from "../../lib/businessFolderOrderText";
import { businessDeliveryWindow } from "../../lib/businessOrderDeliveries";
import { orderBelongsToSeason, type BusinessSeason } from "../../lib/businessSeasons";
import type { SinterklaasB2BOrder } from "../types";

export type ProductionAllocation = { orderId: string; customer: string; quantity: number; date: string; end: string };
export type ProductionTotal = { key: string; product: string; quantity: number; unit: "stuks" | "zakjes"; allocations: ProductionAllocation[] };
export type ProductionTotals = { products: ProductionTotal[]; orderCount: number; skippedLetters: number; issues: { orderId: string; customer: string; message: string }[] };
type Component = { product: string; quantity: number; unit: ProductionTotal["unit"] };
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function components(description: string, quantity: number): Component[] {
  const name = clean(description.replace(/ · eigen logo$/i, ""));
  // Letter size/print does not change the brok. Keep almond variants apart.
  const brok = name.match(/^Speculaasbrok met letter · Speculaasbrok (zonder|met) amandel · (?:kleine|grote) spuitletter(?: · letter [A-Z])?$/i);
  if (brok) return [{ product: `Speculaasbrok · ${brok[1].toLowerCase()} amandel`, quantity, unit: "stuks" }];
  if (/^Strik DUO · /i.test(name)) {
    const choices = name.replace(/^Strik DUO · /i, "").split(" + ");
    // A DUO contains one bag of each chosen variant, including two equal bags.
    const known = new Set(["Chocolade kruidnoten · ca. 250 g", "Naturel kruidnoten · ca. 200 g", "Speculaasbites · ca. 200 g", "Gesorteerde Sint-chocolade · ca. 200 g", "Marsepein aardappeltjes · ca. 275 g", "Speculaasbrokstukken · ca. ⅔ brok", "Roomborstplaat · ca. 8 rondjes"]);
    if (choices.length === 2 && choices.every(choice => known.has(choice))) return choices.map(product => ({ product, quantity, unit: "zakjes" }));
  }
  // Other order rows are added as ordered. Never invent a recipe or silently
  // merge different sizes, flavors, portion weights or custom package contents.
  return [{ product: name, quantity, unit: "stuks" }];
}

export function productionTotalDate(allocation: Pick<ProductionAllocation, "date" | "end">) {
  if (!allocation.date) return "Datum nog afspreken";
  const format = (date: string) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }).format(new Date(`${date}T12:00:00Z`));
  return allocation.end && allocation.end !== allocation.date ? `${format(allocation.date)} t/m ${format(allocation.end)}` : format(allocation.date);
}

export function buildProductionTotals(orders: SinterklaasB2BOrder[], season: BusinessSeason, year: string): ProductionTotals {
  const eligible = orders.filter(order => order.year === year && orderBelongsToSeason(order, season) && order.status === "akkoord" && !order.cancelled && !order.productionDone && !order.packed && !order.delivered && !order.id.startsWith("historie-"));
  const products = new Map<string, ProductionTotal>();
  const issues: ProductionTotals["issues"] = [];
  let skippedLetters = 0;
  for (const order of eligible) {
    const converted = editableFolderOrderText(order.orderText) || order.orderText.replace(/\r\n?/g, "\n");
    const structured = converted.startsWith("PRODUCTEN EN PRIJS\n");
    if (!structured && order.letterLines.length && /^\d+ grote chocolade (vorm|spuit)letters?\b/i.test(converted.trim())) { skippedLetters += order.letterLines.reduce((total, line) => total + line.quantity, 0); continue; }
    const rows = (structured ? converted.split("\nOVERIGE ORDERAFSPRAKEN")[0].replace(/^PRODUCTEN EN PRIJS\n/, "") : converted).split("\n").map(row => row.trim()).filter(Boolean);
    let recognized = false;
    for (const row of rows) {
      const match = row.match(/^(\d+)\s*[×x]\s*(.+?)(?: · €\s*[\d.,]+ p\.s\. ex btw.*)?$/);
      if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) {
        if (!issues.some(issue => issue.orderId === order.id)) issues.push({ orderId: order.id, customer: order.customerName, message: "Niet alle productregels konden worden opgeteld; controleer de bestelling." });
        continue;
      }
      const quantity = Number(match[1]), description = match[2];
      recognized = true;
      if (/^(?:Bezorgkosten|Bezorgtoeslag|Verzendkosten)\b/i.test(description)) continue;
      if (/^Chocolade (?:spuitletters|vormletters?)\b/i.test(description)) { skippedLetters += quantity; continue; }
      const window = businessDeliveryWindow(order as unknown as Record<string, unknown>);
      for (const component of components(description, quantity)) {
        const key = JSON.stringify([component.product.toLocaleLowerCase("nl-NL"), component.unit]);
        const group = products.get(key) || { key, product: component.product, quantity: 0, unit: component.unit, allocations: [] };
        group.quantity += component.quantity;
        const allocation = group.allocations.find(item => item.orderId === order.id);
        if (allocation) allocation.quantity += component.quantity;
        else group.allocations.push({ orderId: order.id, customer: order.customerName, quantity: component.quantity, date: window?.start || "", end: window?.end || "" });
        products.set(key, group);
      }
    }
    if (!recognized && !issues.some(issue => issue.orderId === order.id)) issues.push({ orderId: order.id, customer: order.customerName, message: "Productaantallen nog controleren in de bestelling." });
  }
  return { orderCount: eligible.length, skippedLetters, issues, products: [...products.values()].map(group => ({ ...group, allocations: group.allocations.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.customer.localeCompare(b.customer, "nl")) })).sort((a, b) => a.product.localeCompare(b.product, "nl")) };
}

export function productionTotalsText(totals: ProductionTotals) {
  return [...totals.products.map(group => [`${group.quantity} ${group.unit} ${group.product}`, ...group.allocations.map(item => `  ${item.quantity} · ${productionTotalDate(item)} · ${item.customer}`)].join("\n")), ...(totals.issues.length ? [`Nog controleren:\n${totals.issues.map(issue => `${issue.customer}: ${issue.message}`).join("\n")}`] : [])].join("\n\n");
}
