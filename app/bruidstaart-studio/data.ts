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
    label: "Lichtroze",
    allowedStyles: ["klassiek"],
    swatchColor: "#f7c8d4",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-ivoor",
    label: "Ivoor",
    allowedStyles: ["klassiek"],
    swatchColor: "#f6ead2",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-champagne",
    label: "Champagne",
    allowedStyles: ["klassiek"],
    swatchColor: "#ead0a4",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-blush",
    label: "Blush",
    allowedStyles: ["klassiek"],
    swatchColor: "#efd0c9",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-oudroze",
    label: "Oudroze",
    allowedStyles: ["klassiek"],
    swatchColor: "#c98890",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-roze",
    label: "Roze",
    allowedStyles: ["klassiek"],
    swatchColor: "#e78aa7",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-rood",
    label: "Rood",
    allowedStyles: ["klassiek"],
    swatchColor: "#c9363b",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-bordeaux",
    label: "Bordeaux",
    allowedStyles: ["klassiek"],
    swatchColor: "#7f2032",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-lila",
    label: "Lila",
    allowedStyles: ["klassiek"],
    swatchColor: "#c4a6dd",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-paars",
    label: "Paars",
    allowedStyles: ["klassiek"],
    swatchColor: "#8060aa",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-lichtblauw",
    label: "Lichtblauw",
    allowedStyles: ["klassiek"],
    swatchColor: "#b8dcec",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-blauw",
    label: "Blauw",
    allowedStyles: ["klassiek"],
    swatchColor: "#438bc7",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-donkerblauw",
    label: "Donkerblauw",
    allowedStyles: ["klassiek"],
    swatchColor: "#1c3f72",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-mintgroen",
    label: "Mintgroen",
    allowedStyles: ["klassiek"],
    swatchColor: "#a7d6c2",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-sage",
    label: "Sage",
    allowedStyles: ["klassiek"],
    swatchColor: "#aebd9a",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-eucalyptus",
    label: "Eucalyptus",
    allowedStyles: ["klassiek"],
    swatchColor: "#7e9b8b",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-groen",
    label: "Groen",
    allowedStyles: ["klassiek"],
    swatchColor: "#5f9b62",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-geel",
    label: "Geel",
    allowedStyles: ["klassiek"],
    swatchColor: "#f0cf44",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-oranje",
    label: "Oranje",
    allowedStyles: ["klassiek"],
    swatchColor: "#e58a48",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-terracotta",
    label: "Terracotta",
    allowedStyles: ["klassiek"],
    swatchColor: "#b7664d",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-zwart",
    label: "Zwart",
    allowedStyles: ["klassiek"],
    swatchColor: "#282828",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "klassiek-goud",
    label: "Goud",
    allowedStyles: ["klassiek"],
    swatchColor: "#d3a846",
    price: { mode: "included", amount: 0 },
  },
];

export const colorOptions: StudioOption[] = [
  {
    id: "marsepein-kleur",
    label: "Marsepein kleur",
    description: "Gebroken witte basiskleur.",
    allowedStyles: ["klassiek"],
    swatchColor: "#f3ead8",
    swatchBorder: "#dacbb4",
    price: { mode: "included", amount: 0 },
  },
  {
    id: "icing-kleur",
    label: "Icing kleur",
    description: "Heldere witte basis.",
    allowedStyles: ["klassiek"],
    swatchColor: "#fffdf8",
    swatchBorder: "#d9d0c4",
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
    label: "Crèmekleurige parelrand",
    price: { mode: "perPerson", amount: 0.15 },
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
    description: "Grote rozen, ongeveer 3x zo groot in de schets.",
    price: { mode: "fixed", amount: 4.5, label: "per roos" },
    quantityLabel: "Aantal rozen",
  },
  {
    id: "grote-marsepeinrozen-met-blad",
    label: "Grote marsepeinrozen met groen blad",
    description: "Grote rozen, ongeveer 3x zo groot in de schets.",
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
