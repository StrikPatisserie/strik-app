export type PriceMode = "fixed" | "perPerson" | "included" | "quote";

export type Price = {
  mode: PriceMode;
  amount: number;
  label?: string;
};

export type CakeStyleId = "klassiek" | "vanille-creme" | "naked";

export type StudioOption = {
  id: string;
  label: string;
  description?: string;
  price: Price;
  allowedStyles?: CakeStyleId[];
};

export type CakeStyle = StudioOption & {
  id: CakeStyleId;
  basePricePerPerson: number;
};

export type CakeSize = {
  id: string;
  code: string;
  label: string;
  persons: number;
  personsLabel: string;
  tiers: number;
  description?: string;
  surchargePerPerson?: number;
};

export type ContactDetails = {
  names: string;
  email: string;
  phone: string;
  weddingDate: string;
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress: string;
  invoiceName: string;
  invoiceEmail: string;
  notes: string;
};

export type WeddingCakeConfig = {
  styleId: CakeStyleId;
  sizeId: string;
  fillingId: string;
  colorId: string;
  layoutId: string;
  decorationIds: string[];
  topperId: string;
  tasting: boolean;
  contact: ContactDetails;
};

export type PriceLine = {
  label: string;
  amount: number;
  quote?: boolean;
};

export type PriceSummary = {
  lines: PriceLine[];
  total: number;
  hasQuoteItems: boolean;
};
