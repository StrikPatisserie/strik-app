import type { LogisticsReceipt } from "./logisticsTypes";

const addressLabel = /\b(?:afleveradres|bezorgadres|leveradres)\s*[:;]/i;

/** A place name inside an external customer's name is not a Strik shop. */
export function isInternalShopCustomer(customer: string) {
  const name = customer.toLowerCase().replace(/\s+/g, " ").trim();
  return /^(?:(?:strik(?: patisserie)?|winkel|filiaal|ijs)\s+)*(?:heyendaalseweg|heyendaal|daalseweg|ziekerstraat|lent)$/.test(name);
}

function correctLegacyShopClassification(receipt: LogisticsReceipt): LogisticsReceipt {
  // Older imports marked every name containing a shop's street/place as internal.
  // Repair only those generated shop tags; keep other internal registrations.
  if (
    !receipt.tags.includes("winkel") ||
    isInternalShopCustomer(receipt.customer) ||
    !/heyendaalseweg|daalseweg|ziekerstraat|lent/i.test(receipt.customer)
  ) return receipt;

  return {
    ...receipt,
    tags: receipt.tags.filter((tag) => tag !== "winkel" && tag !== "intern"),
    note: receipt.note === "Interne winkelbon: niet meetellen in externe waarde."
      ? "Geen aparte logistieke waarschuwing."
      : receipt.note,
    internalNote: receipt.internalNote.split(" · ")
      .filter((part) => part !== "winkel" && part !== "intern").join(" · "),
  };
}

function isStreetAddress(value: string) {
  return /\b\d{4}\s?[a-z]{2}\b/i.test(value) &&
    /\b[\p{L}.'-]*(?:straat|weg|laan|plein|hof|pad|dijk|singel|kade|markt|boulevard|plantsoen|baan|wal|gracht|steeg|park|allee)(?:\s+(?:noord|oost|zuid|west))?\s+\d+[a-z]?\b/iu.test(value);
}

/** Only an explicitly supplied delivery address can contradict a pickup instruction. */
export function sourceDeliveryAddress(receipt: LogisticsReceipt) {
  const sources = [receipt.originalNotes, ...receipt.lines.map((line) => line.note), receipt.customerNote];
  for (const source of sources) {
    if (!source || !addressLabel.test(source)) continue;
    const blocks = source.split(new RegExp(addressLabel.source, "gi")).slice(1);
    for (const block of blocks) {
      const address = block.split(/\b(?:wordt gehaald|afdrukdatum|pagina\s+\d+\s+van|totaalprijs)\b/i)[0].trim();
      if (isStreetAddress(address)) return address;
    }
  }
  return receipt.alternativeAddress && isStreetAddress(receipt.alternativeAddress)
    ? receipt.alternativeAddress
    : "";
}

export function normalizeReceiptDelivery(receipt: LogisticsReceipt): LogisticsReceipt {
  receipt = correctLegacyShopClassification(receipt);
  const pickup = receipt.fulfillment === "afhalen" ||
    (!receipt.fulfillment && receipt.tags.includes("afhalen"));
  const deliveryCost = receipt.lines.some((line) =>
    /\bbezorgkosten\b/i.test(line.description) &&
    Number(line.quantity.replace(",", ".")) > 0 &&
    typeof line.unitPrice === "number" && line.unitPrice > 0
  );
  if (!pickup || !deliveryCost) return receipt;
  const address = sourceDeliveryAddress(receipt);
  if (!address) return receipt;

  return {
    ...receipt,
    fulfillment: "bezorgen",
    deliveryAddress: address,
    alternativeAddress: address,
    tags: [...new Set([...receipt.tags.filter((tag) => tag !== "afhalen"), "bezorgen", "check"])],
    deliveryWarning: "Controleer bezorgadres: op de originele bon staat afhalen, maar ook een afleveradres en bezorgkosten.",
  };
}
