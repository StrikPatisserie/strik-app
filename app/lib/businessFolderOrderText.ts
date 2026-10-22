// Older folder inquiries store their products as a two-line quotation instead
// of the editable B2B format. Convert only the known sections, preserving the
// quoted unit prices and all product-specific notes. The original inquiry
// remains available in folderQuote.quoteText.
const moneyValue = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));
const money = (value: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);

export function editableFolderOrderText(value: string): string | null {
  const text = value.replace(/\r\n?/g, "\n");
  if (!text.includes("BEDRIJF EN CONTACT\n")) return null;
  const start = text.search(/^(?:GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS|KERSTPAKKET OP MAAT)$/m);
  const end = text.indexOf("\nPRIJSINDICATIE\n", start);
  if (start < 0 || end < 0) return null;
  const rows = text.slice(start, end).split("\n");
  const products: string[] = [];
  const notes: string[] = [];
  let packageStart = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].trim();
    if (row === "KERSTPAKKET OP MAAT") { packageStart = i; break; }
    if (!row || /^(GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS)$/.test(row)) continue;
    const item = row.match(/^(\d+)\s*×\s*(.+)$/);
    const price = rows[i + 1]?.trim().match(/^€\s*([\d.,]+) p\.s\. excl\. btw · €\s*[\d.,]+ totaal excl\. btw(.*)$/);
    if (!item || !price) { notes.push(row); continue; }
    let description = item[2];
    // Christmas singles use parentheses around their variant.
    description = description.replace(/ \(([^()]*)\)$/, " · $1");
    const extras = price[2].split(" · ").map(part => part.trim()).filter(Boolean);
    if (extras.some(part => part === "inclusief eigen logo")) description += " · eigen logo";
    const otherExtras = extras.filter(part => part !== "inclusief eigen logo");
    if (otherExtras.length) notes.push(`Bij ${item[1]} × ${description}: ${otherExtras.join(" · ")}`);
    const unit = moneyValue(price[1]);
    if (!Number.isFinite(unit)) return null;
    products.push(`${item[1]} × ${description} · ${money(unit)} p.s. ex btw · ${money(Math.round(Number(item[1]) * unit * 100) / 100)}`);
    i++;
  }

  if (packageStart >= 0) {
    const packageRows = rows.slice(packageStart + 1).map(row => row.trim()).filter(Boolean);
    const amount = packageRows[0]?.match(/^(\d+) gelijke pakketten, met per pakket:$/);
    const priceIndex = packageRows.findIndex(row => row.startsWith("Per pakket:"));
    const price = packageRows[priceIndex]?.match(/^Per pakket: €\s*([\d.,]+) excl\. btw/);
    if (!amount || !price || priceIndex < 1) return null;
    const unit = moneyValue(price[1]);
    if (!Number.isFinite(unit)) return null;
    const contents = packageRows.slice(1, priceIndex).map(row => row.replace(/ · €\s*[\d.,]+ excl\. btw per pakket$/, ""));
    products.push(`${amount[1]} × Kerstpakket op maat · per pakket: ${contents.join("; ")} · ${money(unit)} p.s. ex btw · ${money(Math.round(Number(amount[1]) * unit * 100) / 100)}`);
    notes.push(...packageRows.slice(priceIndex + 1).filter(row => !row.startsWith("Pakkettotaal:")));
  }
  if (!products.length) return null;
  const wishes = text.match(/\nWENSEN\n([\s\S]*?)(?:\n\nVrijblijvende aanvraag;|$)/)?.[1]?.trim();
  if (wishes && wishes !== "Geen aanvullende wensen") notes.push(`Wensen uit aanvraag: ${wishes}`);
  return ["PRODUCTEN EN PRIJS", ...products, ...(notes.length ? ["OVERIGE ORDERAFSPRAKEN", ...notes] : [])].join("\n");
}
