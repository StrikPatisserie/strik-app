export const goodsChecks = [
  { key: "thtOk", explanation: "thtExplanation", label: "THT" },
  { key: "packagingOk", explanation: "packagingExplanation", label: "verpakking" },
  { key: "labelOk", explanation: "labelExplanation", label: "etiket" },
] as const;

export function missingGoodsExplanation(entry: Record<string, unknown>) {
  for (const check of goodsChecks) {
    if (entry[check.key] === "nee" && (typeof entry[check.explanation] !== "string" || !String(entry[check.explanation]).trim())) return `Geef een verklaring bij ${check.label}: Nee.`;
  }
  return "";
}
