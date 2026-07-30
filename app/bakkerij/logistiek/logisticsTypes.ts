export type LogisticsBatchStatus =
  | "wacht"
  | "prognose"
  | "definitief"
  | "handmatig"
  | "historie";

export type LogisticsBatchSource = "gmail" | "manual";

export type LogisticsFulfillment = "bezorgen" | "afhalen" | "onbekend";

export type LogisticsReceiptLine = {
  quantity: string;
  description: string;
  note?: string;
  unitPrice?: number;
};

export type LogisticsReceipt = {
  id: string;
  receiptNumber: string;
  time: string;
  customer: string;
  address: string;
  deliveryAddress: string;
  alternativeAddress?: string;
  fulfillment?: LogisticsFulfillment;
  pickupLocation?: string;
  route: string;
  tags: string[];
  value?: number;
  note: string;
  customerNote: string;
  internalNote: string;
  lines: LogisticsReceiptLine[];
};

export type LogisticsBatch = {
  id: string;
  date: string;
  status: LogisticsBatchStatus;
  source: LogisticsBatchSource;
  fileName: string;
  subject: string;
  from: string;
  receivedAt: string;
  importedAt: string;
  pageCount: number;
  orderCount: number;
  orderValue: number;
  orderPressure: string;
  iceTubs: number;
  tempexBoxes: number;
  criticalWindows: number;
  receipts: LogisticsReceipt[];
  warnings: string[];
};
