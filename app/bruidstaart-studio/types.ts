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
  swatchColor?: string;
  swatchBorder?: string;
  selectionGroup?: "none" | "mainTopper" | "initials" | "extraTopper";
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
  layers: CakeLayer[];
  description?: string;
  surchargePerPerson?: number;
};

export type CakeLayer = {
  id: string;
  label: string;
  persons: number;
  personsLabel: string;
};

export type ContactDetails = {
  names: string;
  surname: string;
  recognitionCode: string;
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
  layerFillingIds: Record<string, string>;
  colorId: string;
  layoutId: string;
  decorationIds: string[];
  topperIds: string[];
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
