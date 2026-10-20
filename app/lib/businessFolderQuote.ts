import { createHash } from "node:crypto";
import { christmasPackage, christmasProducts, christmasUnitPrice, money, roundMoney } from "@/app/kerst-voor-bedrijven/christmasProducts";
import { defaultProductChoice, pricedProduct, productChoiceCandidates, productChoiceLabel, productLogoPrice, products, productSupportsLogo, productUnitPrice, tierFor } from "@/app/sint-voor-bedrijven/sintProducts";
import { letterGiftWrapPrice } from "@/app/lib/letter-pricing";
import type { B2BLetterLine } from "@/app/sinterklaas/types";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Controleer de aanvraaggegevens.");
  return value as RecordValue;
}
function text(value: unknown, maximum: number, required = false) {
  if (value !== undefined && typeof value !== "string") throw new Error("Controleer de tekstvelden.");
  const result = (value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (result.length > maximum || (required && !result)) throw new Error("Controleer de verplichte velden en de lengte van de tekst.");
  return result;
}
function count(value: unknown, maximum = 9999, minimum = 1) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) throw new Error("Controleer de aantallen in je aanvraag.");
  return value;
}
function date(value: unknown) {
  const result = text(value, 10);
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(`${result}T12:00:00Z`).toISOString().slice(0, 10) !== result)) throw new Error("Kies een geldige leverdatum.");
  return result;
}
function quantities(value: unknown, maximum: number) {
  const source = record(value);
  const result: Record<string, number> = {};
  for (const id of Object.keys(source).sort()) {
    if (!christmasProducts.some(product => product.id === id)) throw new Error("Een kerstproduct is niet herkend. Vernieuw de folder.");
    const amount = count(source[id], maximum, 0);
    if (amount) result[id] = amount;
  }
  return result;
}

// Build the complete, immutable submission using the same catalog and prices
// as the folders. Publicly supplied names, prices and totals are never used.
export function buildBusinessFolderQuote(value: unknown) {
  const input = record(value);
  const requestId = text(input.requestId, 36, true).toLowerCase();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId)) throw new Error("Vernieuw de pagina en verstuur de aanvraag opnieuw.");
  if (input.season !== "sint" && input.season !== "kerst") throw new Error("Kies een geldige folder.");
  const season = input.season;
  const company = text(input.company, 180, true).replace(/[\r\n]/g, " ");
  const contactName = text(input.contactName, 160).replace(/[\r\n]/g, " ");
  const email = text(input.email, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Vul een geldig e-mailadres in.");
  const phone = text(input.phone, 80);
  const wishes = text(input.wishes, 2000);
  const consent = input.consent === true;
  const delivery = record(input.delivery);
  if (!["pickup", "delivery", "nijmegen", "custom"].includes(String(delivery.method))) throw new Error("Kies afhalen of bezorgen.");
  const method = String(delivery.method);
  const address = method === "pickup" ? "" : text(delivery.address, 1400);
  const momentType = delivery.momentType === "week" ? "week" : "date";
  const deliveryDate = momentType === "date" ? date(delivery.date) : date(delivery.weekStart);
  if (season === "sint" && !deliveryDate) throw new Error("Kies een gewenst levermoment.");
  if (momentType === "week" && (!deliveryDate || new Date(`${deliveryDate}T12:00:00Z`).getUTCDay() !== 1)) throw new Error("Kies een geldige leverweek.");
  const end = deliveryDate ? new Date(`${deliveryDate}T12:00:00Z`) : null;
  if (end && momentType === "week") end.setUTCDate(end.getUTCDate() + 6);
  const deliveryDateEnd = momentType === "week" && end ? end.toISOString().slice(0, 10) : "";
  const deliveryLabel = method === "pickup" ? "Afhalen bij Strik" : method === "nijmegen" ? "Bezorgen in/rondom Nijmegen · € 10–15 in overleg" : "Bezorgen · prijs op aanvraag";
  const momentLabel = deliveryDate ? (momentType === "week" ? `Week van ${deliveryDate} t/m ${deliveryDateEnd}` : deliveryDate) : "In overleg";
  const selection = record(input.selection);
  const rows: string[] = [];
  const letterLines: B2BLetterLine[] = [];
  let totalEx = 0, totalIncl = 0;
  let snapshotSelection: unknown;
  let hasPackaging = false, hasLogo = false;
  let department = "bakkerij";

  if (season === "kerst") {
    const singles = quantities(selection.singles, 9999);
    const contents = quantities(selection.contents, 99);
    const packageCount = Object.keys(contents).length ? count(selection.packageCount) : 1;
    const vegan = selection.vegan === true;
    const name = (id: string, label: string) => id === "krans-puur" && vegan ? `${label} · vegan uitvoering` : label;
    if (Object.keys(singles).length) rows.push("LOSSE KERSTCADEAUS");
    for (const product of christmasProducts) {
      const amount = singles[product.id];
      if (!amount) continue;
      const unitEx = christmasUnitPrice(product, amount, false), unitIncl = christmasUnitPrice(product, amount, true);
      rows.push(`${amount} × ${name(product.id, product.name)} (${product.detail})`, `  ${money(unitEx)} p.s. excl. btw · ${money(roundMoney(unitEx * amount))} totaal excl. btw`);
      totalEx += roundMoney(unitEx * amount); totalIncl += roundMoney(unitIncl * amount);
    }
    const packageEx = christmasPackage(contents, packageCount, false), packageIncl = christmasPackage(contents, packageCount, true);
    if (packageEx.lines.length) {
      hasPackaging = true;
      rows.push("", "KERSTPAKKET OP MAAT", `${packageCount} gelijke pakketten, met per pakket:`, ...packageEx.lines.map(({ product, quantity, total }) => `  ${quantity} × ${name(product.id, product.name)} (${product.detail}) · ${money(total)} excl. btw per pakket`), `Per pakket: ${money(packageEx.perPackage)} excl. btw / ${money(packageIncl.perPackage)} incl. btw`, `Pakkettotaal: ${money(packageEx.total)} excl. btw / ${money(packageIncl.total)} incl. btw`, "Passende tas of doos en eventuele meerkosten in overleg.");
      totalEx += packageEx.total; totalIncl += packageIncl.total;
    }
    if (!Object.keys(singles).length && !packageEx.lines.length) throw new Error("Kies minstens één product.");
    snapshotSelection = { singles, contents, packageCount, vegan };
  } else {
    if (!Array.isArray(selection.lines) || !selection.lines.length || selection.lines.length > 120) throw new Error("Kies minstens één product (maximaal 120 regels).");
    const lines = selection.lines.map((raw, index) => {
      const line = record(raw);
      const product = products.find(product => product.id === line.productId);
      if (!product) throw new Error("Een Sintproduct is niet herkend. Vernieuw de folder.");
      const amount = count(line.quantity);
      const isLetter = ["chocoladeletter", "chocolade-vormletter"].includes(product.id);
      let letter: B2BLetterLine | undefined;
      let choice = text(line.choice, 400) || defaultProductChoice(product);
      const customColors = text(line.customColors, 200);
      if (isLetter) {
        const details = record(line.letter);
        const style = product.id === "chocoladeletter" ? "spuit" : "vorm";
        const character = text(details.letter, 1).toUpperCase();
        if (!/^[A-Z]$/.test(character) || (style === "vorm" && character !== "S") || typeof details.size !== "string" || !["klein", "groot"].includes(details.size) || (style === "vorm" && details.size !== "groot") || typeof details.chocolate !== "string" || !["melk", "puur", "wit"].includes(details.chocolate)) throw new Error("Controleer de chocoladeletterregels.");
        if (!Array.isArray(details.exceptions) || details.exceptions.some(value => typeof value !== "string" || !["notenvrij", "vegan", "glutenvrij", "lactosevrij"].includes(value))) throw new Error("Controleer de bijzondere wensen voor de letters.");
        letter = { id: `folder-letter-${index + 1}`, style, letter: character, size: details.size as B2BLetterLine["size"], chocolate: details.chocolate as B2BLetterLine["chocolate"], quantity: amount, exceptions: [...new Set(details.exceptions)] as B2BLetterLine["exceptions"] };
        choice = `${style === "vorm" ? "vormletter S groot" : `spuitletter ${character} ${letter.size}`} · ${letter.chocolate}${letter.exceptions.length ? ` · ${letter.exceptions.join(", ")}` : ""}`;
      } else if (!productChoiceCandidates(product).includes(choice)) throw new Error("Controleer de gekozen productuitvoering.");
      return { product, quantity: amount, choice, customColors, letter, withLogo: line.withLogo === true && productSupportsLogo(product, choice), withGiftWrap: isLetter && line.withGiftWrap === true };
    });
    rows.push("GEKOZEN SINTERKLAASPRODUCTEN");
    department = lines.some(line => line.letter) ? lines.some(line => !line.letter) ? "beide" : "chocolade" : "bakkerij";
    for (const line of lines) {
      const { product, quantity, choice, customColors, letter, withLogo, withGiftWrap } = line;
      const configured = letter ? { ...product, retailPriceIncl: letter.size === "klein" ? 8.95 : 13.95 } : pricedProduct(product, choice);
      const tierCount = letter ? lines.filter(item => item.product.id === product.id).reduce((sum, item) => sum + item.quantity, 0) : quantity;
      const tier = tierFor(configured, tierCount);
      const unit = (vat: boolean) => roundMoney(productUnitPrice(configured, tier, vat) + (withLogo ? productLogoPrice(vat) : 0) + (withGiftWrap ? letterGiftWrapPrice(vat) : 0));
      const detail = letter ? choice : productChoiceLabel(product, choice);
      const colors = customColors && product.customColorMinimum && quantity >= product.customColorMinimum ? ` · eigen kleuren: ${customColors}` : product.defaultColors ? ` · standaard ${product.defaultColors}` : "";
      rows.push(`${quantity} × ${product.name} · ${detail}${colors}`, `  ${money(unit(false))} p.s. excl. btw · ${money(roundMoney(quantity * unit(false)))} totaal excl. btw${withLogo ? " · inclusief eigen logo" : ""}${withGiftWrap ? ` · inclusief cadeaupapier (${money(letterGiftWrapPrice(true))} incl. btw per letter)` : ""}`);
      totalEx += roundMoney(quantity * unit(false)); totalIncl += roundMoney(quantity * unit(true));
      if (letter) letterLines.push(letter);
      hasPackaging ||= withGiftWrap; hasLogo ||= withLogo;
    }
    snapshotSelection = lines.map(({ product, ...line }) => ({ productId: product.id, ...line }));
  }
  totalEx = roundMoney(totalEx); totalIncl = roundMoney(totalIncl);
  const reference = `${season.toUpperCase()}26-${requestId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const quoteText = ["BEDRIJF EN CONTACT", `Bedrijf: ${company}`, `Contactpersoon: ${contactName || "Niet opgegeven"}`, `E-mail: ${email}`, `Telefoon: ${phone || "Niet opgegeven"}`, "", ...rows, "", "PRIJSINDICATIE", `${money(totalEx)} excl. btw / ${money(totalIncl)} incl. btw`, "Eventuele extra verpakking en bezorging zijn niet inbegrepen; definitieve prijs in overleg.", "", "GEWENSTE LEVERING", momentLabel, deliveryLabel, ...(address ? [`Afleveradres: ${address}`] : []), "", "WENSEN", wishes || "Geen aanvullende wensen", "", "Vrijblijvende aanvraag; beschikbaarheid, levermoment en definitieve prijs moeten nog worden bevestigd."].join("\n");
  if (Buffer.byteLength(quoteText, "utf8") > 45000) throw new Error("Deze aanvraag is te uitgebreid. Verdeel de producten over twee aanvragen.");
  const snapshot = { season, company, contactName, email, phone, wishes, consent, delivery: { method, address, momentType, date: deliveryDate }, selection: snapshotSelection };
  const payloadHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return {
    requestId, reference, payloadHash, snapshot, quoteText, consent,
    order: { id: `folder-${requestId}`, year: "2026", season, status: "aanvraag", customerName: company, contactName, customerEmail: email, phone, deliveryWindowType: momentType === "week" ? "range" : "date", deliveryDate, deliveryDateEnd, department, orderText: quoteText, letterLines, totalExVat: totalEx.toFixed(2), priceAgreement: `Prijsindicatie: ${money(totalEx)} excl. btw / ${money(totalIncl)} incl. btw. Extra verpakking en bezorging in overleg.`, deliveryMethod: deliveryLabel, deliveryAddress: address, importantNotes: wishes, logo: hasLogo ? "Eigen logo aangevraagd; bestand en uitvoering nog afstemmen." : "", packaging: hasPackaging ? "Verpakking aangevraagd; zie aanvraag voor inhoud en cadeaupapier." : "", source: "handmatig", sourceSheet: `Website ${season === "kerst" ? "Kerst" : "Sint"} · ${reference}` },
  };
}
