import type { Ingredient, RecipeUnit } from "./types";

type HefeOrderRow = [
  name: string,
  packageSize: string,
  articleNumber: string,
  lastPrice: number,
  note: string,
];

export type HefeOrderItem = {
  id: string;
  name: string;
  packageSize: string;
  articleNumber: string;
  recipeUnit: RecipeUnit;
  lastPrice: number;
  pricePerBaseUnit: number;
  note: string;
};

const rawHefeOrderRows: HefeOrderRow[] = [
  ["F+S Sahne 33% 10kg Eimer - Slagroom 33% onges", "EI 10 KG", "108", 3.19, ""],
  ["TK-C.Dough Classic L 10kg", "KT 10 KG", "1100", 7.75, ""],
  ['TK-C.Dough choc.chips "S"', "KT 10 KG", "1109", 8.25, ""],
  ["TK-RF Zitronensaft 500g", "KT 12 PG", "2088", 2.05, ""],
  ["TK-Boiron Passionsfru.Püree", "PG 1 KG", "2155", 10.4, ""],
  ["H-Milch 3,5% Prago 10L Box", "PG 10 LI", "437", 0.79, ""],
  ["Kristalsuiker extra fijn", "1 kg", "5305", 0.65, ""],
  ["Cremodan Super", "EI 5 KG", "9976", 0, ""],
  ["Cremodan SE 30", "EI 5 KG", "9978", 28.78, ""],
  ["Cremodan ES", "EI 5 KG", "9980", 0, ""],
  ["TK-CA Bio-Zitronensaft 12x1kg", "KT 12 KG", "2241", 2.5, ""],
  ["Toschi Amarena Variegato 4kg", "DS 4 KG", "399723", 6.95, ""],
  ["Cesarin Variegato Himbeer mit Stücke 3,5kg", "EI 3.5 KG", "410177", 12.09, ""],
  ["DA Eisbind.Cortina 3673", "EI 5.5 KG", "20854", 5.57, ""],
  ["FAB Varieg.Peanuts 50C", "EI 4.20 KG", "40804", 13.85, ""],
  ["Fugar Susanna 41247 4kg", "EI 4 KG", "42410", 8.06, ""],
  ["Elenka Bonif.Agrolina CF 190", "FL .5 KG", "41967", 53.7, ""],
  ["Elenka Agrolina Zitrone 2,75kg", "FL 2.75 KG", "41971", 22.5, ""],
  ["Elenka Caffe Kof Kof", "FL 4 KG", "41975", 27.4, ""],
  ["IC Joyquick Perou (5x1,8kg)", "KT 9 KG", "10932", 26.67, ""],
  ["IC Joypaste Pistazien 100%", "EI 5 KG", "10977", 48.71, ""],
  ["IC Joypaste Biscotto", "KA 1.20 KG", "10982", 13.18, ""],
  ["IC Joycream Besamemucho", "DS 5 KG", "10994", 19.47, ""],
  ["IC Joypaste Melone", "DS 1.20 KG", "10997", 11.4, ""],
  ["IC Joyquick Extra Dark (6x1.6kg)", "KT 9.60 KG", "11008", 10.57, ""],
  ["IC Joypaste white chocolate", "EI 3 KG", "11028", 12.48, ""],
  ["IC Joycream Lemonbiscotto", "EI 5 KG", "11036", 11.04, ""],
  ["IC Joyfruit Fragola", "KA 3.5 KG", "11081", 10.57, ""],
  ["IC Joyquick Wassermelone", "EI 1.25 KG", "399002", 8.86, ""],
  ["IC Joypaste Dulce de Leche", "DS 1.20 KG", "399027", 16.44, ""],
  ["*IC Joylife Frutta Stevia vegan 6,3kg Karton", "KT 6.30 KG", "399078", 13.79, ""],
  ["PREG Ciambella 58072", "DS 3 KG", "40278", 17.25, ""],
  ["PREG Weiße Schokolade 55502", "EI 5 KG", "40324", 19.14, ""],
  ["3D Gelatop Eispaste Pistazie 100% naturale 541 3kg", "EI 3 KG", "22836", 0, ""],
  ["M'3 Blutorange 500 08095A", "PG 1.25 KG", "40572", 15.2, ""],
  ["M'3 Quark-Pulver 08014", "PG 1 KG", "40590", 28.54, "Contract"],
  ["M'3 Soffice 06071", "DS 3 KG", "40601", 11.4, "Contract"],
  ["M'3 Yoghin 08338", "PG 1 KG", "40611", 20.69, "Contract"],
  ["M'3 Super Gelmix 06029", "PG 2 KG", "40708", 15.3, "Contract"],
  ["M'3 Fibraplus 06072", "BT 1.80 KG", "40725", 17.37, "Contract"],
  ["M'3 Fior di Lampone 14143", "DS 4 KG", "41314", 24.61, "Contract"],
  ["M'3 Fior Arancio 18091A 3kg", "DS 3 KG", "41316", 16.2, ""],
  ["M'3 Quello 14477", "DS 6 KG", "410014", 11.1, ""],
  ["M'3 Erdbeer 18047A", "DS 3 KG", "410057", 18.28, ""],
  ["M'3 Variegato Noce Pecan", "DS 5 KG", "400333", 19.31, ""],
  ["L-F Yoggisimo", "BT 2 KG", "23682", 16.9, ""],
  ["L-F Pistachio Verde", "EI 3 KG", "40108", 32.99, "€ 32,99 p/kg"],
  ["L-F Morbido 5,5 kg", "EI 5.5 KG", "40767", 5.88, ""],
  ["L-F Amarena Variegato 13Kg", "EI 13 KG", "41490", 7.95, ""],
  ["L-F Fior di Fico", "-", "41350", 15.05, ""],
  ["Prova Vaniflor 200GR", "FL 1 LI", "41991", 55, ""],
  ["112 Hörnchen m. Nussrand S5216", "KT", "41588", 0, ""],
  ["140 Hörnchen mit Streuselrand S5218", "KT", "41589", 0, ""],
  ["240 süße Hörnchen groß Karo, ohne Rand L-F Nr.37", "KT", "41732", 0, ""],
  ["Pappdeckel W550 schwarzer Rand - lizenzierte Serviceverpackung", "KT 600 ST", "42177", 0, ""],
  ["Eisspaten Holz-Kunststoff (660)", "PG 660 ST", "27292", 8.5, ""],
  ["Eisspaten Reusable bunt 9,5cm 1kg (ca. 613 Stück)", "BT 1 KG", "42200", 4.95, ""],
  ["Pappdeckel 10MG/20C weißer Rand Holz Spaten - lizenzierte Serviceverpackung", "KT 1260 ST", "42354", 0, ""],
  ["Eisbecher weiss GE-8 lizenzierte Serviceverpackung", "KT 2000 ST", "103461", 0, ""],
  ['Eisbecher "Strik" 10MG inkl. EWK-Gebühr', "KT 1400 ST", "135470", 0, ""],
  ['Eisbecher "Strik" 108C inkl. EWK-Gebühr', "KT 2000 ST", "135471", 0, ""],
  ['Eisbecher "Strik" M3 inkl. EWK-Gebühr', "KT 960 ST", "135472", 0, ""],
  ["Pulisano Pistazienmark 100%", "DS 3 KG", "42398", 39.55, "Deze alleen bestellen als 40108 niet leverbaar is"],
  ["Inuline", "25kg", "4723", 3.88, ""],
  ["Glukose Roquette", "ZK", "0005384", 1.39, ""],
  ["Fijne hazelnoten 2-4mm", "10kg", "10442", 14.75, ""],
  ["Butter 10kg karton", "10kg", "0000713", 4.25, ""],
  ["Dextrose Meritose 200", "25kg", "5321", 0.89, ""],
  ["Carpi lube tube Fett 113gr", "113gr", "287049", 8.9, ""],
];

function createHefeId(articleNumber: string) {
  return `hefe-${articleNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function hefeRecipeUnit(name: string, packageSize: string): RecipeUnit {
  if (/\bLI\b|\bl\b|liter/i.test(packageSize)) return "liter";
  if (/\bST\b|stuk|stuks/i.test(packageSize)) return "stuk";
  if (/hörnchen|deckel|spaten|becher/i.test(name)) return "stuk";

  return "gram";
}

function baseUnitFactor(unit: RecipeUnit) {
  return unit === "gram" || unit === "ml" ? 1000 : 1;
}

export const hefeOrderItems: HefeOrderItem[] = rawHefeOrderRows.map(
  ([name, packageSize, articleNumber, lastPrice, note]) => {
    const recipeUnit = hefeRecipeUnit(name, packageSize);

    return {
      id: createHefeId(articleNumber),
      name,
      packageSize,
      articleNumber,
      recipeUnit,
      lastPrice,
      pricePerBaseUnit: Number(
        (lastPrice / baseUnitFactor(recipeUnit)).toFixed(6)
      ),
      note,
    };
  }
);

export const hefeIngredients: Ingredient[] = hefeOrderItems.map((item) => ({
  id: item.id,
  name: item.name,
  supplier: "Hefe van Haag",
  supplierArticleNumber: item.articleNumber,
  packageSize: item.packageSize,
  recipeUnit: item.recipeUnit,
  lastPrice: item.lastPrice,
  previousPrice: item.lastPrice,
  pricePerBaseUnit: item.pricePerBaseUnit,
  allergens: [],
  lastUpdated: "2026-06-25",
  status: "active",
  lastInvoice: "Hefe bestellijst 2026",
  aliases: [
    item.name,
    item.articleNumber,
    `Hefe ${item.articleNumber}`,
  ],
}));
