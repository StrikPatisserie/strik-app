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

export type LogisticsReceiptOverride = {
  id: string;
  date: string;
  receiptId: string;
  receiptNumber: string;
  time: string;
  fulfillment: LogisticsFulfillment | "";
  deliveryAddress: string;
  alternativeAddress: string;
  pickupLocation: string;
  routeNote: string;
  updatedAt: string;
};

export type LogisticsDayFeedback = {
  id: string;
  date: string;
  text: string;
  signals: string[];
  updatedAt: string;
};

export type LogisticsRouteDraftStop = {
  id: string;
  sourceId: string;
  learningKey?: string;
  learningLabel?: string;
  learningTarget?: string;
  learningKind?: "shop" | "receipt" | "ice" | "check";
  label: string;
  detail: string;
  badges: string[];
};

export type LogisticsRouteDraftRound = {
  id: string;
  title: string;
  vehicle: string;
  departure: string;
  badge: string;
  tone: string;
  stops: LogisticsRouteDraftStop[];
  reason: string;
  load: string;
};

export type LogisticsRouteDraft = {
  id: string;
  date: string;
  routes: LogisticsRouteDraftRound[];
  updatedAt: string;
};

export type LogisticsRouteLearningObservationStop = {
  key: string;
  label: string;
  target: string;
  kind: "shop" | "receipt" | "ice" | "check";
  vehicle: string;
  routeId: string;
  routeTitle: string;
  position: number;
  badges: string[];
};

export type LogisticsRouteLearningObservation = {
  id: string;
  date: string;
  stops: LogisticsRouteLearningObservationStop[];
  updatedAt: string;
};

export type LogisticsRouteLearningStop = {
  key: string;
  label: string;
  target: string;
  kind: "shop" | "receipt" | "ice" | "check";
  preferredVehicle: string;
  preferredRouteId: string;
  averagePosition: number;
  samples: number;
  lastSeenAt: string;
};

export type LogisticsRouteLearningPair = {
  key: string;
  fromKey: string;
  toKey: string;
  fromLabel: string;
  toLabel: string;
  samples: number;
  lastSeenAt: string;
};

export type LogisticsRouteLearning = {
  id: "system";
  stops: LogisticsRouteLearningStop[];
  pairs: LogisticsRouteLearningPair[];
  observationCount: number;
  updatedAt: string;
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
  importWaveId?: string;
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

export type LogisticsWebshopImageConfidence = "hoog" | "middel" | "laag";

export type LogisticsWebshopImage = {
  id: string;
  messageId: string;
  orderNumber: string;
  deliveryDate: string;
  customerName: string;
  photoUrl: string;
  sourceUrl: string;
  fileName: string;
  productSummary?: string;
  matchedReceiptId?: string;
  matchedReceiptNumber?: string;
  matchedReceiptCustomer?: string;
  matchedAt?: string;
  matchSource?: "manual" | "auto";
  subject: string;
  from: string;
  receivedAt: string;
  importedAt: string;
  confidence: LogisticsWebshopImageConfidence;
  notes: string[];
};
