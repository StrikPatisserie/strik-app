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
    basePricePerPerson: 7.5,
    price: { mode: "perPerson", amount: 7.5, label: "vanafprijs p.p." },
  },
  {
    id: "vanille-creme",
    label: "Vanille Crème",
    description: "Zachte crème-afwerking met een rustige, romantische uitstraling.",
    basePricePerPerson: 6.95,
    price: { mode: "perPerson", amount: 6.95, label: "vanafprijs p.p." },
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
  { id: "20", label: "20 personen", persons: 20, tiers: 1 },
  { id: "30", label: "30 personen", persons: 30, tiers: 2 },
  { id: "45", label: "45 personen", persons: 45, tiers: 2 },
  { id: "60", label: "60 personen", persons: 60, tiers: 3 },
  { id: "80", label: "80 personen", persons: 80, tiers: 3 },
  { id: "100", label: "100 personen", persons: 100, tiers: 4 },
  { id: "120", label: "120 personen", persons: 120, tiers: 4 },
];

export const fillingOptions: StudioOption[] = [
  {
    id: "vanille-framboos",
    label: "Vanille & framboos",
    description: "Luchtige vanillecrème met frisse frambozenvulling.",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "citroen-meringue",
    label: "Citroen meringue",
    description: "Fris, zachtzuur en feestelijk.",
    price: { mode: "fixed", amount: 12.5 },
  },
  {
    id: "chocolade-karamel",
    label: "Chocolade & karamel",
    description: "Volle chocoladevulling met karameltoon.",
    price: { mode: "fixed", amount: 15 },
  },
  {
    id: "hazelnoot-praline",
    label: "Hazelnoot praline",
    description: "Rijke notenvulling met zachte praline.",
    price: { mode: "fixed", amount: 15 },
  },
  {
    id: "eigen-wens",
    label: "Eigen wens",
    description: "De klant bespreekt een afwijkende smaak met Strik.",
    price: { mode: "quote", amount: 0 },
  },
];

export const colorOptions: StudioOption[] = [
  { id: "wit", label: "Wit", price: { mode: "included", amount: 0 } },
  { id: "ivoor", label: "Ivoor", price: { mode: "included", amount: 0 } },
  { id: "blush", label: "Blush", price: { mode: "fixed", amount: 12.5 } },
  { id: "zand", label: "Zand", price: { mode: "fixed", amount: 12.5 } },
  { id: "pastel", label: "Pastel kleur", price: { mode: "fixed", amount: 17.5 } },
  { id: "specifiek", label: "Specifieke kleur", price: { mode: "quote", amount: 0 } },
];

export const layoutOptions: StudioOption[] = [
  {
    id: "klassiek-strak",
    label: "Klassiek strak",
    description: "Rechte, rustige opbouw.",
    allowedStyles: ["klassiek", "vanille-creme"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "speels-verspringend",
    label: "Speels verspringend",
    description: "Etages bewust iets uit lijn geplaatst.",
    allowedStyles: ["klassiek", "vanille-creme"],
    price: { mode: "fixed", amount: 25 },
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
    id: "bloemen-echt-basis",
    label: "Echte bloemen basis",
    description: "Subtiele bloemendecoratie. Bloemen in overleg.",
    price: { mode: "fixed", amount: 35 },
  },
  {
    id: "bloemen-echt-luxe",
    label: "Echte bloemen luxe",
    description: "Rijkere bloemendecoratie over meerdere etages.",
    price: { mode: "fixed", amount: 75 },
  },
  {
    id: "bloemen-eetbaar",
    label: "Eetbare bloemen",
    price: { mode: "fixed", amount: 45 },
  },
  {
    id: "kringels-strak",
    label: "Kringels strak",
    price: { mode: "fixed", amount: 22.5 },
  },
  {
    id: "kringels-klassiek",
    label: "Kringels klassiek",
    price: { mode: "fixed", amount: 22.5 },
  },
  {
    id: "bolletjes-klein",
    label: "Bolletjes klein",
    price: { mode: "fixed", amount: 17.5 },
  },
  {
    id: "bolletjes-groot",
    label: "Bolletjes groot",
    price: { mode: "fixed", amount: 27.5 },
  },
  {
    id: "fruit-mix-rood",
    label: "Fruit mix rood",
    price: { mode: "fixed", amount: 37.5 },
  },
  {
    id: "fruit-specifiek",
    label: "Specifiek fruit",
    price: { mode: "quote", amount: 0 },
  },
];

export const topperOptions: StudioOption[] = [
  { id: "geen", label: "Geen topper", price: { mode: "included", amount: 0 } },
  {
    id: "eigen-topper",
    label: "Eigen topper aanleveren",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "tekst",
    label: "Tekst op taart",
    price: { mode: "fixed", amount: 12.5 },
  },
  {
    id: "foto",
    label: "Foto/add-on",
    price: { mode: "fixed", amount: 19.5 },
  },
  {
    id: "maatwerk",
    label: "Maatwerk topper",
    price: { mode: "quote", amount: 0 },
  },
];

export const tastingOption: StudioOption = {
  id: "bruidsproefje",
  label: "Bruidsproefje toevoegen",
  description: "Proeverijmoment voor het bruidspaar. Wordt als aanvraag meegenomen.",
  price: { mode: "fixed", amount: 29.5 },
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
  sizeId: "45",
  fillingId: "vanille-framboos",
  colorId: "ivoor",
  layoutId: "klassiek-strak",
  decorationIds: [],
  topperId: "geen",
  tasting: false,
  contact: emptyContactDetails,
};

export function isLayoutAllowedForStyle(
  option: StudioOption,
  styleId: CakeStyleId
) {
  return !option.allowedStyles || option.allowedStyles.includes(styleId);
}
