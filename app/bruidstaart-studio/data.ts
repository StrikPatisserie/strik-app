import {
  CakeSize,
  CakeStyle,
  CakeStyleId,
  ContactDetails,
  StudioOption,
  WeddingCakeConfig,
} from "./types";

export const cakeStyles: CakeStyle[] = [
  {
    id: "klassiek",
    label: "Klassiek",
    description: "Een strak afgewerkte bruidstaart met marsepein of icing.",
    basePricePerPerson: 7,
    price: { mode: "perPerson", amount: 7, label: "vanafprijs p.p." },
  },
  {
    id: "vanille-creme",
    label: "Vanille Crème",
    description: "Zachte crème-afwerking met een rustige, romantische uitstraling.",
    basePricePerPerson: 6.5,
    price: { mode: "perPerson", amount: 6.5, label: "vanafprijs p.p." },
  },
  {
    id: "naked",
    label: "Naked",
    description: "Open of dicht gesmeerde taart met zichtbare lagen.",
    basePricePerPerson: 6.5,
    price: { mode: "perPerson", amount: 6.5, label: "vanafprijs p.p." },
  },
];

export const cakeSizes: CakeSize[] = [
  {
    id: "small-6-8",
    code: "Klein 6-8",
    label: "Kleine bruidstaart",
    persons: 8,
    personsLabel: "6-8 personen",
    tiers: 1,
    description: "Optionele kleine bruidstaart uit de folder.",
    surchargePerPerson: 5,
  },
  {
    id: "small-10-12",
    code: "Klein 10-12",
    label: "Kleine bruidstaart",
    persons: 12,
    personsLabel: "10-12 personen",
    tiers: 1,
    description: "Optionele kleine bruidstaart uit de folder.",
    surchargePerPerson: 3,
  },
  {
    id: "s1a",
    code: "S1A",
    label: "1 laag",
    persons: 18,
    personsLabel: "16-18 personen",
    tiers: 1,
    description: "Basisopbouw met een enkele taartlaag.",
  },
  {
    id: "s2a",
    code: "S2A",
    label: "2 lagen",
    persons: 14,
    personsLabel: "±14 personen",
    tiers: 2,
    description: "Twee kleine lagen: 6-8p + 6-8p.",
  },
  {
    id: "s2b",
    code: "S2B",
    label: "2 lagen",
    persons: 18,
    personsLabel: "±18 personen",
    tiers: 2,
    description: "6-8p + 10-12p.",
  },
  {
    id: "s2c",
    code: "S2C",
    label: "2 lagen",
    persons: 22,
    personsLabel: "±22 personen",
    tiers: 2,
    description: "10-12p + 10-12p.",
  },
  {
    id: "s2d",
    code: "S2D",
    label: "2 lagen",
    persons: 28,
    personsLabel: "±28 personen",
    tiers: 2,
    description: "10-12p + 16-18p.",
  },
  {
    id: "s2e",
    code: "S2E",
    label: "2 lagen",
    persons: 34,
    personsLabel: "±34 personen",
    tiers: 2,
    description: "16-18p + 16-18p.",
  },
  {
    id: "s2f",
    code: "S2F",
    label: "2 lagen hoog",
    persons: 36,
    personsLabel: "±36 personen",
    tiers: 2,
    description: "Gestapelde hoge opbouw met kleine en middelgrote lagen.",
  },
  {
    id: "s2g",
    code: "S2G",
    label: "2 lagen hoog",
    persons: 56,
    personsLabel: "±56 personen",
    tiers: 2,
    description: "Hoge opbouw met middelgrote en grote lagen.",
  },
  {
    id: "s3a",
    code: "S3A",
    label: "3 lagen",
    persons: 35,
    personsLabel: "±35 personen",
    tiers: 3,
    description: "6-8p + 10-12p + 16-18p.",
  },
  {
    id: "s3b",
    code: "S3B",
    label: "3 lagen hoog",
    persons: 70,
    personsLabel: "±70 personen",
    tiers: 3,
    description: "Hoge opbouw met kleine, middelgrote en grote lagen.",
  },
];

export const fillingOptions: StudioOption[] = [
  {
    id: "chipolata",
    label: "Chipolata",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "aardbeien-room",
    label: "Aardbeien room",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "witte-choco-framboos",
    label: "Witte choco-framboos",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "chocolade",
    label: "Chocolade",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "slagroom",
    label: "Slagroom",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "champagne-peer",
    label: "Champagne peer",
    description: "Premium vulling uit de bruidsfolder.",
    price: { mode: "perPerson", amount: 0.4 },
  },
  {
    id: "champagne-aardbei",
    label: "Champagne aardbei",
    description: "Premium vulling uit de bruidsfolder.",
    price: { mode: "perPerson", amount: 0.5 },
  },
  {
    id: "overige-vulling",
    label: "Overige vulling uit folder",
    description: "Zonder premiumtoeslag, exacte smaak in opmerkingen.",
    price: { mode: "included", amount: 0 },
  },
];

export const colorOptions: StudioOption[] = [
  {
    id: "marsepein-kleur",
    label: "Marsepein kleur",
    allowedStyles: ["klassiek"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "icing-kleur",
    label: "Icing kleur",
    allowedStyles: ["klassiek"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-eigen-kleur",
    label: "Kleur naar wens",
    description: "Exacte kleur in opmerkingen.",
    allowedStyles: ["klassiek"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme",
    label: "Crème",
    allowedStyles: ["vanille-creme"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "roze-pastel",
    label: "Roze pastel",
    allowedStyles: ["vanille-creme"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "groen-pastel",
    label: "Groen pastel",
    allowedStyles: ["vanille-creme"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-anders",
    label: "Anders",
    description: "Kleurwens in opmerkingen.",
    allowedStyles: ["vanille-creme"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "naked-naturel",
    label: "Naturel naked afwerking",
    allowedStyles: ["naked"],
    price: { mode: "included", amount: 0 },
  },
];

export const layoutOptions: StudioOption[] = [
  {
    id: "klassiek-strak",
    label: "Strak",
    allowedStyles: ["klassiek"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-chesterfield",
    label: "Chesterfield",
    allowedStyles: ["klassiek"],
    price: { mode: "perPerson", amount: 0.75 },
  },
  {
    id: "klassiek-banen",
    label: "Banen",
    allowedStyles: ["klassiek"],
    price: { mode: "perPerson", amount: 1.5 },
  },
  {
    id: "klassiek-bogen",
    label: "Bogen",
    allowedStyles: ["klassiek"],
    price: { mode: "perPerson", amount: 0.5 },
  },
  {
    id: "klassiek-sierlijk",
    label: "Sierlijk",
    allowedStyles: ["klassiek"],
    price: { mode: "perPerson", amount: 0.5 },
  },
  {
    id: "creme-strak",
    label: "Strak",
    allowedStyles: ["vanille-creme"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-banen",
    label: "Crème banen",
    allowedStyles: ["vanille-creme"],
    price: { mode: "perPerson", amount: 0.5 },
  },
  {
    id: "creme-stippen",
    label: "Crème stippen",
    allowedStyles: ["vanille-creme"],
    price: { mode: "perPerson", amount: 0.5 },
  },
  {
    id: "creme-grof",
    label: "Grof gesmeerd",
    allowedStyles: ["vanille-creme"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-rozen",
    label: "Crème rozen",
    allowedStyles: ["vanille-creme"],
    price: { mode: "perPerson", amount: 1.5 },
  },
  {
    id: "naked-dicht",
    label: "Naked dicht",
    description: "Dun aangesmeerd, lagen deels zichtbaar.",
    allowedStyles: ["naked"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "naked-open",
    label: "Naked open",
    description: "Meer zichtbare lagen, rustieke uitstraling.",
    allowedStyles: ["naked"],
    price: { mode: "included", amount: 0 },
  },
];

export const decorationOptions: StudioOption[] = [
  {
    id: "creme-parelrand",
    label: "Crème parelrand / marsepein-icing rand",
    description: "Randafwerking zoals in de bruidsfolder.",
    price: { mode: "perPerson", amount: 0.15 },
  },
  {
    id: "marsepeinrozen-zonder-blad",
    label: "Marsepeinroosjes zonder blad",
    price: { mode: "perPerson", amount: 1 },
  },
  {
    id: "marsepeinrozen-met-blad",
    label: "Marsepeinroosjes met blad",
    price: { mode: "perPerson", amount: 1.5 },
  },
  {
    id: "echte-bloemen",
    label: "Echte bloemen",
    description: "Zelf aanleveren; waterval of verspreid in opmerkingen.",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "bladgoud",
    label: "Bladgoud",
    price: { mode: "perPerson", amount: 0.1 },
  },
  {
    id: "rood-fruit",
    label: "Rood fruit",
    price: { mode: "perPerson", amount: 0.35 },
  },
];

export const topperOptions: StudioOption[] = [
  { id: "geen", label: "Geen topper", price: { mode: "included", amount: 0 } },
  {
    id: "bruidspaartje",
    label: "Bruidspaartje",
    price: { mode: "fixed", amount: 10, label: "per taart" },
  },
  {
    id: "topper-karton",
    label: "Topper karton divers",
    price: { mode: "fixed", amount: 5, label: "per taart" },
  },
  {
    id: "topper-zelf-aanleveren",
    label: "Topper zelf aanleveren",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "chocolade-initialen-geschreven",
    label: "Chocolade initialen geschreven",
    description: "Letters in opmerkingen zetten.",
    price: { mode: "fixed", amount: 3.5, label: "per taart" },
  },
  {
    id: "chocolade-initialen-schildje",
    label: "Chocolade initialen op schildje",
    description: "Letters in opmerkingen zetten.",
    price: { mode: "fixed", amount: 5, label: "per taart" },
  },
  {
    id: "marsepeinen-ringen",
    label: "Marsepeinen ringen of strik",
    price: { mode: "fixed", amount: 3.5, label: "per taart" },
  },
];

export const tastingOption: StudioOption = {
  id: "bruidsproefje",
  label: "Bruidsproefje toevoegen",
  description:
    "4-persoons taartje met gewenste vulling. Niet afgewerkt als de uiteindelijke bruidstaart.",
  price: { mode: "fixed", amount: 14.95, label: "per proefje" },
};

export const emptyContactDetails: ContactDetails = {
  names: "",
  email: "",
  phone: "",
  weddingDate: "",
  deliveryMethod: "pickup",
  deliveryAddress: "",
  invoiceName: "",
  invoiceEmail: "",
  notes: "",
};

export const initialWeddingCakeConfig: WeddingCakeConfig = {
  styleId: "klassiek",
  sizeId: "s1a",
  fillingId: "chipolata",
  colorId: "marsepein-kleur",
  layoutId: "klassiek-strak",
  decorationIds: [],
  topperId: "geen",
  tasting: false,
  contact: emptyContactDetails,
};

export function isOptionAllowedForStyle(
  option: StudioOption,
  styleId: CakeStyleId
) {
  return !option.allowedStyles || option.allowedStyles.includes(styleId);
}

export function isLayoutAllowedForStyle(
  option: StudioOption,
  styleId: CakeStyleId
) {
  return isOptionAllowedForStyle(option, styleId);
}
