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

function makeLayer(
  id: string,
  label: string,
  persons: number,
  personsLabel: string,
  designGroup?: {
    id: string;
    label: string;
    personsLabel: string;
  }
) {
  return {
    id,
    label,
    persons,
    personsLabel,
    designGroupId: designGroup?.id,
    designGroupLabel: designGroup?.label,
    designGroupPersonsLabel: designGroup?.personsLabel,
  };
}

function cakeSizeIcon(fileName: string) {
  return `/taartlagen_${fileName}.svg`;
}

export const cakeSizes: CakeSize[] = [
  {
    id: "small-6-8",
    code: "Klein 6-8",
    label: "Kleine bruidstaart",
    persons: 8,
    personsLabel: "6-8 personen",
    tiers: 1,
    layers: [makeLayer("small-6-8-1", "Kleine laag", 8, "6-8p")],
    iconPath: cakeSizeIcon("6-8P"),
    description: "Optionele kleine bruidstaart uit de folder.",
    surchargePerPerson: 1.5,
  },
  {
    id: "small-10-12",
    code: "Klein 10-12",
    label: "Kleine bruidstaart",
    persons: 12,
    personsLabel: "10-12 personen",
    tiers: 1,
    layers: [makeLayer("small-10-12-1", "Kleine laag", 12, "10-12p")],
    iconPath: cakeSizeIcon("10-12P"),
    description: "Optionele kleine bruidstaart uit de folder.",
    surchargePerPerson: 1.5,
  },
  {
    id: "s1a",
    code: "S1A",
    label: "1 laag",
    persons: 18,
    personsLabel: "16-18 personen",
    tiers: 1,
    layers: [makeLayer("s1a-1", "Laag 1", 18, "16-18p")],
    iconPath: cakeSizeIcon("S1A"),
    description: "Basisopbouw met een enkele taartlaag.",
  },
  {
    id: "s2a",
    code: "S2A",
    label: "2 lagen",
    persons: 14,
    personsLabel: "±14 personen",
    tiers: 2,
    layers: [
      makeLayer("s2a-1", "Onderlaag", 7, "6-8p"),
      makeLayer("s2a-2", "Bovenlaag", 7, "6-8p"),
    ],
    iconPath: cakeSizeIcon("S2A"),
    description: "Twee kleine lagen: 6-8p + 6-8p.",
  },
  {
    id: "s2b",
    code: "S2B",
    label: "2 lagen",
    persons: 18,
    personsLabel: "±18 personen",
    tiers: 2,
    layers: [
      makeLayer("s2b-1", "Onderlaag", 11, "10-12p"),
      makeLayer("s2b-2", "Bovenlaag", 7, "6-8p"),
    ],
    iconPath: cakeSizeIcon("S2B"),
    description: "6-8p + 10-12p.",
  },
  {
    id: "s2c",
    code: "S2C",
    label: "2 lagen",
    persons: 22,
    personsLabel: "±22 personen",
    tiers: 2,
    layers: [
      makeLayer("s2c-1", "Onderlaag", 11, "10-12p"),
      makeLayer("s2c-2", "Bovenlaag", 11, "10-12p"),
    ],
    iconPath: cakeSizeIcon("S2C"),
    description: "10-12p + 10-12p.",
  },
  {
    id: "s2d",
    code: "S2D",
    label: "2 lagen",
    persons: 28,
    personsLabel: "±28 personen",
    tiers: 2,
    layers: [
      makeLayer("s2d-1", "Onderlaag", 17, "16-18p"),
      makeLayer("s2d-2", "Bovenlaag", 11, "10-12p"),
    ],
    iconPath: cakeSizeIcon("S2D"),
    description: "10-12p + 16-18p.",
  },
  {
    id: "s2e",
    code: "S2E",
    label: "2 lagen",
    persons: 34,
    personsLabel: "±34 personen",
    tiers: 2,
    layers: [
      makeLayer("s2e-1", "Onderlaag", 17, "16-18p"),
      makeLayer("s2e-2", "Bovenlaag", 17, "16-18p"),
    ],
    iconPath: cakeSizeIcon("S2E"),
    description: "16-18p + 16-18p.",
  },
  {
    id: "s2f",
    code: "S2F",
    label: "2 lagen hoog",
    persons: 36,
    personsLabel: "±36 personen",
    tiers: 2,
    layers: [
      makeLayer("s2f-1", "Onderlaag onder", 10, "10-12p", {
        id: "s2f-bottom",
        label: "Onderlaag hoog",
        personsLabel: "2 x 10-12p",
      }),
      makeLayer("s2f-2", "Onderlaag boven", 10, "10-12p", {
        id: "s2f-bottom",
        label: "Onderlaag hoog",
        personsLabel: "2 x 10-12p",
      }),
      makeLayer("s2f-3", "Bovenlaag onder", 8, "6-8p", {
        id: "s2f-top",
        label: "Bovenlaag hoog",
        personsLabel: "2 x 6-8p",
      }),
      makeLayer("s2f-4", "Bovenlaag boven", 8, "6-8p", {
        id: "s2f-top",
        label: "Bovenlaag hoog",
        personsLabel: "2 x 6-8p",
      }),
    ],
    iconPath: cakeSizeIcon("S2F"),
    description: "Gestapelde hoge opbouw met kleine en middelgrote lagen.",
  },
  {
    id: "s2g",
    code: "S2G",
    label: "2 lagen hoog",
    persons: 56,
    personsLabel: "±56 personen",
    tiers: 2,
    layers: [
      makeLayer("s2g-1", "Onderlaag onder", 18, "16-18p", {
        id: "s2g-bottom",
        label: "Onderlaag hoog",
        personsLabel: "2 x 16-18p",
      }),
      makeLayer("s2g-2", "Onderlaag boven", 18, "16-18p", {
        id: "s2g-bottom",
        label: "Onderlaag hoog",
        personsLabel: "2 x 16-18p",
      }),
      makeLayer("s2g-3", "Bovenlaag onder", 10, "10-12p", {
        id: "s2g-top",
        label: "Bovenlaag hoog",
        personsLabel: "2 x 10-12p",
      }),
      makeLayer("s2g-4", "Bovenlaag boven", 10, "10-12p", {
        id: "s2g-top",
        label: "Bovenlaag hoog",
        personsLabel: "2 x 10-12p",
      }),
    ],
    iconPath: cakeSizeIcon("S2G"),
    description: "Hoge opbouw met middelgrote en grote lagen.",
  },
  {
    id: "s3a",
    code: "S3A",
    label: "3 lagen",
    persons: 35,
    personsLabel: "±35 personen",
    tiers: 3,
    layers: [
      makeLayer("s3a-1", "Onderlaag", 17, "16-18p"),
      makeLayer("s3a-2", "Middenlaag", 11, "10-12p"),
      makeLayer("s3a-3", "Bovenlaag", 7, "6-8p"),
    ],
    iconPath: cakeSizeIcon("S3A"),
    description: "6-8p + 10-12p + 16-18p.",
  },
  {
    id: "s3b",
    code: "S3B",
    label: "3 lagen hoog",
    persons: 70,
    personsLabel: "±70 personen",
    tiers: 3,
    layers: [
      makeLayer("s3b-1", "Onderlaag onder", 17, "16-18p", {
        id: "s3b-bottom",
        label: "Onderlaag hoog",
        personsLabel: "2 x 16-18p",
      }),
      makeLayer("s3b-2", "Onderlaag boven", 17, "16-18p", {
        id: "s3b-bottom",
        label: "Onderlaag hoog",
        personsLabel: "2 x 16-18p",
      }),
      makeLayer("s3b-3", "Middenlaag onder", 11, "10-12p", {
        id: "s3b-middle",
        label: "Middenlaag hoog",
        personsLabel: "2 x 10-12p",
      }),
      makeLayer("s3b-4", "Middenlaag boven", 11, "10-12p", {
        id: "s3b-middle",
        label: "Middenlaag hoog",
        personsLabel: "2 x 10-12p",
      }),
      makeLayer("s3b-5", "Bovenlaag onder", 7, "6-8p", {
        id: "s3b-top",
        label: "Bovenlaag hoog",
        personsLabel: "2 x 6-8p",
      }),
      makeLayer("s3b-6", "Bovenlaag boven", 7, "6-8p", {
        id: "s3b-top",
        label: "Bovenlaag hoog",
        personsLabel: "2 x 6-8p",
      }),
    ],
    iconPath: cakeSizeIcon("S3B"),
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
];

export const weddingCakeColorPaletteOptions: StudioOption[] = [
  {
    id: "klassiek-lichtroze",
    label: "Poeder roze",
    allowedStyles: ["klassiek"],
    swatchColor: "#FFC2E6",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-ivoor",
    label: "Camel",
    allowedStyles: ["klassiek"],
    swatchColor: "#B38E7A",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-champagne",
    label: "Mosterd",
    allowedStyles: ["klassiek"],
    swatchColor: "#825B00",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-blush",
    label: "Blush",
    allowedStyles: ["klassiek"],
    swatchColor: "#FF859C",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-oudroze",
    label: "Chocolate",
    allowedStyles: ["klassiek"],
    swatchColor: "#2A0C0B",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-roze",
    label: "Fuchsia",
    allowedStyles: ["klassiek"],
    swatchColor: "#510E63",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-rood",
    label: "Kers",
    allowedStyles: ["klassiek"],
    swatchColor: "#E10032",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-bordeaux",
    label: "Burgundy",
    allowedStyles: ["klassiek"],
    swatchColor: "#43001A",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-lila",
    label: "Lavendel",
    allowedStyles: ["klassiek"],
    swatchColor: "#A18FC6",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-paars",
    label: "IJzer",
    allowedStyles: ["klassiek"],
    swatchColor: "#3A3A3A",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-lichtblauw",
    label: "Poeder blauw",
    allowedStyles: ["klassiek"],
    swatchColor: "#D1FFFC",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-blauw",
    label: "Sky",
    allowedStyles: ["klassiek"],
    swatchColor: "#68C7D7",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-donkerblauw",
    label: "Marine",
    allowedStyles: ["klassiek"],
    swatchColor: "#001977",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-mintgroen",
    label: "Salie",
    allowedStyles: ["klassiek"],
    swatchColor: "#ADE3A8",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-sage",
    label: "Dennen",
    allowedStyles: ["klassiek"],
    swatchColor: "#155100",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-eucalyptus",
    label: "Petrol",
    allowedStyles: ["klassiek"],
    swatchColor: "#1F8B6C",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-groen",
    label: "Asperge",
    allowedStyles: ["klassiek"],
    swatchColor: "#69C142",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-geel",
    label: "Citroen",
    allowedStyles: ["klassiek"],
    swatchColor: "#FCF2B5",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-oranje",
    label: "Sinaas",
    allowedStyles: ["klassiek"],
    swatchColor: "#FF7026",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-terracotta",
    label: "Terracotta",
    allowedStyles: ["klassiek"],
    swatchColor: "#9B3011",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-zwart",
    label: "Zwart - icing",
    allowedStyles: ["klassiek"],
    swatchColor: "#000000",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-goud",
    label: "Honing",
    allowedStyles: ["klassiek"],
    swatchColor: "#FFB824",
    price: { mode: "included", amount: 0 },
  },
];

export const colorOptions: StudioOption[] = [
  {
    id: "marsepein-kleur",
    label: "Marsepein beige",
    description: "Basiskleur voor marsepein.",
    allowedStyles: ["klassiek"],
    swatchColor: "#FFFAE6",
    swatchBorder: "#e3d8bd",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "icing-kleur",
    label: "Wit - icing",
    description: "Heldere witte icing.",
    allowedStyles: ["klassiek"],
    swatchColor: "#FFFFFF",
    swatchBorder: "#d9d9d9",
    price: { mode: "included", amount: 0 },
  },
  ...weddingCakeColorPaletteOptions,
  {
    id: "creme",
    label: "Crème",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#fff0d9",
    swatchBorder: "#dec9aa",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "roze-pastel",
    label: "Roze pastel",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#f2c9d2",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "groen-pastel",
    label: "Groen pastel",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#d9e8c9",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-pastelblauw",
    label: "Pastelblauw",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#d9e8f4",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-pastelgeel",
    label: "Pastelgeel",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#f8e9a5",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-pastellila",
    label: "Pastellila",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#ded2ea",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-pastelperzik",
    label: "Pastelperzik",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#f5d1bd",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-pastelmint",
    label: "Pastelmint",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#d5eadc",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-pastelzalm",
    label: "Pastelzalm",
    allowedStyles: ["vanille-creme"],
    swatchColor: "#f3bbb1",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "naked-naturel",
    label: "Naturel naked afwerking",
    allowedStyles: ["naked"],
    swatchColor: "#f5efe3",
    swatchBorder: "#d3bfa6",
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
    id: "marsepein-icing-band",
    label: "Marsepein/icing band",
    description: "Standaard rand bij klassieke bruidstaarten.",
    allowedStyles: ["klassiek"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "geen-rand",
    label: "Standaard geen rand",
    description: "Standaard bij crème en naked taarten.",
    allowedStyles: ["vanille-creme", "naked"],
    price: { mode: "included", amount: 0 },
  },
  {
    id: "creme-parelrand",
    label: "Creme Bolletjesrand",
    price: { mode: "perPerson", amount: 0.15 },
  },
  {
    id: "parelrand",
    label: "Parelrand",
    description: "Kies goud, zilver, brons of ivory.",
    allowedStyles: ["klassiek"],
    price: { mode: "perPerson", amount: 0.2 },
  },
  {
    id: "marsepeinrozen-zonder-blad",
    label: "Kleine marsepeinroosjes zonder blad",
    description: "Geef het aantal roosjes op.",
    price: { mode: "fixed", amount: 1.5, label: "per roosje" },
    quantityLabel: "Aantal roosjes",
  },
  {
    id: "marsepeinrozen-met-blad",
    label: "Kleine marsepeinroosjes met groen blad",
    description: "Geef het aantal roosjes op.",
    price: { mode: "fixed", amount: 1.5, label: "per roosje" },
    quantityLabel: "Aantal roosjes",
  },
  {
    id: "grote-marsepeinrozen-zonder-blad",
    label: "Grote marsepeinrozen zonder blad",
    description: "Grote rozen, groter zichtbaar in de schets.",
    price: { mode: "fixed", amount: 4.5, label: "per roos" },
    quantityLabel: "Aantal rozen",
  },
  {
    id: "grote-marsepeinrozen-met-blad",
    label: "Grote marsepeinrozen met groen blad",
    description: "Grote rozen, groter zichtbaar in de schets.",
    price: { mode: "fixed", amount: 4.5, label: "per roos" },
    quantityLabel: "Aantal rozen",
  },
  {
    id: "gipskruid",
    label: "Gipskruid",
    description: "Kleine witte bloemetjes bij de bloemdecoratie.",
    price: { mode: "perPerson", amount: 0.25 },
  },
  {
    id: "echte-bloemen",
    label: "Echte bloemen",
    description: "Zelf aanleveren, plaatsing naar keuze.",
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
  {
    id: "bruidspaartje",
    label: "Bruidspaartje",
    price: { mode: "fixed", amount: 10, label: "per taart" },
    selectionGroup: "extraTopper",
  },
  {
    id: "topper-karton",
    label: "Topper karton (goud/zilver/hout/zwart)",
    description: "Ik kies een topper van Strik.",
    price: { mode: "fixed", amount: 5, label: "per taart" },
    selectionGroup: "mainTopper",
  },
  {
    id: "topper-zelf-aanleveren",
    label: "Ik lever een eigen topper aan",
    description: "Gratis.",
    price: { mode: "included", amount: 0 },
    selectionGroup: "mainTopper",
  },
  {
    id: "chocolade-initialen-geschreven",
    label: "Chocolade initialen geschreven",
    description: "Letters in opmerkingen zetten.",
    price: { mode: "fixed", amount: 3.5, label: "per taart" },
    selectionGroup: "initials",
  },
  {
    id: "chocolade-initialen-schildje",
    label: "Chocolade initialen op schildje",
    description: "Letters in opmerkingen zetten.",
    price: { mode: "fixed", amount: 5, label: "per taart" },
    selectionGroup: "initials",
  },
  {
    id: "marsepeinen-ringen",
    label: "Marsepeinen ringen of strik",
    price: { mode: "fixed", amount: 3.5, label: "per taart" },
    selectionGroup: "extraTopper",
  },
];

export const emptyContactDetails: ContactDetails = {
  names: "",
  surname: "",
  recognitionCode: "",
  email: "",
  phone: "",
  weddingDate: "",
  deliveryDate: "",
  deliveryMethod: "pickup",
  deliveryAddress: "",
  invoiceName: "",
  invoiceEmail: "",
  notes: "",
};

export const initialWeddingCakeConfig: WeddingCakeConfig = {
  styleId: "",
  sizeId: "",
  fillingId: "",
  layerFillingIds: {},
  colorId: "",
  layerColorIds: {},
  layoutId: "",
  layerLayoutIds: {},
  decorationIds: [],
  decorationQuantities: {},
  decorationColorNotes: {},
  decorationNotes: "",
  decorationExtraNotes: [],
  decorationSurcharges: [],
  topperIds: [],
  topperInitialsText: "",
  topperNotes: "",
  topperSurcharges: [],
  paid: false,
  completed: false,
  contact: emptyContactDetails,
};

export function isOptionAllowedForStyle(
  option: StudioOption,
  styleId: CakeStyleId | ""
) {
  if (!styleId) return false;
  return !option.allowedStyles || option.allowedStyles.includes(styleId);
}

export function isLayoutAllowedForStyle(
  option: StudioOption,
  styleId: CakeStyleId | ""
) {
  return isOptionAllowedForStyle(option, styleId);
}
