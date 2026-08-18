export type ChocolateLetterChocolate = "melk" | "puur" | "wit" | "vegan-puur";
export type ChocolateLetterSize = "klein" | "groot";
export type ChocolateLetterStyle = "spuit" | "vorm";
export type ChocolateLetterSource = "winkel" | "online";

export type ChocolateLetterLine = {
  id: string;
  letter: string;
  chocolate: ChocolateLetterChocolate;
  size: ChocolateLetterSize;
  style: ChocolateLetterStyle;
  quantity: number;
  logo: boolean;
  notes: string;
};

export type ChocolateLetterOrder = {
  id: string;
  year: string;
  code: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  shop: string;
  pickupDate: string;
  pickupLocation: string;
  source: ChocolateLetterSource;
  sourceKey: string;
  sourceImportedAt: string;
  sourceBatch: string;
  status: "besteld" | "in-productie" | "klaar" | "opgehaald" | "geannuleerd";
  notes: string;
  lines: ChocolateLetterLine[];
  sendCustomerEmail: boolean;
  productionDone: boolean;
  productionDoneAt: string;
  productionDoneBy: string;
  pickedUp: boolean;
  pickedUpAt: string;
  bakeryEmailSentAt: string;
  bakeryEmailError: string;
  customerConfirmationSentAt: string;
  customerConfirmationError: string;
  createdAt: string;
  updatedAt: string;
};

export type SinterklaasB2BOrder = {
  id: string;
  year: string;
  season: "sint" | "kerst" | "sint-kerst";
  customerName: string;
  contactName: string;
  customerEmail: string;
  phone: string;
  deliveryDate: string;
  productionDate: string;
  department: "chocolade" | "bakkerij" | "beide";
  orderText: string;
  logo: string;
  packaging: string;
  importantNotes: string;
  priceAgreement: string;
  totalExVat: string;
  deliveryMethod: string;
  deliveryAddress: string;
  invoiceInfo: string;
  source: "handmatig" | "excel";
  sourceSheet: string;
  entered: boolean;
  productionDone: boolean;
  packed: boolean;
  delivered: boolean;
  cancelled: boolean;
  productionDoneAt: string;
  packedAt: string;
  deliveredAt: string;
  reminderEmailedAt: string;
  reminderEmailError: string;
  createdAt: string;
  updatedAt: string;
};

export type SinterklaasListResponse<T> = {
  orders: T[];
  total?: number;
  generatedAt?: string;
};
