import type { Ingredient, InvoiceImport, Recipe } from "./types";

export const bakeryIcons = {
  bakkerij: "/apps%20strik_Bakkerij.svg",
  recepturen: "/apps%20strik_recepten.svg",
};

export const productGroups: string[] = [
  "Vullingen",
  "Bodems & beslag",
  "Petit Gateau",
  "Gebak"
];

export const ingredients: Ingredient[] = [
  {
    "id": "fr001",
    "name": "Aardbeien Royal Berry",
    "supplier": "Roelofsen",
    "supplierArticleNumber": "5013",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.75,
    "previousPrice": 4.75,
    "pricePerBaseUnit": 0.0047,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Aardbeien Royal Berry",
      "FR001"
    ]
  },
  {
    "id": "ge001",
    "name": "Abrikozengelei Jelfix",
    "supplier": "Beko",
    "supplierArticleNumber": "8004924",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.6638,
    "previousPrice": 2.6638,
    "pricePerBaseUnit": 0.0027,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Abrikozengelei Jelfix",
      "GE001"
    ]
  },
  {
    "id": "fr002",
    "name": "Abrikozenmoes",
    "supplier": "Beko",
    "supplierArticleNumber": "8055418",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.08,
    "previousPrice": 5.08,
    "pricePerBaseUnit": 0.0051,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Abrikozenmoes",
      "FR002"
    ]
  },
  {
    "id": "fr003",
    "name": "Abrikozenpulp",
    "supplier": "Beko",
    "supplierArticleNumber": "9089013",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.978,
    "previousPrice": 1.978,
    "pricePerBaseUnit": 0.002,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Abrikozenpulp",
      "FR003"
    ]
  },
  {
    "id": "fr004",
    "name": "Abrikozenpuree",
    "supplier": "Beko",
    "supplierArticleNumber": "9054312",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 8.3117,
    "previousPrice": 8.3117,
    "pricePerBaseUnit": 0.0083,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Abrikozenpuree",
      "FR004"
    ]
  },
  {
    "id": "no001",
    "name": "Amandel Bitterkoekspijs",
    "supplier": "Beko",
    "supplierArticleNumber": "8030139",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.388,
    "previousPrice": 7.388,
    "pricePerBaseUnit": 0.0074,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Amandel Bitterkoekspijs",
      "NO001"
    ]
  },
  {
    "id": "no002",
    "name": "Amandelen opleg/split",
    "supplier": "Beko",
    "supplierArticleNumber": "8036900",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 8.45,
    "previousPrice": 8.45,
    "pricePerBaseUnit": 0.0084,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Amandelen opleg/split",
      "NO002"
    ]
  },
  {
    "id": "no003",
    "name": "Amandelmeel",
    "supplier": "Beko",
    "supplierArticleNumber": "8036943",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 8.25,
    "previousPrice": 8.25,
    "pricePerBaseUnit": 0.0083,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Amandelmeel",
      "NO003"
    ]
  },
  {
    "id": "no004",
    "name": "Amandelschaafsel gebleekt",
    "supplier": "Beko",
    "supplierArticleNumber": "80368833",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 9.1,
    "previousPrice": 9.1,
    "pricePerBaseUnit": 0.0091,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Amandelschaafsel gebleekt",
      "NO004"
    ]
  },
  {
    "id": "no005",
    "name": "Amandelspijs grof",
    "supplier": "Beko",
    "supplierArticleNumber": "9041853",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.0,
    "previousPrice": 6.0,
    "pricePerBaseUnit": 0.006,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Amandelspijs grof",
      "NO005"
    ]
  },
  {
    "id": "fr005",
    "name": "Amarena Kersen",
    "supplier": "Beko",
    "supplierArticleNumber": "9108616",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.25,
    "previousPrice": 7.25,
    "pricePerBaseUnit": 0.0073,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Amarena Kersen",
      "FR005"
    ]
  },
  {
    "id": "ba001",
    "name": "Ammonium",
    "supplier": "Beko",
    "supplierArticleNumber": "9088782",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.335,
    "previousPrice": 4.335,
    "pricePerBaseUnit": 0.0043,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Ammonium",
      "BA001"
    ]
  },
  {
    "id": "fr006",
    "name": "Ananas",
    "supplier": "Beko",
    "supplierArticleNumber": "8037079",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.5,
    "previousPrice": 2.5,
    "pricePerBaseUnit": 0.0025,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Ananas",
      "FR006"
    ]
  },
  {
    "id": "fr010",
    "name": "Appelblokjes",
    "supplier": "Beko",
    "supplierArticleNumber": "8037068",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.75,
    "previousPrice": 1.75,
    "pricePerBaseUnit": 0.0018,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Appelblokjes",
      "FR010"
    ]
  },
  {
    "id": "fr008",
    "name": "Appelparten",
    "supplier": "Beko",
    "supplierArticleNumber": "9052202",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.0,
    "previousPrice": 3.0,
    "pricePerBaseUnit": 0.003,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Appelparten",
      "FR008"
    ]
  },
  {
    "id": "fr009",
    "name": "Appelparten half",
    "supplier": "Roelofsen",
    "supplierArticleNumber": "FR009",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.5,
    "previousPrice": 2.5,
    "pricePerBaseUnit": 0.0025,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Appelparten half",
      "FR009"
    ]
  },
  {
    "id": "fr010",
    "name": "Appelparten Italiaans",
    "supplier": "Beko",
    "supplierArticleNumber": "8036679",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.73,
    "previousPrice": 1.73,
    "pricePerBaseUnit": 0.0017,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Appelparten Italiaans",
      "FR010"
    ]
  },
  {
    "id": "ba002",
    "name": "Bakpoeder Hercules",
    "supplier": "Beko",
    "supplierArticleNumber": "8028417",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.392,
    "previousPrice": 4.392,
    "pricePerBaseUnit": 0.0044,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Bakpoeder Hercules",
      "BA002"
    ]
  },
  {
    "id": "ve001",
    "name": "Banketolie",
    "supplier": "Beko",
    "supplierArticleNumber": "8036437",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.4373,
    "previousPrice": 4.4373,
    "pricePerBaseUnit": 0.0044,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Banketolie",
      "VE001"
    ]
  },
  {
    "id": "su001",
    "name": "Basterdsuiker donker",
    "supplier": "Beko",
    "supplierArticleNumber": "9107955",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.15,
    "previousPrice": 1.15,
    "pricePerBaseUnit": 0.0011,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Basterdsuiker donker",
      "SU001"
    ]
  },
  {
    "id": "su002",
    "name": "Basterdsuiker geel",
    "supplier": "Beko",
    "supplierArticleNumber": "8041342",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.13,
    "previousPrice": 1.13,
    "pricePerBaseUnit": 0.0011,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Basterdsuiker geel",
      "SU002"
    ]
  },
  {
    "id": "su003",
    "name": "Basterdsuiker wit",
    "supplier": "Beko",
    "supplierArticleNumber": "8041157",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.1,
    "previousPrice": 1.1,
    "pricePerBaseUnit": 0.0011,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Basterdsuiker wit",
      "SU003"
    ]
  },
  {
    "id": "ge002",
    "name": "Bindmiddel met appel",
    "supplier": "Beko",
    "supplierArticleNumber": "8028992",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.09,
    "previousPrice": 6.09,
    "pricePerBaseUnit": 0.0061,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Bindmiddel met appel",
      "GE002"
    ]
  },
  {
    "id": "su004",
    "name": "Blanke Stroop",
    "supplier": "Beko",
    "supplierArticleNumber": "8041360",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.15,
    "previousPrice": 2.15,
    "pricePerBaseUnit": 0.0022,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Blanke Stroop",
      "SU004"
    ]
  },
  {
    "id": "al001",
    "name": "Brandewijn",
    "supplier": "Beko",
    "supplierArticleNumber": "8048459",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 15.21,
    "previousPrice": 15.21,
    "pricePerBaseUnit": 0.0152,
    "allergens": [
      "Alcohol"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Brandewijn",
      "AL001"
    ]
  },
  {
    "id": "ch001",
    "name": "Brownieblokjes",
    "supplier": "Strik",
    "supplierArticleNumber": "CH001",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 15.6,
    "previousPrice": 15.6,
    "pricePerBaseUnit": 0.0156,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Brownieblokjes",
      "CH001"
    ]
  },
  {
    "id": "ch002",
    "name": "Cacaopoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "9191958",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 13.8,
    "previousPrice": 13.8,
    "pricePerBaseUnit": 0.0138,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Cacaopoeder",
      "CH002"
    ]
  },
  {
    "id": "ba003",
    "name": "Cake mix",
    "supplier": "Zeelandia",
    "supplierArticleNumber": "10008630",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.76,
    "previousPrice": 2.76,
    "pricePerBaseUnit": 0.0028,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Cake mix",
      "BA003"
    ]
  },
  {
    "id": "su005",
    "name": "Caramel",
    "supplier": "Strik",
    "supplierArticleNumber": "SU005",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.09,
    "previousPrice": 6.09,
    "pricePerBaseUnit": 0.0061,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Caramel",
      "SU005"
    ]
  },
  {
    "id": "kr001",
    "name": "Cardamonzaad gemalen",
    "supplier": "Beko",
    "supplierArticleNumber": "9047948",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 39.4,
    "previousPrice": 39.4,
    "pricePerBaseUnit": 0.0394,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Cardamonzaad gemalen",
      "KR001"
    ]
  },
  {
    "id": "no006",
    "name": "Choco Hazelnoot Gesuikerd",
    "supplier": "Beko",
    "supplierArticleNumber": "9152748",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 14.98,
    "previousPrice": 14.98,
    "pricePerBaseUnit": 0.015,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Choco Hazelnoot Gesuikerd",
      "NO006"
    ]
  },
  {
    "id": "ch003",
    "name": "Chocolade schaafsel puur",
    "supplier": "Beko",
    "supplierArticleNumber": "9122397",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 18.23,
    "previousPrice": 18.23,
    "pricePerBaseUnit": 0.0182,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Chocolade schaafsel puur",
      "CH003"
    ]
  },
  {
    "id": "ch004",
    "name": "Chocolade schaafsel wit",
    "supplier": "Beko",
    "supplierArticleNumber": "8046120",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.29,
    "previousPrice": 7.29,
    "pricePerBaseUnit": 0.0073,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Chocolade schaafsel wit",
      "CH004"
    ]
  },
  {
    "id": "de001",
    "name": "Chocolade schildje deco",
    "supplier": "Strik",
    "supplierArticleNumber": "DE001",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 15.0,
    "previousPrice": 15.0,
    "pricePerBaseUnit": 0.015,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Chocolade schildje deco",
      "DE001"
    ]
  },
  {
    "id": "kr002",
    "name": "Citroenpoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "8038354",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 10.192,
    "previousPrice": 10.192,
    "pricePerBaseUnit": 0.0102,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Citroenpoeder",
      "KR002"
    ]
  },
  {
    "id": "kr003",
    "name": "Citroenrasp zonder kleur",
    "supplier": "Beko",
    "supplierArticleNumber": "8046618",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.908,
    "previousPrice": 3.908,
    "pricePerBaseUnit": 0.0039,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Citroenrasp zonder kleur",
      "KR003"
    ]
  },
  {
    "id": "ch005",
    "name": "Crisppearls Dark",
    "supplier": "Beko",
    "supplierArticleNumber": "9191780",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 20.575,
    "previousPrice": 20.575,
    "pricePerBaseUnit": 0.0206,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Crisppearls Dark",
      "CH005"
    ]
  },
  {
    "id": "su017",
    "name": "Damcosnow poedersuiker",
    "supplier": "Beko",
    "supplierArticleNumber": "9128369",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Damcosnow poedersuiker",
      "SU017"
    ]
  },
  {
    "id": "de002",
    "name": "Decoratie luxe",
    "supplier": "Strik",
    "supplierArticleNumber": "DE002",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 25.0,
    "previousPrice": 25.0,
    "pricePerBaseUnit": 0.025,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Decoratie luxe",
      "DE002"
    ]
  },
  {
    "id": "de003",
    "name": "Decoratie simpel",
    "supplier": "Strik",
    "supplierArticleNumber": "DE003",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 15.0,
    "previousPrice": 15.0,
    "pricePerBaseUnit": 0.015,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Decoratie simpel",
      "DE003"
    ]
  },
  {
    "id": "su006",
    "name": "Dextrose",
    "supplier": "Beko",
    "supplierArticleNumber": "9201239",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.48,
    "previousPrice": 1.48,
    "pricePerBaseUnit": 0.0015,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Dextrose",
      "SU006"
    ]
  },
  {
    "id": "ei001",
    "name": "Eigeel vloeibaar",
    "supplier": "Beko",
    "supplierArticleNumber": "8029669",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 10.69,
    "previousPrice": 10.69,
    "pricePerBaseUnit": 0.0107,
    "allergens": [
      "Ei"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Eigeel vloeibaar",
      "EI001"
    ]
  },
  {
    "id": "su007",
    "name": "Fondant afgeslapt",
    "supplier": "Beko",
    "supplierArticleNumber": "8027658",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.206,
    "previousPrice": 1.206,
    "pricePerBaseUnit": 0.0012,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Fondant afgeslapt",
      "SU007"
    ]
  },
  {
    "id": "su008",
    "name": "Fondro fijn",
    "supplier": "Beko",
    "supplierArticleNumber": "8038219",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.152,
    "previousPrice": 2.152,
    "pricePerBaseUnit": 0.0022,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Fondro fijn",
      "SU008"
    ]
  },
  {
    "id": "fr011",
    "name": "Framboos puree",
    "supplier": "Beko",
    "supplierArticleNumber": "9054531",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 8.5717,
    "previousPrice": 8.5717,
    "pricePerBaseUnit": 0.0086,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Framboos puree",
      "FR011"
    ]
  },
  {
    "id": "fr012",
    "name": "Framboos-bes Confi",
    "supplier": "Beko",
    "supplierArticleNumber": "8003568",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.8567,
    "previousPrice": 5.8567,
    "pricePerBaseUnit": 0.0059,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Framboos-bes Confi",
      "FR012"
    ]
  },
  {
    "id": "fr013",
    "name": "Framboosgruis",
    "supplier": "Beko",
    "supplierArticleNumber": "8027097",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.321,
    "previousPrice": 5.321,
    "pricePerBaseUnit": 0.0053,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Framboosgruis",
      "FR013"
    ]
  },
  {
    "id": "ba004",
    "name": "Gebroken bitterkoekjes",
    "supplier": "Beko",
    "supplierArticleNumber": "8054772",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.7692,
    "previousPrice": 6.7692,
    "pricePerBaseUnit": 0.0068,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gebroken bitterkoekjes",
      "BA004"
    ]
  },
  {
    "id": "zu001",
    "name": "Gecondenseerde melk",
    "supplier": "AH",
    "supplierArticleNumber": "ZU001",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.4495,
    "previousPrice": 6.4495,
    "pricePerBaseUnit": 0.0064,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gecondenseerde melk",
      "ZU001"
    ]
  },
  {
    "id": "ha001",
    "name": "Gehakt half-om-half",
    "supplier": "Slager Cor",
    "supplierArticleNumber": "HA001",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 9.25,
    "previousPrice": 9.25,
    "pricePerBaseUnit": 0.0092,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gehakt half-om-half",
      "HA001"
    ]
  },
  {
    "id": "ha002",
    "name": "Gehakt rund",
    "supplier": "Slager Cor",
    "supplierArticleNumber": "HA002",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 11.25,
    "previousPrice": 11.25,
    "pricePerBaseUnit": 0.0112,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gehakt rund",
      "HA002"
    ]
  },
  {
    "id": "ha003",
    "name": "Gehakt varken",
    "supplier": "Slager Cor",
    "supplierArticleNumber": "HA003",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 8.0,
    "previousPrice": 8.0,
    "pricePerBaseUnit": 0.008,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gehakt varken",
      "HA003"
    ]
  },
  {
    "id": "al002",
    "name": "Gel Amaretto 50%",
    "supplier": "Zeelandia",
    "supplierArticleNumber": "10006023",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 21.0,
    "previousPrice": 21.0,
    "pricePerBaseUnit": 0.021,
    "allergens": [
      "Alcohol"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gel Amaretto 50%",
      "AL002"
    ]
  },
  {
    "id": "ge003",
    "name": "Gelatinepoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "8059317",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 12.63,
    "previousPrice": 12.63,
    "pricePerBaseUnit": 0.0126,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gelatinepoeder",
      "GE003"
    ]
  },
  {
    "id": "fr014",
    "name": "Gele Citroenpuree",
    "supplier": "Beko",
    "supplierArticleNumber": "9054515",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.65,
    "previousPrice": 5.65,
    "pricePerBaseUnit": 0.0057,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gele Citroenpuree",
      "FR014"
    ]
  },
  {
    "id": "no007",
    "name": "Gemengde noten",
    "supplier": "Strik",
    "supplierArticleNumber": "NO007",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 15.0,
    "previousPrice": 15.0,
    "pricePerBaseUnit": 0.015,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gemengde noten",
      "NO007"
    ]
  },
  {
    "id": "ba005",
    "name": "Gist",
    "supplier": "Beko",
    "supplierArticleNumber": "8031361",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.72,
    "previousPrice": 2.72,
    "pricePerBaseUnit": 0.0027,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Gist",
      "BA005"
    ]
  },
  {
    "id": "su009",
    "name": "Glucosepoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "9139130",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.5,
    "previousPrice": 2.5,
    "pricePerBaseUnit": 0.0025,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Glucosepoeder",
      "SU009"
    ]
  },
  {
    "id": "su010",
    "name": "Glucosestroop",
    "supplier": "Beko",
    "supplierArticleNumber": "8037720",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.2248,
    "previousPrice": 2.2248,
    "pricePerBaseUnit": 0.0022,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Glucosestroop",
      "SU010"
    ]
  },
  {
    "id": "ch006",
    "name": "Guayaquil chocolade",
    "supplier": "Beko",
    "supplierArticleNumber": "9093055",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 14.52,
    "previousPrice": 14.52,
    "pricePerBaseUnit": 0.0145,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Guayaquil chocolade",
      "CH006"
    ]
  },
  {
    "id": "no008",
    "name": "Hazelnoten gehakt",
    "supplier": "Beko",
    "supplierArticleNumber": "8036737",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 13.95,
    "previousPrice": 13.95,
    "pricePerBaseUnit": 0.0139,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Hazelnoten gehakt",
      "NO008"
    ]
  },
  {
    "id": "hf001",
    "name": "HF Appelcakevulling",
    "supplier": "Strik",
    "supplierArticleNumber": "HF001",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.2899,
    "previousPrice": 2.2899,
    "pricePerBaseUnit": 0.0023,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Appelcakevulling",
      "HF001"
    ]
  },
  {
    "id": "hf002",
    "name": "HF Appeltaartdeeg",
    "supplier": "Strik",
    "supplierArticleNumber": "HF002",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Appeltaartdeeg",
      "HF002"
    ]
  },
  {
    "id": "hf003",
    "name": "HF Appeltaartvulling",
    "supplier": "Strik",
    "supplierArticleNumber": "HF003",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Appeltaartvulling",
      "HF003"
    ]
  },
  {
    "id": "hf004",
    "name": "HF Banketbakkers room",
    "supplier": "Strik",
    "supplierArticleNumber": "HF004",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.286,
    "previousPrice": 1.286,
    "pricePerBaseUnit": 0.0013,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Banketbakkers room",
      "HF004"
    ]
  },
  {
    "id": "hf034",
    "name": "HF Bodem roomvulling",
    "supplier": "Strik",
    "supplierArticleNumber": "HF034",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.9955,
    "previousPrice": 0.9955,
    "pricePerBaseUnit": 0.001,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Bodem roomvulling",
      "HF034"
    ]
  },
  {
    "id": "hf005",
    "name": "HF Brownie beslag",
    "supplier": "Strik",
    "supplierArticleNumber": "HF005",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Brownie beslag",
      "HF005"
    ]
  },
  {
    "id": "hf006",
    "name": "HF Caramel",
    "supplier": "Strik",
    "supplierArticleNumber": "HF006",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.8151,
    "previousPrice": 2.8151,
    "pricePerBaseUnit": 0.0028,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Caramel",
      "HF006"
    ]
  },
  {
    "id": "hf007",
    "name": "HF Caramel Chocolade Creme",
    "supplier": "Strik",
    "supplierArticleNumber": "HF007",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.909,
    "previousPrice": 0.909,
    "pricePerBaseUnit": 0.0009,
    "allergens": [
      "Melk",
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Caramel Chocolade Creme",
      "HF007"
    ]
  },
  {
    "id": "hf008",
    "name": "HF Chocolade glazuur",
    "supplier": "Strik",
    "supplierArticleNumber": "HF008",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Chocolade glazuur",
      "HF008"
    ]
  },
  {
    "id": "hf035",
    "name": "HF Chocolade mousse",
    "supplier": "Strik",
    "supplierArticleNumber": "HF035",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.1307,
    "previousPrice": 5.1307,
    "pricePerBaseUnit": 0.0051,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Chocolade mousse",
      "HF035"
    ]
  },
  {
    "id": "hf009",
    "name": "HF Crumble deeg",
    "supplier": "Strik",
    "supplierArticleNumber": "HF009",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [
      "Alcohol"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Crumble deeg",
      "HF009"
    ]
  },
  {
    "id": "hf010",
    "name": "HF Framboos taart bodem",
    "supplier": "Strik",
    "supplierArticleNumber": "HF010",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Framboos taart bodem",
      "HF010"
    ]
  },
  {
    "id": "hf037",
    "name": "HF Frambozen bavarois",
    "supplier": "Strik",
    "supplierArticleNumber": "HF037",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.3599,
    "previousPrice": 6.3599,
    "pricePerBaseUnit": 0.0064,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Frambozen bavarois",
      "HF037"
    ]
  },
  {
    "id": "hf011",
    "name": "HF Frambozen Compote",
    "supplier": "Strik",
    "supplierArticleNumber": "HF011",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.205,
    "previousPrice": 5.205,
    "pricePerBaseUnit": 0.0052,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Frambozen Compote",
      "HF011"
    ]
  },
  {
    "id": "hf012",
    "name": "HF Frambozen mousse",
    "supplier": "Strik",
    "supplierArticleNumber": "HF012",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Frambozen mousse",
      "HF012"
    ]
  },
  {
    "id": "hf040",
    "name": "HF Hazelnootroom",
    "supplier": "Strik",
    "supplierArticleNumber": "HF040",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.7763,
    "previousPrice": 5.7763,
    "pricePerBaseUnit": 0.0058,
    "allergens": [
      "Melk",
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Hazelnootroom",
      "HF040"
    ]
  },
  {
    "id": "hf013",
    "name": "HF Gebonden Kersen",
    "supplier": "Strik",
    "supplierArticleNumber": "HF013",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Gebonden Kersen",
      "HF013"
    ]
  },
  {
    "id": "hf039",
    "name": "HF Gezouten Caramel",
    "supplier": "Strik",
    "supplierArticleNumber": "HF039",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.9371,
    "previousPrice": 4.9371,
    "pricePerBaseUnit": 0.0049,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Gezouten Caramel",
      "HF039"
    ]
  },
  {
    "id": "hf014",
    "name": "HF Hardewener deeg",
    "supplier": "Strik",
    "supplierArticleNumber": "HF014",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.3793,
    "previousPrice": 2.3793,
    "pricePerBaseUnit": 0.0024,
    "allergens": [
      "Gluten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Hardewener deeg",
      "HF014"
    ]
  },
  {
    "id": "hf015",
    "name": "HF Hazelnootschuim",
    "supplier": "Strik",
    "supplierArticleNumber": "HF015",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Hazelnootschuim",
      "HF015"
    ]
  },
  {
    "id": "hf016",
    "name": "HF Korstplakken",
    "supplier": "Strik",
    "supplierArticleNumber": "HF016",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Korstplakken",
      "HF016"
    ]
  },
  {
    "id": "hf017",
    "name": "HF Krokante Vlaaibodemdeeg",
    "supplier": "Strik",
    "supplierArticleNumber": "HF017",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.0279,
    "previousPrice": 3.0279,
    "pricePerBaseUnit": 0.003,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Krokante Vlaaibodemdeeg",
      "HF017"
    ]
  },
  {
    "id": "hf018",
    "name": "HF Lemon merengue schuim",
    "supplier": "Strik",
    "supplierArticleNumber": "HF018",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.9431,
    "previousPrice": 1.9431,
    "pricePerBaseUnit": 0.0019,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Lemon merengue schuim",
      "HF018"
    ]
  },
  {
    "id": "hf019",
    "name": "HF Mango Cremeux",
    "supplier": "Strik",
    "supplierArticleNumber": "HF019",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.0216,
    "previousPrice": 6.0216,
    "pricePerBaseUnit": 0.006,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Mango Cremeux",
      "HF019"
    ]
  },
  {
    "id": "hf020",
    "name": "HF Mango-passie mousse GATEAU",
    "supplier": "Strik",
    "supplierArticleNumber": "HF020",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.1716,
    "previousPrice": 6.1716,
    "pricePerBaseUnit": 0.0062,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Mango-passie mousse GATEAU",
      "HF020"
    ]
  },
  {
    "id": "hf036",
    "name": "HF Mango-passie mousse GEBAK",
    "supplier": "Strik",
    "supplierArticleNumber": "HF036",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Mango-passie mousse GEBAK",
      "HF036"
    ]
  },
  {
    "id": "hf021",
    "name": "HF Marshmallow",
    "supplier": "Strik",
    "supplierArticleNumber": "HF021",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Marshmallow",
      "HF021"
    ]
  },
  {
    "id": "hf022",
    "name": "HF Mokka",
    "supplier": "Strik",
    "supplierArticleNumber": "HF022",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Mokka",
      "HF022"
    ]
  },
  {
    "id": "hf023",
    "name": "HF Nougatine",
    "supplier": "Strik",
    "supplierArticleNumber": "HF023",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Nougatine",
      "HF023"
    ]
  },
  {
    "id": "hf024",
    "name": "HF Plaatcake",
    "supplier": "Strik",
    "supplierArticleNumber": "HF024",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.504,
    "previousPrice": 2.504,
    "pricePerBaseUnit": 0.0025,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Plaatcake",
      "HF024"
    ]
  },
  {
    "id": "hf025",
    "name": "HF Rode Glacage",
    "supplier": "Strik",
    "supplierArticleNumber": "HF025",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Rode Glacage",
      "HF025"
    ]
  },
  {
    "id": "hf026",
    "name": "HF Room/Botercreme",
    "supplier": "Strik",
    "supplierArticleNumber": "HF026",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.6279,
    "previousPrice": 2.6279,
    "pricePerBaseUnit": 0.0026,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Room/Botercreme",
      "HF026"
    ]
  },
  {
    "id": "hf027",
    "name": "HF Schuimplakken",
    "supplier": "Strik",
    "supplierArticleNumber": "HF027",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Schuimplakken",
      "HF027"
    ]
  },
  {
    "id": "hf028",
    "name": "HF Slagroom opgeklopt",
    "supplier": "Strik",
    "supplierArticleNumber": "HF028",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Slagroom opgeklopt",
      "HF028"
    ]
  },
  {
    "id": "hf029",
    "name": "HF Sloffendeeg",
    "supplier": "Strik",
    "supplierArticleNumber": "HF029",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.5506,
    "previousPrice": 2.5506,
    "pricePerBaseUnit": 0.0026,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Sloffendeeg",
      "HF029"
    ]
  },
  {
    "id": "hf030",
    "name": "HF Soezenbeslag BB",
    "supplier": "Strik",
    "supplierArticleNumber": "HF030",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.4114,
    "previousPrice": 2.4114,
    "pricePerBaseUnit": 0.0024,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Soezenbeslag BB",
      "HF030"
    ]
  },
  {
    "id": "hf031",
    "name": "HF Vlaaibodem",
    "supplier": "Strik",
    "supplierArticleNumber": "HF031",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.689,
    "previousPrice": 2.689,
    "pricePerBaseUnit": 0.0027,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Vlaaibodem",
      "HF031"
    ]
  },
  {
    "id": "hf032",
    "name": "HF Wortelbeslag",
    "supplier": "Strik",
    "supplierArticleNumber": "HF032",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0,
    "previousPrice": 0.0,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Wortelbeslag",
      "HF032"
    ]
  },
  {
    "id": "hf038",
    "name": "HF Yoghurt bavarois GATEAU",
    "supplier": "Strik",
    "supplierArticleNumber": "HF038",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.7352,
    "previousPrice": 4.7352,
    "pricePerBaseUnit": 0.0047,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Yoghurt bavarois GATEAU",
      "HF038"
    ]
  },
  {
    "id": "hf033",
    "name": "HF Zwitserse room",
    "supplier": "Strik",
    "supplierArticleNumber": "HF033",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.5167,
    "previousPrice": 2.5167,
    "pricePerBaseUnit": 0.0025,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "HF Zwitserse room",
      "HF033"
    ]
  },
  {
    "id": "su011",
    "name": "Inulinepoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "9139148",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.19,
    "previousPrice": 7.19,
    "pricePerBaseUnit": 0.0072,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Inulinepoeder",
      "SU011"
    ]
  },
  {
    "id": "su012",
    "name": "Invertsuiker",
    "supplier": "Beko",
    "supplierArticleNumber": "8038234",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.216,
    "previousPrice": 2.216,
    "pricePerBaseUnit": 0.0022,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Invertsuiker",
      "SU012"
    ]
  },
  {
    "id": "ge004",
    "name": "Jelfix Blanke Gelei",
    "supplier": "Beko",
    "supplierArticleNumber": "8003567",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.02,
    "previousPrice": 4.02,
    "pricePerBaseUnit": 0.004,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Jelfix Blanke Gelei",
      "GE004"
    ]
  },
  {
    "id": "kr004",
    "name": "Kaneel",
    "supplier": "Beko",
    "supplierArticleNumber": "8032629",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 16.7,
    "previousPrice": 16.7,
    "pricePerBaseUnit": 0.0167,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Kaneel",
      "KR004"
    ]
  },
  {
    "id": "ba006",
    "name": "Kaneelkruimels",
    "supplier": "Strik",
    "supplierArticleNumber": "BA006",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.83,
    "previousPrice": 3.83,
    "pricePerBaseUnit": 0.0038,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Kaneelkruimels",
      "BA006"
    ]
  },
  {
    "id": "zu002",
    "name": "Karnemelk",
    "supplier": "AH",
    "supplierArticleNumber": "ZU002",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.99,
    "previousPrice": 0.99,
    "pricePerBaseUnit": 0.001,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Karnemelk",
      "ZU002"
    ]
  },
  {
    "id": "ha004",
    "name": "Ketjap manis",
    "supplier": "AH",
    "supplierArticleNumber": "HA004",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.96,
    "previousPrice": 7.96,
    "pricePerBaseUnit": 0.008,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Ketjap manis",
      "HA004"
    ]
  },
  {
    "id": "kr005",
    "name": "Kleurstof eigeel",
    "supplier": "Beko",
    "supplierArticleNumber": "8046562",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 41.05,
    "previousPrice": 41.05,
    "pricePerBaseUnit": 0.0411,
    "allergens": [
      "Ei"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Kleurstof eigeel",
      "KR005"
    ]
  },
  {
    "id": "kr006",
    "name": "Kleurstof knalrood",
    "supplier": "Beko",
    "supplierArticleNumber": "8046584",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 41.05,
    "previousPrice": 41.05,
    "pricePerBaseUnit": 0.0411,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Kleurstof knalrood",
      "KR006"
    ]
  },
  {
    "id": "kr007",
    "name": "Kleurstof roze",
    "supplier": "Beko",
    "supplierArticleNumber": "8046473",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 41.05,
    "previousPrice": 41.05,
    "pricePerBaseUnit": 0.0411,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Kleurstof roze",
      "KR007"
    ]
  },
  {
    "id": "ba007",
    "name": "Koekkruimels",
    "supplier": "Strik",
    "supplierArticleNumber": "BA007",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.0,
    "previousPrice": 2.0,
    "pricePerBaseUnit": 0.002,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Koekkruimels",
      "BA007"
    ]
  },
  {
    "id": "ov001",
    "name": "Koolzuur",
    "supplier": "Beko",
    "supplierArticleNumber": "9088791",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.87,
    "previousPrice": 2.87,
    "pricePerBaseUnit": 0.0029,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Koolzuur",
      "OV001"
    ]
  },
  {
    "id": "ba008",
    "name": "Korstdeeg rb",
    "supplier": "Beko",
    "supplierArticleNumber": "8026778",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.126,
    "previousPrice": 6.126,
    "pricePerBaseUnit": 0.0061,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Korstdeeg rb",
      "BA008"
    ]
  },
  {
    "id": "ge005",
    "name": "Koudbindmiddel",
    "supplier": "Beko",
    "supplierArticleNumber": "GE005",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 11.0,
    "previousPrice": 11.0,
    "pricePerBaseUnit": 0.011,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Koudbindmiddel",
      "GE005"
    ]
  },
  {
    "id": "su013",
    "name": "Kristalsuiker extra fijn",
    "supplier": "Hefe",
    "supplierArticleNumber": "5309",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.65,
    "previousPrice": 0.65,
    "pricePerBaseUnit": 0.0006,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Kristalsuiker extra fijn",
      "SU013"
    ]
  },
  {
    "id": "kr008",
    "name": "Kruidnagelen gemalen",
    "supplier": "Beko",
    "supplierArticleNumber": "8033033",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 24.25,
    "previousPrice": 24.25,
    "pricePerBaseUnit": 0.0243,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Kruidnagelen gemalen",
      "KR008"
    ]
  },
  {
    "id": "fr015",
    "name": "Lemoncurd",
    "supplier": "Zeelandia",
    "supplierArticleNumber": "10008044",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.86,
    "previousPrice": 4.86,
    "pricePerBaseUnit": 0.0049,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Lemoncurd",
      "FR015"
    ]
  },
  {
    "id": "fr016",
    "name": "Limoen",
    "supplier": "Roelofsen",
    "supplierArticleNumber": "7504",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.0,
    "previousPrice": 3.0,
    "pricePerBaseUnit": 0.003,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Limoen",
      "FR016"
    ]
  },
  {
    "id": "zu003",
    "name": "Magere melkpoeder 1%",
    "supplier": "Beko",
    "supplierArticleNumber": "8040065",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.53,
    "previousPrice": 3.53,
    "pricePerBaseUnit": 0.0035,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Magere melkpoeder 1%",
      "ZU003"
    ]
  },
  {
    "id": "ha005",
    "name": "Maggi Aroma",
    "supplier": "AH",
    "supplierArticleNumber": "HA005",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 9.8,
    "previousPrice": 9.8,
    "pricePerBaseUnit": 0.0098,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Maggi Aroma",
      "HA005"
    ]
  },
  {
    "id": "su014",
    "name": "Maja invertsuiker",
    "supplier": "Beko",
    "supplierArticleNumber": "8038234",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.216,
    "previousPrice": 2.216,
    "pricePerBaseUnit": 0.0022,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Maja invertsuiker",
      "SU014"
    ]
  },
  {
    "id": "fr017",
    "name": "Mangopuree",
    "supplier": "Beko",
    "supplierArticleNumber": "9054072",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.49,
    "previousPrice": 6.49,
    "pricePerBaseUnit": 0.0065,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Mangopuree",
      "FR017"
    ]
  },
  {
    "id": "no009",
    "name": "Marsepein 1:2",
    "supplier": "Beko",
    "supplierArticleNumber": "8041633",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.0,
    "previousPrice": 6.0,
    "pricePerBaseUnit": 0.006,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Marsepein 1:2",
      "NO009"
    ]
  },
  {
    "id": "de004",
    "name": "Marsepein bloemetje deco",
    "supplier": "Strik",
    "supplierArticleNumber": "DE004",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 15.0,
    "previousPrice": 15.0,
    "pricePerBaseUnit": 0.015,
    "allergens": [
      "Gluten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Marsepein bloemetje deco",
      "DE004"
    ]
  },
  {
    "id": "ha006",
    "name": "Mayonaise",
    "supplier": "Hanos",
    "supplierArticleNumber": "HA006",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.745,
    "previousPrice": 2.745,
    "pricePerBaseUnit": 0.0027,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Mayonaise",
      "HA006"
    ]
  },
  {
    "id": "zu004",
    "name": "Melk",
    "supplier": "Beko",
    "supplierArticleNumber": "9058719",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.38,
    "previousPrice": 1.38,
    "pricePerBaseUnit": 0.0014,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Melk",
      "ZU004"
    ]
  },
  {
    "id": "ch007",
    "name": "Melkchocolade callets",
    "supplier": "Strik",
    "supplierArticleNumber": "CH007",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.2,
    "previousPrice": 7.2,
    "pricePerBaseUnit": 0.0072,
    "allergens": [
      "Melk",
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Melkchocolade callets",
      "CH007"
    ]
  },
  {
    "id": "zu005",
    "name": "Melkpoeder 1%",
    "supplier": "Beko",
    "supplierArticleNumber": "8040065",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.53,
    "previousPrice": 3.53,
    "pricePerBaseUnit": 0.0035,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Melkpoeder 1%",
      "ZU005"
    ]
  },
  {
    "id": "zu006",
    "name": "Melkpoeder 26%",
    "supplier": "Beko",
    "supplierArticleNumber": "8040431",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.77,
    "previousPrice": 4.77,
    "pricePerBaseUnit": 0.0048,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Melkpoeder 26%",
      "ZU006"
    ]
  },
  {
    "id": "de005",
    "name": "Mini macaron deco",
    "supplier": "Strik",
    "supplierArticleNumber": "DE005",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.6,
    "previousPrice": 4.6,
    "pricePerBaseUnit": 0.0046,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Mini macaron deco",
      "DE005"
    ]
  },
  {
    "id": "zu007",
    "name": "Monchou Roomkaas",
    "supplier": "Beko",
    "supplierArticleNumber": "8040722",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 9.79,
    "previousPrice": 9.79,
    "pricePerBaseUnit": 0.0098,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Monchou Roomkaas",
      "ZU007"
    ]
  },
  {
    "id": "fr018",
    "name": "Morellen",
    "supplier": "Beko",
    "supplierArticleNumber": "9214355",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.39,
    "previousPrice": 3.39,
    "pricePerBaseUnit": 0.0034,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Morellen",
      "FR018"
    ]
  },
  {
    "id": "su015",
    "name": "Njoy Caramel blokjes",
    "supplier": "Bouwhuis",
    "supplierArticleNumber": "44503004",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 24.5725,
    "previousPrice": 24.5725,
    "pricePerBaseUnit": 0.0246,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Njoy Caramel blokjes",
      "SU015"
    ]
  },
  {
    "id": "kr009",
    "name": "Nootmuskaat",
    "supplier": "Beko",
    "supplierArticleNumber": "8032669",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 25.15,
    "previousPrice": 25.15,
    "pricePerBaseUnit": 0.0251,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Nootmuskaat",
      "KR009"
    ]
  },
  {
    "id": "fr019",
    "name": "Oranjesnippers",
    "supplier": "Beko",
    "supplierArticleNumber": "8046689",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.096,
    "previousPrice": 5.096,
    "pricePerBaseUnit": 0.0051,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Oranjesnippers",
      "FR019"
    ]
  },
  {
    "id": "bl001",
    "name": "Paneermeel bruin",
    "supplier": "Beko",
    "supplierArticleNumber": "9021511",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.8415,
    "previousPrice": 1.8415,
    "pricePerBaseUnit": 0.0018,
    "allergens": [
      "Gluten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Paneermeel bruin",
      "BL001"
    ]
  },
  {
    "id": "fr020",
    "name": "Passiepuree",
    "supplier": "Beko",
    "supplierArticleNumber": "9054574",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 8.77,
    "previousPrice": 8.77,
    "pricePerBaseUnit": 0.0088,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Passiepuree",
      "FR020"
    ]
  },
  {
    "id": "zu008",
    "name": "Pati Wit",
    "supplier": "Beko",
    "supplierArticleNumber": "8004634",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 16.0,
    "previousPrice": 16.0,
    "pricePerBaseUnit": 0.016,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Pati Wit",
      "ZU008"
    ]
  },
  {
    "id": "no010",
    "name": "Pecannoten",
    "supplier": "Beko",
    "supplierArticleNumber": "8037340",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 11.95,
    "previousPrice": 11.95,
    "pricePerBaseUnit": 0.012,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Pecannoten",
      "NO010"
    ]
  },
  {
    "id": "ha007",
    "name": "Peper wit",
    "supplier": "Beko",
    "supplierArticleNumber": "8032744",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 21.0,
    "previousPrice": 21.0,
    "pricePerBaseUnit": 0.021,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Peper wit",
      "HA007"
    ]
  },
  {
    "id": "kr010",
    "name": "Pigment kleurstof geel",
    "supplier": "Vipam",
    "supplierArticleNumber": "106464",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 166.79,
    "previousPrice": 166.79,
    "pricePerBaseUnit": 0.1668,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Pigment kleurstof geel",
      "KR010"
    ]
  },
  {
    "id": "kr011",
    "name": "Pigment kleurstof rood",
    "supplier": "Vipam",
    "supplierArticleNumber": "106495",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 166.79,
    "previousPrice": 166.79,
    "pricePerBaseUnit": 0.1668,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Pigment kleurstof rood",
      "KR011"
    ]
  },
  {
    "id": "no011",
    "name": "Pistache noten groen",
    "supplier": "Beko",
    "supplierArticleNumber": "9145071",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 123.3,
    "previousPrice": 123.3,
    "pricePerBaseUnit": 0.1233,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Pistache noten groen",
      "NO011"
    ]
  },
  {
    "id": "no012",
    "name": "Pistache Pasta",
    "supplier": "Vipam",
    "supplierArticleNumber": "107863",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 39.5,
    "previousPrice": 39.5,
    "pricePerBaseUnit": 0.0395,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Pistache Pasta",
      "NO012"
    ]
  },
  {
    "id": "no013",
    "name": "PRA-clas hazelnootpasta",
    "supplier": "Beko",
    "supplierArticleNumber": "8043553",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 16.37,
    "previousPrice": 16.37,
    "pricePerBaseUnit": 0.0164,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "PRA-clas hazelnootpasta",
      "NO013"
    ]
  },
  {
    "id": "ge006",
    "name": "Puddingpoeder",
    "supplier": "Zeelandia",
    "supplierArticleNumber": "10007211",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.7704,
    "previousPrice": 2.7704,
    "pricePerBaseUnit": 0.0028,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Puddingpoeder",
      "GE006"
    ]
  },
  {
    "id": "ch008",
    "name": "Pure Chocolade callets",
    "supplier": "Strik",
    "supplierArticleNumber": "CH008",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 9.23,
    "previousPrice": 9.23,
    "pricePerBaseUnit": 0.0092,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Pure Chocolade callets",
      "CH008"
    ]
  },
  {
    "id": "zu009",
    "name": "Romella",
    "supplier": "Zeelandia",
    "supplierArticleNumber": "10005918",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.77,
    "previousPrice": 2.77,
    "pricePerBaseUnit": 0.0028,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Romella",
      "ZU009"
    ]
  },
  {
    "id": "ve002",
    "name": "Roomboter",
    "supplier": "Beko",
    "supplierArticleNumber": "8040019",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.63,
    "previousPrice": 5.63,
    "pricePerBaseUnit": 0.0056,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Roomboter",
      "VE002"
    ]
  },
  {
    "id": "zu010",
    "name": "Roompoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "8038807",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.48,
    "previousPrice": 3.48,
    "pricePerBaseUnit": 0.0035,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Roompoeder",
      "ZU010"
    ]
  },
  {
    "id": "fr021",
    "name": "Rozijnen",
    "supplier": "Beko",
    "supplierArticleNumber": "9101529",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.7,
    "previousPrice": 3.7,
    "pricePerBaseUnit": 0.0037,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Rozijnen",
      "FR021"
    ]
  },
  {
    "id": "ba009",
    "name": "Sachermix",
    "supplier": "Zeelandia",
    "supplierArticleNumber": "BA009",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.88,
    "previousPrice": 3.88,
    "pricePerBaseUnit": 0.0039,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Sachermix",
      "BA009"
    ]
  },
  {
    "id": "ba010",
    "name": "Sachermix beslag",
    "supplier": "Strik",
    "supplierArticleNumber": "BA010",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.6757,
    "previousPrice": 3.6757,
    "pricePerBaseUnit": 0.0037,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Sachermix beslag",
      "BA010"
    ]
  },
  {
    "id": "ha008",
    "name": "Sambal Oelek",
    "supplier": "AH",
    "supplierArticleNumber": "HA008",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.0357,
    "previousPrice": 3.0357,
    "pricePerBaseUnit": 0.003,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Sambal Oelek",
      "HA008"
    ]
  },
  {
    "id": "ge007",
    "name": "Sanatine",
    "supplier": "Beko",
    "supplierArticleNumber": "9043867",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 12.04,
    "previousPrice": 12.04,
    "pricePerBaseUnit": 0.012,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Sanatine",
      "GE007"
    ]
  },
  {
    "id": "ge008",
    "name": "Sanatinepoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "9043867",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 12.036,
    "previousPrice": 12.036,
    "pricePerBaseUnit": 0.012,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Sanatinepoeder",
      "GE008"
    ]
  },
  {
    "id": "ei002",
    "name": "Scharrel eiwit",
    "supplier": "Beko",
    "supplierArticleNumber": "8029661",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.53,
    "previousPrice": 2.53,
    "pricePerBaseUnit": 0.0025,
    "allergens": [
      "Ei"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Scharrel eiwit",
      "EI002"
    ]
  },
  {
    "id": "ei003",
    "name": "Scharrel Heelei",
    "supplier": "Beko",
    "supplierArticleNumber": "8029723",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.56,
    "previousPrice": 4.56,
    "pricePerBaseUnit": 0.0046,
    "allergens": [
      "Ei"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Scharrel Heelei",
      "EI003"
    ]
  },
  {
    "id": "zu011",
    "name": "Slagroom",
    "supplier": "Beko",
    "supplierArticleNumber": "8040141",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 4.93,
    "previousPrice": 4.93,
    "pricePerBaseUnit": 0.0049,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Slagroom",
      "ZU011"
    ]
  },
  {
    "id": "ba011",
    "name": "Speculaasdeeg",
    "supplier": "Strik",
    "supplierArticleNumber": "BA011",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.1066,
    "previousPrice": 3.1066,
    "pricePerBaseUnit": 0.0031,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Speculaasdeeg",
      "BA011"
    ]
  },
  {
    "id": "kr012",
    "name": "Speculaaskruiden",
    "supplier": "Beko",
    "supplierArticleNumber": "8033058",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 15.2,
    "previousPrice": 15.2,
    "pricePerBaseUnit": 0.0152,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Speculaaskruiden",
      "KR012"
    ]
  },
  {
    "id": "ge009",
    "name": "Spiegelgelei neutraal",
    "supplier": "Beko",
    "supplierArticleNumber": "8046961",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.3317,
    "previousPrice": 3.3317,
    "pricePerBaseUnit": 0.0033,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Spiegelgelei neutraal",
      "GE009"
    ]
  },
  {
    "id": "ve003",
    "name": "St Allery Revolution Boter",
    "supplier": "Beko",
    "supplierArticleNumber": "9012796",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.119,
    "previousPrice": 6.119,
    "pricePerBaseUnit": 0.0061,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "St Allery Revolution Boter",
      "VE003"
    ]
  },
  {
    "id": "ba012",
    "name": "Super Mosca",
    "supplier": "Zeelandia",
    "supplierArticleNumber": "10006342",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.1,
    "previousPrice": 3.1,
    "pricePerBaseUnit": 0.0031,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Super Mosca",
      "BA012"
    ]
  },
  {
    "id": "bl002",
    "name": "Super Patentbloem",
    "supplier": "Beko",
    "supplierArticleNumber": "9025626",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.63,
    "previousPrice": 0.63,
    "pricePerBaseUnit": 0.0006,
    "allergens": [
      "Gluten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Super Patentbloem",
      "BL002"
    ]
  },
  {
    "id": "bl003",
    "name": "Tarwegriesmeel",
    "supplier": "AH",
    "supplierArticleNumber": "BL003",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 2.7339,
    "previousPrice": 2.7339,
    "pricePerBaseUnit": 0.0027,
    "allergens": [
      "Gluten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Tarwegriesmeel",
      "BL003"
    ]
  },
  {
    "id": "bl004",
    "name": "Tarwezetmeel",
    "supplier": "Beko",
    "supplierArticleNumber": "8060377",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 1.33,
    "previousPrice": 1.33,
    "pricePerBaseUnit": 0.0013,
    "allergens": [
      "Gluten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Tarwezetmeel",
      "BL004"
    ]
  },
  {
    "id": "ba013",
    "name": "Tompouce plakken",
    "supplier": "Strik",
    "supplierArticleNumber": "BA013",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 11.21,
    "previousPrice": 11.21,
    "pricePerBaseUnit": 0.0112,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Tompouce plakken",
      "BA013"
    ]
  },
  {
    "id": "zu012",
    "name": "Trio Creme",
    "supplier": "Beko",
    "supplierArticleNumber": "9110978",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.252,
    "previousPrice": 5.252,
    "pricePerBaseUnit": 0.0053,
    "allergens": [
      "Melk",
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Trio Creme",
      "ZU012"
    ]
  },
  {
    "id": "de006",
    "name": "Truffels (15gr/truffel)",
    "supplier": "Strik",
    "supplierArticleNumber": "DE006",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 43.57,
    "previousPrice": 43.57,
    "pricePerBaseUnit": 0.0436,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Truffels (15gr/truffel)",
      "DE006"
    ]
  },
  {
    "id": "kr013",
    "name": "Vanille bourbon",
    "supplier": "Beko",
    "supplierArticleNumber": "9146591",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 84.15,
    "previousPrice": 84.15,
    "pricePerBaseUnit": 0.0842,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Vanille bourbon",
      "KR013"
    ]
  },
  {
    "id": "fr022",
    "name": "Verse aardbeien",
    "supplier": "Roelofsen",
    "supplierArticleNumber": "FR022",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 6.15,
    "previousPrice": 6.15,
    "pricePerBaseUnit": 0.0062,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Verse aardbeien",
      "FR022"
    ]
  },
  {
    "id": "zu013",
    "name": "Volle Melkpoeder 26%",
    "supplier": "Beko",
    "supplierArticleNumber": "8040431",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 5.38,
    "previousPrice": 5.38,
    "pricePerBaseUnit": 0.0054,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Volle Melkpoeder 26%",
      "ZU013"
    ]
  },
  {
    "id": "no014",
    "name": "Walnoten brok",
    "supplier": "Beko",
    "supplierArticleNumber": "8037381",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.6,
    "previousPrice": 7.6,
    "pricePerBaseUnit": 0.0076,
    "allergens": [
      "Noten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Walnoten brok",
      "NO014"
    ]
  },
  {
    "id": "ov002",
    "name": "Water",
    "supplier": "Strik",
    "supplierArticleNumber": "OV002",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.0016,
    "previousPrice": 0.0016,
    "pricePerBaseUnit": 0.0,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Water",
      "OV002"
    ]
  },
  {
    "id": "ha009",
    "name": "Winterpeen julienne",
    "supplier": "Roelofsen",
    "supplierArticleNumber": "3130",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 3.09,
    "previousPrice": 3.09,
    "pricePerBaseUnit": 0.0031,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Winterpeen julienne",
      "HA009"
    ]
  },
  {
    "id": "ch009",
    "name": "Witte chocolade callets W2",
    "supplier": "Hefe",
    "supplierArticleNumber": "CH009",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 7.0,
    "previousPrice": 7.0,
    "pricePerBaseUnit": 0.007,
    "allergens": [
      "Soja"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Witte chocolade callets W2",
      "CH009"
    ]
  },
  {
    "id": "kr014",
    "name": "Yoghurtpoeder",
    "supplier": "Beko",
    "supplierArticleNumber": "8037578",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 11.53,
    "previousPrice": 11.53,
    "pricePerBaseUnit": 0.0115,
    "allergens": [
      "Melk"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Yoghurtpoeder",
      "KR014"
    ]
  },
  {
    "id": "bl005",
    "name": "Zeeuws Bloem",
    "supplier": "Beko",
    "supplierArticleNumber": "9025634",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.6,
    "previousPrice": 0.6,
    "pricePerBaseUnit": 0.0006,
    "allergens": [
      "Gluten"
    ],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Zeeuws Bloem",
      "BL005"
    ]
  },
  {
    "id": "ha010",
    "name": "Zout",
    "supplier": "Beko",
    "supplierArticleNumber": "8031841",
    "packageSize": "1 kg",
    "recipeUnit": "gram",
    "lastPrice": 0.33,
    "previousPrice": 0.33,
    "pricePerBaseUnit": 0.0003,
    "allergens": [],
    "lastUpdated": "2026-05-21",
    "status": "active",
    "lastInvoice": "Hoofdbestand Recepturen Strik 2026",
    "aliases": [
      "Zout",
      "HA010"
    ]
  }
];

export const recipes: Recipe[] = [
  {
    "id": "hf001",
    "name": "Appelcakevulling",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 125.946,
    "previousCostPrice": 125.946,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "fr010",
        "quantity": 15000.0,
        "unit": "gram",
        "costContribution": 26.25
      },
      {
        "ingredientId": "fr010",
        "quantity": 30000.0,
        "unit": "gram",
        "costContribution": 52.5
      },
      {
        "ingredientId": "kr003",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 7.816
      },
      {
        "ingredientId": "al002",
        "quantity": 200.0,
        "unit": "gram",
        "costContribution": 4.2
      },
      {
        "ingredientId": "fr021",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 3.7
      },
      {
        "ingredientId": "ge002",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 6.09
      },
      {
        "ingredientId": "su003",
        "quantity": 3500.0,
        "unit": "gram",
        "costContribution": 3.85
      },
      {
        "ingredientId": "ge005",
        "quantity": 1800.0,
        "unit": "gram",
        "costContribution": 19.8
      },
      {
        "ingredientId": "zu010",
        "quantity": 500.0,
        "unit": "gram",
        "costContribution": 1.74
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Alcohol",
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "55 kg",
    "photoHint": "Halffabricaat HF001",
    "notes": "Geimporteerd uit HF Receptregels met 9 regels."
  },
  {
    "id": "hf004",
    "name": "Banketbakkers room",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 21.219,
    "previousCostPrice": 21.219,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "su013",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 1.3
      },
      {
        "ingredientId": "ge006",
        "quantity": 1300.0,
        "unit": "gram",
        "costContribution": 3.6015
      },
      {
        "ingredientId": "zu013",
        "quantity": 1100.0,
        "unit": "gram",
        "costContribution": 5.918
      },
      {
        "ingredientId": "ge003",
        "quantity": 100.0,
        "unit": "gram",
        "costContribution": 1.263
      },
      {
        "ingredientId": "ov002",
        "quantity": 10000.0,
        "unit": "gram",
        "costContribution": 0.0165
      },
      {
        "ingredientId": "ei003",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 9.12
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "16.5 kg",
    "photoHint": "Halffabricaat HF004",
    "notes": "Geimporteerd uit HF Receptregels met 6 regels.",
    "linkedFinalProductIds": [
      "gateau-mango",
      "gateau-lemon",
      "gateau-choco",
      "gateau-framboos",
      "gateau-framboos",
      "gateau-yoghurt-framboos",
      "gateau-hazelnoot"
    ]
  },
  {
    "id": "hf006",
    "name": "Caramel",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 66.1541,
    "previousCostPrice": 66.1541,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ov002",
        "quantity": 2500.0,
        "unit": "gram",
        "costContribution": 0.0041
      },
      {
        "ingredientId": "su013",
        "quantity": 10000.0,
        "unit": "gram",
        "costContribution": 6.5
      },
      {
        "ingredientId": "su004",
        "quantity": 500.0,
        "unit": "gram",
        "costContribution": 1.075
      },
      {
        "ingredientId": "zu011",
        "quantity": 7500.0,
        "unit": "gram",
        "costContribution": 36.975
      },
      {
        "ingredientId": "ch007",
        "quantity": 3000.0,
        "unit": "gram",
        "costContribution": 21.6
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Soja"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "23.5 kg",
    "photoHint": "Halffabricaat HF006",
    "notes": "Geimporteerd uit HF Receptregels met 5 regels."
  },
  {
    "id": "hf007",
    "name": "Caramel Chocolade Creme",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 0.9435,
    "previousCostPrice": 0.9435,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "zu011",
        "quantity": 170.0,
        "unit": "gram",
        "costContribution": 0.8381
      },
      {
        "ingredientId": "su012",
        "quantity": 17.0,
        "unit": "gram",
        "costContribution": 0.0377
      },
      {
        "ingredientId": "su009",
        "quantity": 17.0,
        "unit": "gram",
        "costContribution": 0.0425
      },
      {
        "ingredientId": "ge003",
        "quantity": 2.0,
        "unit": "gram",
        "costContribution": 0.0253
      },
      {
        "ingredientId": "0",
        "quantity": 10.0,
        "unit": "gram",
        "costContribution": 0.0
      },
      {
        "ingredientId": "0",
        "quantity": 240.0,
        "unit": "gram",
        "costContribution": 0.0
      },
      {
        "ingredientId": "0",
        "quantity": 80.0,
        "unit": "gram",
        "costContribution": 0.0
      },
      {
        "ingredientId": "0",
        "quantity": 2.0,
        "unit": "gram",
        "costContribution": 0.0
      },
      {
        "ingredientId": "0",
        "quantity": 500.0,
        "unit": "gram",
        "costContribution": 0.0
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "1.04 kg",
    "photoHint": "Halffabricaat HF007",
    "notes": "Geimporteerd uit HF Receptregels met 9 regels."
  },
  {
    "id": "hf011",
    "name": "Frambozen Compote",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 32.6877,
    "previousCostPrice": 32.6877,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "fr013",
        "quantity": 5000.0,
        "unit": "gram",
        "costContribution": 26.605
      },
      {
        "ingredientId": "su003",
        "quantity": 600.0,
        "unit": "gram",
        "costContribution": 0.66
      },
      {
        "ingredientId": "ge005",
        "quantity": 280.0,
        "unit": "gram",
        "costContribution": 3.08
      },
      {
        "ingredientId": "fr012",
        "quantity": 400.0,
        "unit": "gram",
        "costContribution": 2.3427
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "6.28 kg",
    "photoHint": "Halffabricaat HF011",
    "notes": "Geimporteerd uit HF Receptregels met 4 regels.",
    "linkedFinalProductIds": [
      "gateau-choco"
    ]
  },
  {
    "id": "hf014",
    "name": "Hardewener deeg",
    "type": "semiFinished",
    "productGroup": "Bodems & beslag",
    "salesPrice": 0,
    "costPrice": 136.8827,
    "previousCostPrice": 136.8827,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ve002",
        "quantity": 18000.0,
        "unit": "gram",
        "costContribution": 101.34
      },
      {
        "ingredientId": "su003",
        "quantity": 9000.0,
        "unit": "gram",
        "costContribution": 9.9
      },
      {
        "ingredientId": "ha010",
        "quantity": 400.0,
        "unit": "gram",
        "costContribution": 0.132
      },
      {
        "ingredientId": "kr003",
        "quantity": 900.0,
        "unit": "gram",
        "costContribution": 3.5172
      },
      {
        "ingredientId": "ei003",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 4.56
      },
      {
        "ingredientId": "ov002",
        "quantity": 1200.0,
        "unit": "gram",
        "costContribution": 0.002
      },
      {
        "ingredientId": "kr005",
        "quantity": 30.0,
        "unit": "gram",
        "costContribution": 1.2315
      },
      {
        "ingredientId": "bl005",
        "quantity": 27000.0,
        "unit": "gram",
        "costContribution": 16.2
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "57.53 kg",
    "photoHint": "Halffabricaat HF014",
    "notes": "Geimporteerd uit HF Receptregels met 8 regels.",
    "linkedFinalProductIds": [
      "gateau-hazelnoot"
    ]
  },
  {
    "id": "hf017",
    "name": "Krokante Vlaaibodemdeeg",
    "type": "semiFinished",
    "productGroup": "Bodems & beslag",
    "salesPrice": 0,
    "costPrice": 44.5851,
    "previousCostPrice": 44.5851,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "su003",
        "quantity": 2200.0,
        "unit": "gram",
        "costContribution": 2.42
      },
      {
        "ingredientId": "no001",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 14.776
      },
      {
        "ingredientId": "ve002",
        "quantity": 4000.0,
        "unit": "gram",
        "costContribution": 22.52
      },
      {
        "ingredientId": "ei003",
        "quantity": 100.0,
        "unit": "gram",
        "costContribution": 0.456
      },
      {
        "ingredientId": "kr005",
        "quantity": 5.0,
        "unit": "gram",
        "costContribution": 0.2053
      },
      {
        "ingredientId": "ov002",
        "quantity": 300.0,
        "unit": "gram",
        "costContribution": 0.0005
      },
      {
        "ingredientId": "kr003",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.0782
      },
      {
        "ingredientId": "bl002",
        "quantity": 3000.0,
        "unit": "gram",
        "costContribution": 1.89
      },
      {
        "ingredientId": "bl005",
        "quantity": 3000.0,
        "unit": "gram",
        "costContribution": 1.8
      },
      {
        "ingredientId": "ba002",
        "quantity": 100.0,
        "unit": "gram",
        "costContribution": 0.4392
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Noten",
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "14.72 kg",
    "photoHint": "Halffabricaat HF017",
    "notes": "Geimporteerd uit HF Receptregels met 10 regels."
  },
  {
    "id": "hf018",
    "name": "Lemon merengue schuim",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 7.8014,
    "previousCostPrice": 7.8014,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ge003",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.1895
      },
      {
        "ingredientId": "ei002",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 2.53
      },
      {
        "ingredientId": "su014",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 4.432
      },
      {
        "ingredientId": "su013",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 0.65
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Ei"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "4.01 kg",
    "photoHint": "Halffabricaat HF018",
    "notes": "±17gr schuim per petit gateau",
    "linkedFinalProductIds": [
      "gateau-lemon"
    ]
  },
  {
    "id": "hf019",
    "name": "Mango Cremeux",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 58.0478,
    "previousCostPrice": 58.0478,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "fr017",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 12.98
      },
      {
        "ingredientId": "fr020",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 17.54
      },
      {
        "ingredientId": "su013",
        "quantity": 1440.0,
        "unit": "gram",
        "costContribution": 0.936
      },
      {
        "ingredientId": "ei001",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 10.69
      },
      {
        "ingredientId": "ge003",
        "quantity": 100.0,
        "unit": "gram",
        "costContribution": 1.263
      },
      {
        "ingredientId": "ov002",
        "quantity": 500.0,
        "unit": "gram",
        "costContribution": 0.0008
      },
      {
        "ingredientId": "ve002",
        "quantity": 2600.0,
        "unit": "gram",
        "costContribution": 14.638
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Ei",
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "9.64 kg",
    "photoHint": "Halffabricaat HF019",
    "notes": "Geimporteerd uit HF Receptregels met 7 regels.",
    "linkedFinalProductIds": [
      "gateau-mango"
    ]
  },
  {
    "id": "hf020",
    "name": "Mango-passie mousse GATEAU",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 46.287,
    "previousCostPrice": 46.287,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "zu011",
        "quantity": 5000.0,
        "unit": "gram",
        "costContribution": 24.65
      },
      {
        "ingredientId": "fr017",
        "quantity": 750.0,
        "unit": "gram",
        "costContribution": 4.8675
      },
      {
        "ingredientId": "fr020",
        "quantity": 750.0,
        "unit": "gram",
        "costContribution": 6.5775
      },
      {
        "ingredientId": "kr002",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 10.192
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "7.5 kg",
    "photoHint": "Halffabricaat HF020",
    "notes": "Geimporteerd uit HF Receptregels met 4 regels.",
    "linkedFinalProductIds": [
      "gateau-mango"
    ]
  },
  {
    "id": "hf024",
    "name": "Plaatcake",
    "type": "semiFinished",
    "productGroup": "Bodems & beslag",
    "salesPrice": 0,
    "costPrice": 4.7575,
    "previousCostPrice": 4.7575,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ba003",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 2.76
      },
      {
        "ingredientId": "ov002",
        "quantity": 450.0,
        "unit": "gram",
        "costContribution": 0.0007
      },
      {
        "ingredientId": "ve001",
        "quantity": 450.0,
        "unit": "gram",
        "costContribution": 1.9968
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "1.9 kg",
    "photoHint": "Halffabricaat HF024",
    "notes": "Geimporteerd uit HF Receptregels met 3 regels."
  },
  {
    "id": "hf026",
    "name": "Room/Botercreme",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 70.954,
    "previousCostPrice": 70.954,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ve002",
        "quantity": 7500.0,
        "unit": "gram",
        "costContribution": 42.225
      },
      {
        "ingredientId": "su013",
        "quantity": 1500.0,
        "unit": "gram",
        "costContribution": 0.975
      },
      {
        "ingredientId": "zu012",
        "quantity": 2500.0,
        "unit": "gram",
        "costContribution": 13.13
      },
      {
        "ingredientId": "su013",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 1.3
      },
      {
        "ingredientId": "ge006",
        "quantity": 1300.0,
        "unit": "gram",
        "costContribution": 3.6015
      },
      {
        "ingredientId": "zu005",
        "quantity": 1100.0,
        "unit": "gram",
        "costContribution": 3.883
      },
      {
        "ingredientId": "ge003",
        "quantity": 100.0,
        "unit": "gram",
        "costContribution": 1.263
      },
      {
        "ingredientId": "ov002",
        "quantity": 10000.0,
        "unit": "gram",
        "costContribution": 0.0165
      },
      {
        "ingredientId": "ei003",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 4.56
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Soja",
      "Ei"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "27 kg",
    "photoHint": "Halffabricaat HF026",
    "notes": "Geimporteerd uit HF Receptregels met 9 regels.",
    "linkedFinalProductIds": [
      "gateau-choco",
      "gateau-framboos",
      "gateau-yoghurt-framboos"
    ]
  },
  {
    "id": "hf029",
    "name": "Sloffendeeg",
    "type": "semiFinished",
    "productGroup": "Bodems & beslag",
    "salesPrice": 0,
    "costPrice": 53.9242,
    "previousCostPrice": 53.9242,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ve002",
        "quantity": 6000.0,
        "unit": "gram",
        "costContribution": 33.78
      },
      {
        "ingredientId": "su003",
        "quantity": 6000.0,
        "unit": "gram",
        "costContribution": 6.6
      },
      {
        "ingredientId": "ha010",
        "quantity": 60.0,
        "unit": "gram",
        "costContribution": 0.0198
      },
      {
        "ingredientId": "kr013",
        "quantity": 60.0,
        "unit": "gram",
        "costContribution": 5.049
      },
      {
        "ingredientId": "ei003",
        "quantity": 600.0,
        "unit": "gram",
        "costContribution": 2.736
      },
      {
        "ingredientId": "bl002",
        "quantity": 2250.0,
        "unit": "gram",
        "costContribution": 1.4175
      },
      {
        "ingredientId": "bl005",
        "quantity": 6000.0,
        "unit": "gram",
        "costContribution": 3.6
      },
      {
        "ingredientId": "ba002",
        "quantity": 150.0,
        "unit": "gram",
        "costContribution": 0.6588
      },
      {
        "ingredientId": "ov001",
        "quantity": 22.0,
        "unit": "gram",
        "costContribution": 0.0631
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "21.14 kg",
    "photoHint": "Halffabricaat HF029",
    "notes": "±60gr = pistache slofje ; ±75gr = rond vlaaitje ; ±310gr = slof groot ; ±20gr = gateau",
    "linkedFinalProductIds": [
      "gateau-mango",
      "gateau-lemon",
      "gateau-choco",
      "gateau-framboos",
      "gateau-yoghurt-framboos",
      "gateau-hazelnoot"
    ]
  },
  {
    "id": "hf030",
    "name": "Soezenbeslag BB",
    "type": "semiFinished",
    "productGroup": "Bodems & beslag",
    "salesPrice": 0,
    "costPrice": 72.3415,
    "previousCostPrice": 72.3415,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ov002",
        "quantity": 10000.0,
        "unit": "gram",
        "costContribution": 0.0165
      },
      {
        "ingredientId": "zu010",
        "quantity": 5000.0,
        "unit": "gram",
        "costContribution": 17.4
      },
      {
        "ingredientId": "ba012",
        "quantity": 2500.0,
        "unit": "gram",
        "costContribution": 7.75
      },
      {
        "ingredientId": "bl002",
        "quantity": 2500.0,
        "unit": "gram",
        "costContribution": 1.575
      },
      {
        "ingredientId": "ei003",
        "quantity": 10000.0,
        "unit": "gram",
        "costContribution": 45.6
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Gluten",
      "Ei"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "30 kg",
    "photoHint": "Halffabricaat HF030",
    "notes": "± 55gr = 1 bb soes ; 546 soezen/recept"
  },
  {
    "id": "hf031",
    "name": "Vlaaibodem",
    "type": "semiFinished",
    "productGroup": "Bodems & beslag",
    "salesPrice": 0,
    "costPrice": 35.3606,
    "previousCostPrice": 35.3606,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ve002",
        "quantity": 3750.0,
        "unit": "gram",
        "costContribution": 21.1125
      },
      {
        "ingredientId": "su003",
        "quantity": 6250.0,
        "unit": "gram",
        "costContribution": 6.875
      },
      {
        "ingredientId": "ei003",
        "quantity": 1250.0,
        "unit": "gram",
        "costContribution": 5.7
      },
      {
        "ingredientId": "ov002",
        "quantity": 1250.0,
        "unit": "gram",
        "costContribution": 0.0021
      },
      {
        "ingredientId": "kr003",
        "quantity": 250.0,
        "unit": "gram",
        "costContribution": 0.977
      },
      {
        "ingredientId": "ov001",
        "quantity": 200.0,
        "unit": "gram",
        "costContribution": 0.574
      },
      {
        "ingredientId": "bl005",
        "quantity": 200.0,
        "unit": "gram",
        "costContribution": 0.12
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "13.15 kg",
    "photoHint": "Halffabricaat HF031",
    "notes": "±80gr = 1 vlaaibodem"
  },
  {
    "id": "hf033",
    "name": "Zwitserse room",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 61.408,
    "previousCostPrice": 61.408,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "zu011",
        "quantity": 8000.0,
        "unit": "gram",
        "costContribution": 39.44
      },
      {
        "ingredientId": "zu010",
        "quantity": 400.0,
        "unit": "gram",
        "costContribution": 1.392
      }
    ],
    "semiFinishedItems": [
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 16000.0,
        "unit": "gram",
        "costContribution": 20.576
      }
    ],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "24.4 kg",
    "photoHint": "Halffabricaat HF033",
    "notes": "Geimporteerd uit HF Receptregels met 3 regels."
  },
  {
    "id": "hf034",
    "name": "Bodem roomvulling",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 48.7777,
    "previousCostPrice": 48.7777,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ov002",
        "quantity": 35000.0,
        "unit": "gram",
        "costContribution": 0.0578
      },
      {
        "ingredientId": "zu010",
        "quantity": 14000.0,
        "unit": "gram",
        "costContribution": 48.72
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "49 kg",
    "photoHint": "Halffabricaat HF034",
    "notes": "Geimporteerd uit HF Receptregels met 2 regels."
  },
  {
    "id": "hf035",
    "name": "Chocolade mousse",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 81.9886,
    "previousCostPrice": 81.9886,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "zu011",
        "quantity": 10000.0,
        "unit": "gram",
        "costContribution": 49.3
      },
      {
        "ingredientId": "su013",
        "quantity": 900.0,
        "unit": "gram",
        "costContribution": 0.585
      },
      {
        "ingredientId": "ov002",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 0.0016
      },
      {
        "ingredientId": "ch008",
        "quantity": 3300.0,
        "unit": "gram",
        "costContribution": 30.459
      },
      {
        "ingredientId": "ge003",
        "quantity": 130.0,
        "unit": "gram",
        "costContribution": 1.6419
      },
      {
        "ingredientId": "ov002",
        "quantity": 650.0,
        "unit": "gram",
        "costContribution": 0.0011
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Soja"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "15.98 kg",
    "photoHint": "Halffabricaat HF035",
    "notes": "Geimporteerd uit HF Receptregels met 6 regels.",
    "linkedFinalProductIds": [
      "gateau-choco"
    ]
  },
  {
    "id": "hf037",
    "name": "Frambozen bavarois",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 47.6995,
    "previousCostPrice": 47.6995,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "fr011",
        "quantity": 1500.0,
        "unit": "gram",
        "costContribution": 12.8575
      },
      {
        "ingredientId": "kr002",
        "quantity": 1000.0,
        "unit": "gram",
        "costContribution": 10.192
      },
      {
        "ingredientId": "zu011",
        "quantity": 5000.0,
        "unit": "gram",
        "costContribution": 24.65
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "7.5 kg",
    "photoHint": "Halffabricaat HF037",
    "notes": "Geimporteerd uit HF Receptregels met 3 regels.",
    "linkedFinalProductIds": [
      "gateau-framboos"
    ]
  },
  {
    "id": "hf038",
    "name": "Yoghurt bavarois GATEAU",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 39.0658,
    "previousCostPrice": 39.0658,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "zu011",
        "quantity": 5000.0,
        "unit": "gram",
        "costContribution": 24.65
      },
      {
        "ingredientId": "ov002",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 0.0033
      },
      {
        "ingredientId": "kr014",
        "quantity": 1250.0,
        "unit": "gram",
        "costContribution": 14.4125
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "8.25 kg",
    "photoHint": "Halffabricaat HF038",
    "notes": "Geimporteerd uit HF Receptregels met 3 regels.",
    "linkedFinalProductIds": [
      "gateau-yoghurt-framboos"
    ]
  },
  {
    "id": "hf039",
    "name": "Gezouten Caramel",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 51.1488,
    "previousCostPrice": 51.1488,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "su013",
        "quantity": 2000.0,
        "unit": "gram",
        "costContribution": 1.3
      },
      {
        "ingredientId": "zu011",
        "quantity": 3400.0,
        "unit": "gram",
        "costContribution": 16.762
      },
      {
        "ingredientId": "ve002",
        "quantity": 900.0,
        "unit": "gram",
        "costContribution": 5.067
      },
      {
        "ingredientId": "ha010",
        "quantity": 60.0,
        "unit": "gram",
        "costContribution": 0.0198
      },
      {
        "ingredientId": "ch009",
        "quantity": 4000.0,
        "unit": "gram",
        "costContribution": 28.0
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Soja"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "10.36 kg",
    "photoHint": "Halffabricaat HF039",
    "notes": "Geimporteerd uit HF Receptregels met 5 regels.",
    "linkedFinalProductIds": [
      "gateau-hazelnoot"
    ]
  },
  {
    "id": "hf040",
    "name": "Hazelnootroom",
    "type": "semiFinished",
    "productGroup": "Vullingen",
    "salesPrice": 0,
    "costPrice": 63.4234,
    "previousCostPrice": 63.4234,
    "targetMargin": 0,
    "currentMargin": 0,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "zu011",
        "quantity": 1950.0,
        "unit": "gram",
        "costContribution": 9.6135
      },
      {
        "ingredientId": "su003",
        "quantity": 450.0,
        "unit": "gram",
        "costContribution": 0.495
      },
      {
        "ingredientId": "ch007",
        "quantity": 2700.0,
        "unit": "gram",
        "costContribution": 19.44
      },
      {
        "ingredientId": "no013",
        "quantity": 600.0,
        "unit": "gram",
        "costContribution": 9.822
      },
      {
        "ingredientId": "zu011",
        "quantity": 4725.0,
        "unit": "gram",
        "costContribution": 23.2942
      },
      {
        "ingredientId": "ge003",
        "quantity": 60.0,
        "unit": "gram",
        "costContribution": 0.7578
      },
      {
        "ingredientId": "ov002",
        "quantity": 495.0,
        "unit": "gram",
        "costContribution": 0.0008
      }
    ],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.",
      "Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Soja",
      "Noten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "1 batch",
    "batchSize": "10.98 kg",
    "photoHint": "Halffabricaat HF040",
    "notes": "Geimporteerd uit HF Receptregels met 7 regels.",
    "linkedFinalProductIds": [
      "gateau-hazelnoot"
    ]
  },
  {
    "id": "gateau-mango",
    "name": "Gateau Mango",
    "type": "finalProduct",
    "productGroup": "Petit Gateau",
    "salesPrice": 2.85,
    "costPrice": 0.5931,
    "previousCostPrice": 0.5931,
    "targetMargin": 80.0,
    "currentMargin": 84.7589,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ge004",
        "quantity": 10.0,
        "unit": "gram",
        "costContribution": 0.0402
      },
      {
        "ingredientId": "de003",
        "quantity": 5.0,
        "unit": "gram",
        "costContribution": 0.075
      }
    ],
    "semiFinishedItems": [
      {
        "semiFinishedRecipeId": "hf020",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0926
      },
      {
        "semiFinishedRecipeId": "hf019",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.1204
      },
      {
        "semiFinishedRecipeId": "hf029",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.051
      },
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0193
      }
    ],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Recept Petit Gateau.xlsx, tabblad Gateau Mango.",
      "Bereiding, opbouwvolgorde en decoratie-instructies kunnen in de volgende dataronde worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "per stuk",
    "batchSize": "1 stuk",
    "photoHint": "Recept uit tabblad Gateau Mango",
    "notes": "Prijsadvies volgens Excel: EUR 2.38. Geimporteerd inclusief allergenen en kostprijsregels.",
    "packagingCost": 0.1946,
    "decorationCost": 0
  },
  {
    "id": "gateau-lemon",
    "name": "Gateau Lemon",
    "type": "finalProduct",
    "productGroup": "Petit Gateau",
    "salesPrice": 2.85,
    "costPrice": 0.3726,
    "previousCostPrice": 0.3726,
    "targetMargin": 80.0,
    "currentMargin": 93.1905,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "fr015",
        "quantity": 10.0,
        "unit": "gram",
        "costContribution": 0.0486
      },
      {
        "ingredientId": "de003",
        "quantity": 2.0,
        "unit": "gram",
        "costContribution": 0.03
      }
    ],
    "semiFinishedItems": [
      {
        "semiFinishedRecipeId": "hf018",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0291
      },
      {
        "semiFinishedRecipeId": "hf029",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.051
      },
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0193
      }
    ],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Recept Petit Gateau.xlsx, tabblad Gateau Lemon.",
      "Bereiding, opbouwvolgorde en decoratie-instructies kunnen in de volgende dataronde worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "per stuk",
    "batchSize": "1 stuk",
    "photoHint": "Recept uit tabblad Gateau Lemon",
    "notes": "Prijsadvies volgens Excel: EUR 1.18. Geimporteerd inclusief allergenen en kostprijsregels.",
    "packagingCost": 0.1946,
    "decorationCost": 0
  },
  {
    "id": "gateau-choco",
    "name": "Gateau Choco",
    "type": "finalProduct",
    "productGroup": "Petit Gateau",
    "salesPrice": 2.85,
    "costPrice": 0.6993,
    "previousCostPrice": 0.6993,
    "targetMargin": 80.0,
    "currentMargin": 80.6953,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ch008",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.1846
      },
      {
        "ingredientId": "de003",
        "quantity": 2.0,
        "unit": "gram",
        "costContribution": 0.03
      }
    ],
    "semiFinishedItems": [
      {
        "semiFinishedRecipeId": "hf011",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.1041
      },
      {
        "semiFinishedRecipeId": "hf035",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.1026
      },
      {
        "semiFinishedRecipeId": "hf026",
        "quantity": 5.0,
        "unit": "gram",
        "costContribution": 0.0131
      },
      {
        "semiFinishedRecipeId": "hf029",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.051
      },
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0193
      }
    ],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Recept Petit Gateau.xlsx, tabblad Gateau Choco.",
      "Bereiding, opbouwvolgorde en decoratie-instructies kunnen in de volgende dataronde worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten",
      "Soja"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "per stuk",
    "batchSize": "1 stuk",
    "photoHint": "Recept uit tabblad Gateau Choco",
    "notes": "Prijsadvies volgens Excel: EUR 2.96. Geimporteerd inclusief allergenen en kostprijsregels.",
    "packagingCost": 0.1946,
    "decorationCost": 0
  },
  {
    "id": "gateau-framboos",
    "name": "Gateau Framboos",
    "type": "finalProduct",
    "productGroup": "Petit Gateau",
    "salesPrice": 2.85,
    "costPrice": 0.4763,
    "previousCostPrice": 0.4763,
    "targetMargin": 80.0,
    "currentMargin": 89.2277,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "ge004",
        "quantity": 10.0,
        "unit": "gram",
        "costContribution": 0.0402
      },
      {
        "ingredientId": "de003",
        "quantity": 2.0,
        "unit": "gram",
        "costContribution": 0.03
      }
    ],
    "semiFinishedItems": [
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 10.0,
        "unit": "gram",
        "costContribution": 0.0129
      },
      {
        "semiFinishedRecipeId": "hf037",
        "quantity": 30.0,
        "unit": "gram",
        "costContribution": 0.1152
      },
      {
        "semiFinishedRecipeId": "hf026",
        "quantity": 5.0,
        "unit": "gram",
        "costContribution": 0.0131
      },
      {
        "semiFinishedRecipeId": "hf029",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.051
      },
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0193
      }
    ],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Recept Petit Gateau.xlsx, tabblad Gateau Framboos.",
      "Bereiding, opbouwvolgorde en decoratie-instructies kunnen in de volgende dataronde worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "per stuk",
    "batchSize": "1 stuk",
    "photoHint": "Recept uit tabblad Gateau Framboos",
    "notes": "Prijsadvies volgens Excel: EUR 1.75. Geimporteerd inclusief allergenen en kostprijsregels.",
    "packagingCost": 0.1946,
    "decorationCost": 0
  },
  {
    "id": "gateau-yoghurt-framboos",
    "name": "Gateau Yoghurt Framboos",
    "type": "finalProduct",
    "productGroup": "Petit Gateau",
    "salesPrice": 2.85,
    "costPrice": 0.6015,
    "previousCostPrice": 0.6015,
    "targetMargin": 80.0,
    "currentMargin": 84.4349,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "fr013",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0798
      },
      {
        "ingredientId": "ge004",
        "quantity": 10.0,
        "unit": "gram",
        "costContribution": 0.0402
      },
      {
        "ingredientId": "de003",
        "quantity": 2.0,
        "unit": "gram",
        "costContribution": 0.03
      }
    ],
    "semiFinishedItems": [
      {
        "semiFinishedRecipeId": "hf038",
        "quantity": 30.0,
        "unit": "gram",
        "costContribution": 0.1735
      },
      {
        "semiFinishedRecipeId": "hf026",
        "quantity": 5.0,
        "unit": "gram",
        "costContribution": 0.0131
      },
      {
        "semiFinishedRecipeId": "hf029",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.051
      },
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0193
      }
    ],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Recept Petit Gateau.xlsx, tabblad Gateau Yoghurt Framboos.",
      "Bereiding, opbouwvolgorde en decoratie-instructies kunnen in de volgende dataronde worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "per stuk",
    "batchSize": "1 stuk",
    "photoHint": "Recept uit tabblad Gateau Yoghurt Framboos",
    "notes": "Prijsadvies volgens Excel: EUR 2.43. Geimporteerd inclusief allergenen en kostprijsregels.",
    "packagingCost": 0.1946,
    "decorationCost": 0
  },
  {
    "id": "gateau-hazelnoot",
    "name": "Gateau Hazelnoot",
    "type": "finalProduct",
    "productGroup": "Petit Gateau",
    "salesPrice": 2.85,
    "costPrice": 0.5316,
    "previousCostPrice": 0.5316,
    "targetMargin": 80.0,
    "currentMargin": 87.1115,
    "status": "active",
    "ingredients": [
      {
        "ingredientId": "su017",
        "quantity": 2.0,
        "unit": "gram",
        "costContribution": 0.0
      }
    ],
    "semiFinishedItems": [
      {
        "semiFinishedRecipeId": "hf014",
        "quantity": 35.0,
        "unit": "gram",
        "costContribution": 0.049
      },
      {
        "semiFinishedRecipeId": "hf039",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0442
      },
      {
        "semiFinishedRecipeId": "hf040",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.1735
      },
      {
        "semiFinishedRecipeId": "hf029",
        "quantity": 20.0,
        "unit": "gram",
        "costContribution": 0.051
      },
      {
        "semiFinishedRecipeId": "hf004",
        "quantity": 15.0,
        "unit": "gram",
        "costContribution": 0.0193
      }
    ],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Recept Petit Gateau.xlsx, tabblad Gateau Hazelnoot.",
      "Bereiding, opbouwvolgorde en decoratie-instructies kunnen in de volgende dataronde worden aangevuld."
    ],
    "allergens": [
      "Melk",
      "Ei",
      "Gluten",
      "Noten",
      "Soja"
    ],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "per stuk",
    "batchSize": "1 stuk",
    "photoHint": "Recept uit tabblad Gateau Hazelnoot",
    "notes": "Prijsadvies volgens Excel: EUR 2.05. Geimporteerd inclusief allergenen en kostprijsregels.",
    "packagingCost": 0.1946,
    "decorationCost": 0
  },
  {
    "id": "passievol",
    "name": "Passievol",
    "type": "finalProduct",
    "productGroup": "Gebak",
    "salesPrice": 0.0,
    "costPrice": 0.0,
    "previousCostPrice": 0.0,
    "targetMargin": 80.0,
    "currentMargin": 0.0,
    "status": "draft",
    "ingredients": [],
    "semiFinishedItems": [],
    "preparationSteps": [
      "Receptregels zijn overgenomen uit Recept GEBAK.xlsx, tabblad Gateau Lemon.",
      "Bereiding, opbouwvolgorde en decoratie-instructies kunnen in de volgende dataronde worden aangevuld."
    ],
    "allergens": [],
    "version": "Excel 2026",
    "lastUpdated": "2026-05-21",
    "portionLabel": "per stuk",
    "batchSize": "1 stuk",
    "photoHint": "Recept uit tabblad Gateau Lemon",
    "notes": "Controle nodig: receptregels of verkoopprijs ontbreken.",
    "packagingCost": 0.0,
    "decorationCost": 0
  }
];

export const invoiceImports: InvoiceImport[] = [
  {
    "id": "excel-prijscheck-2026",
    "supplier": "Hoofdbestand",
    "invoiceNumber": "Recepturen Strik 2026",
    "invoiceDate": "2026-05-21",
    "uploadedAt": "2026-05-21 10:00",
    "status": "review",
    "lines": [
      {
        "articleNumber": "8040141",
        "description": "Slagroom",
        "quantity": 1,
        "unit": "kg",
        "totalPrice": 4.93,
        "pricePerUnit": 4.93,
        "matchedIngredientId": "zu011",
        "oldPrice": 0.0046,
        "newPrice": 0.0049,
        "percentageChange": 7.4,
        "reviewStatus": "pending"
      },
      {
        "articleNumber": "8040019",
        "description": "Roomboter",
        "quantity": 1,
        "unit": "kg",
        "totalPrice": 5.63,
        "pricePerUnit": 5.63,
        "matchedIngredientId": "ve002",
        "oldPrice": 0.0053,
        "newPrice": 0.0056,
        "percentageChange": 5.2,
        "reviewStatus": "pending"
      },
      {
        "articleNumber": "CH008",
        "description": "Pure Chocolade callets",
        "quantity": 1,
        "unit": "kg",
        "totalPrice": 9.23,
        "pricePerUnit": 9.23,
        "matchedIngredientId": "ch008",
        "oldPrice": 0.0082,
        "newPrice": 0.0092,
        "percentageChange": 11.8,
        "reviewStatus": "pending"
      },
      {
        "articleNumber": "8030139",
        "description": "Amandel Bitterkoekspijs",
        "quantity": 1,
        "unit": "kg",
        "totalPrice": 7.388,
        "pricePerUnit": 7.388,
        "matchedIngredientId": "no001",
        "oldPrice": 0.0071,
        "newPrice": 0.0074,
        "percentageChange": 4.1,
        "reviewStatus": "approved"
      }
    ]
  }
];
