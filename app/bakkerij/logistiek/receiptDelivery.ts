import type { LogisticsReceipt } from "./logisticsTypes";

const addressLabel = /\b(?:afleveradres|bezorgadres|leveradres)\s*[:;]/i;

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
