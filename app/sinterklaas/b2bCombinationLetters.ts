import { editableFolderOrderText } from "../lib/businessFolderOrderText";
import { b2bLetterHasLogo } from "./b2bLetterLines";
import type { B2BLetterLine, SinterklaasB2BOrder } from "./types";

export type CombinationLetterChoice = { chocolate: B2BLetterLine["chocolate"] | ""; letter: string };
export type ProductionB2BLetter = B2BLetterLine & { combinationProduct?: string };
export type CombinationLetterIssue = { product: string; quantity: number; message: string };

export function combinationProduct(productId: string) {
  return productId === "speculaasbrok-met-letter" || productId === "klein-sintpakket";
}
export function readCombinationChoice(description: string): CombinationLetterChoice {
  return { chocolate: (description.match(/ · chocolade (melk|puur|wit)(?: · eigen logo)?$/i)?.[1]?.toLowerCase() || "") as CombinationLetterChoice["chocolate"], letter: description.match(/ · letter ([A-Z])(?: · chocolade (?:melk|puur|wit))?(?: · eigen logo)?$/i)?.[1] || "" };
}
export function stripCombinationChocolate(description: string) {
  return description.replace(/ · chocolade (?:melk|puur|wit)(?= · eigen logo$|$)/i, "");
}

/** Package letters are derived separately, so they never create a second sale or price. */
export function b2bProductionLetters(order: Pick<SinterklaasB2BOrder, "id" | "orderText" | "letterLines" | "logo">) {
  const lines: ProductionB2BLetter[] = order.letterLines.map(line => ({ ...line, withLogo: b2bLetterHasLogo(order, line) }));
  const issues: CombinationLetterIssue[] = [];
  const converted = editableFolderOrderText(order.orderText || "") || (order.orderText || "").replace(/\r\n?/g, "\n");
  const productPart = converted.split("\nOVERIGE ORDERAFSPRAKEN")[0];
  let packageQuantity = 0;
  productPart.split("\n").forEach((row, index) => {
    const match = row.trim().match(/^(\d+)\s*[×x]\s*(.+?)(?: · €\s*[\d.,]+ p\.s\. ex btw.*)?$/);
    if (!match) return;
    const quantity = Number(match[1]), description = match[2];
    if (!Number.isSafeInteger(quantity) || quantity < 1) return;
    const choice = readCombinationChoice(description);
    const name = stripCombinationChocolate(description).replace(/ · eigen logo$/i, "");
    const brok = name.match(/^Speculaasbrok met letter · Speculaasbrok (zonder|met) amandel · (kleine|grote) spuitletter(?: · letter ([A-Z]))?$/i);
    const small = name.match(/^Klein Sintpakket · (zonder|met) amandel(?: · letter ([A-Z]))?$/i);
    const unknown = !brok && !small && /(?:met|\+)\s+(?:(?:kleine|grote)\s+)?(?:chocolade)?letter\b/i.test(name);
    if (!brok && !small && !unknown) return;
    packageQuantity += quantity;
    const product = brok ? `Speculaasbrok ${brok[1].toLowerCase()} amandel + letter` : small ? `Klein Sintpakket ${small[1].toLowerCase()} amandel` : name;
    const letter = brok ? brok[3] || "S" : small ? small[2] || choice.letter : "";
    const missing = [!choice.chocolate && "chocoladesmaak", !letter && "letter", unknown && "formaat en uitvoering"].filter(Boolean);
    if (missing.length) { issues.push({ product, quantity, message: `${missing.join(", ")} nog invullen bij het combinatieproduct.` }); return; }
    lines.push({ id: `combination:${order.id}:${index}`, letter: letter.toUpperCase(), chocolate: choice.chocolate as B2BLetterLine["chocolate"], style: "spuit", size: brok?.[2].toLowerCase() === "grote" ? "groot" : "klein", quantity, withLogo: / · eigen logo$/i.test(description), exceptions: [], combinationProduct: product });
  });
  return { lines, issues, packageQuantity, requiredQuantity: order.letterLines.reduce((sum, line) => sum + line.quantity, 0) + packageQuantity };
}
