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
  selectionGroup?:
    | "none"
    | "mainTopper"
    | "initials"
    | "extraTopper"
    | "marzipanRoses";
  quantityLabel?: string;
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
  iconPath: string;
  description?: string;
  surchargePerPerson?: number;
};

export type CakeLayer = {
  id: string;
  label: string;
  persons: number;
  personsLabel: string;
  designGroupId?: string;
  designGroupLabel?: string;
  designGroupPersonsLabel?: string;
};

export type ContactDetails = {
  names: string;
  surname: string;
  recognitionCode: string;
  email: string;
  phone: string;
  weddingDate: string;
  deliveryDate: string;
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress: string;
  invoiceName: string;
  invoiceEmail: string;
  notes: string;
};

export type WeddingCakeConfig = {
  styleId: CakeStyleId | "";
  sizeId: string;
  fillingId: string;
  layerFillingIds: Record<string, string>;
  colorId: string;
  layerColorIds: Record<string, string>;
  layoutId: string;
  layerLayoutIds: Record<string, string>;
  decorationIds: string[];
  decorationQuantities: Record<string, number>;
  decorationNotes: string;
  topperIds: string[];
  paid: boolean;
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
