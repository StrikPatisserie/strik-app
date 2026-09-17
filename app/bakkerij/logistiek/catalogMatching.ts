import type { LogisticsBatch } from "./logisticsTypes";
import { canonicalStrikArticleNumber } from "@/app/lib/strikArticles";

/** Preserve the number printed on the receipt; add the verified catalog number separately. */
export function withCatalogArticleNumbers(batch: LogisticsBatch): LogisticsBatch {
  return {
    ...batch,
    receipts: batch.receipts.map((receipt) => ({
      ...receipt,
      lines: receipt.lines.map((line) => ({
        ...line,
        catalogArticleNumber: canonicalStrikArticleNumber(line.articleNumber, line.description) || undefined,
      })),
    })),
  };
}
