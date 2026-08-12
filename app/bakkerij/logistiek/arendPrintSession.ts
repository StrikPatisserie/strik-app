export const AREND_PRINT_SESSION_KEY = "strik-logistiek-arend-print";

export const AREND_PRINT_SQUARES_PER_SHEET = 54;

export type ArendPrintSessionItem = {
  id: string;
  displayNumber: string;
  number: string;
  sourceLabel: string;
};

export type ArendPrintSessionBreakdown = {
  count: number;
  displayNumber: string;
  number: string;
};

export type ArendPrintSession = {
  createdAt: string;
  date: string;
  items: ArendPrintSessionItem[];
  orderedCount: number;
  printBreakdown: ArendPrintSessionBreakdown[];
  requestedCount: number;
  requestedBreakdown: ArendPrintSessionBreakdown[];
  reserveCount: number;
  title: string;
};
