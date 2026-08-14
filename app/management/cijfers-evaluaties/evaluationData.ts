export type EvaluationFile = {
  title: string;
  kind: string;
  detail: string;
  href: string;
  size: string;
};

export type EvaluationSection = {
  title: string;
  items: string[];
};

export type EvaluationPair = [string, string];

export type HolidayEvaluation = {
  slug: string;
  title: string;
  year: string;
  status: "gevuld" | "nog leeg";
  summary: string;
  tags: string[];
  documentTitle: string;
  documentBody: string;
  evaluationSections: EvaluationSection[];
  assortmentKeep: string[];
  assortmentStop: string[];
  priceCards: EvaluationPair[];
  pastryLineup: string[];
  revenueItems: EvaluationPair[];
  planningTips: EvaluationPair[];
  files: EvaluationFile[];
};

const vierdaagseDocumentBody = `Vierdaagse evaluatie 2026

Algemeen
- Werken met de app ging super.
- Drukwerk en bestanden zijn opgeslagen zodat ze volgend jaar direct terug te vinden zijn.
- Omzetcijfers moeten nog worden toegevoegd zodra alles compleet is.

Ziekerstraat
- Aardbeien wafel en aardbeien croissant volgend jaar schrappen.
- Petit gateau was net niet raak; liever een symfonie of ouderwets gebakje als Vierdaagse-gebak.
- Geen grote frisdrankflessen meer, alleen normale flesjes.
- Snel-oven was heel handig.
- Donderdag checken of Ziekerstraat genoeg ijs en gebak voor vrijdag heeft besteld.
- Voor zondag, maandag en de rest van de week ook puddingbroodjes in Ziekerstraat.

Kraam Houtlaan
- Start Roos en Fien om 02:45 en de rest om 03:15 was perfect.
- Pain au chocolat en ham-kaas croissant waren een succes.
- Choco twister eruit.
- Frisdrank beperken tot Spa blauw, cola normaal, AA en Aquarius.

Kraam Malden
- Kraampje was perfect; volgend jaar weer huren met 20 stoelen.
- Starten om 05:00 was perfect.
- Stroom voor het eerst gebruikt en dat was heel fijn.

Planning volgend jaar
- Vrijdag in Lent ook de middag open, of anders tot 15:00.
- Medailles liepen heel goed; ook weer in de winkel zetten.
- 9-vaks Vierdaagse chocoladedoosjes liepen goed.
- Bezorgers: donderdag 03:15 starten, vrijdag 06:00 starten en uiterlijk 07:00 weg.
- Ongeveer € 750 wisselgeld regelen, alleen munten van € 0,50, € 1 en € 2.
`;

const vierdaagseEvaluation: HolidayEvaluation = {
  slug: "vierdaagse-2026",
  title: "Vierdaagse",
  year: "2026",
  status: "gevuld",
  summary:
    "Evaluatie, assortiment, prijskaartjes, planning en drukbestanden voor de Vierdaagse.",
  tags: ["app werkte goed", "drukwerk bewaard", "omzet volgt"],
  documentTitle: "Geschreven evaluatie",
  documentBody: vierdaagseDocumentBody,
  evaluationSections: [
    {
      title: "Ziekerstraat",
      items: [
        "Werken met de app ging super.",
        "Aardbeien wafel en aardbeien croissant volgend jaar schrappen.",
        "Petit gateau was net niet raak; liever een symfonie of ouderwets gebakje als Vierdaagse-gebak.",
        "Geen grote frisdrankflessen meer, alleen normale flesjes.",
        "Snel-oven was heel handig.",
      ],
    },
    {
      title: "Kraam Houtlaan",
      items: [
        "Start Roos en Fien om 02:45 en de rest om 03:15 was perfect.",
        "Pain au chocolat en ham-kaas croissant waren een succes.",
        "Choco twister eruit.",
        "Frisdrank beperken tot Spa blauw, cola normaal, AA en Aquarius.",
      ],
    },
    {
      title: "Kraam Malden",
      items: [
        "Kraampje was perfect; volgend jaar weer huren met 20 stoelen.",
        "Starten om 05:00 was perfect.",
        "Stroom voor het eerst gebruikt en dat was heel fijn.",
      ],
    },
    {
      title: "Divers",
      items: [
        "Vrijdag in Lent ook de middag open, of anders tot 15:00.",
        "Medailles liepen heel goed; ook weer in de winkel zetten.",
        "9-vaks Vierdaagse chocoladedoosjes liepen goed.",
        "Bezorgers: donderdag 03:15 starten, vrijdag 06:00 starten en uiterlijk 07:00 weg.",
        "Donderdag checken of Ziekerstraat genoeg ijs en gebak voor vrijdag heeft besteld.",
        "Voor zondag, maandag en de rest van de week ook puddingbroodjes in Ziekerstraat.",
        "Ongeveer € 750 wisselgeld regelen, alleen munten van € 0,50, € 1 en € 2.",
      ],
    },
  ],
  assortmentKeep: [
    "Pain au chocolat",
    "Croissant ham-kaas",
    "Medailles",
    "9-vaks Vierdaagse chocolade",
    "Puddingbroodjes voor na de Vierdaagse",
  ],
  assortmentStop: [
    "Aardbeien wafel",
    "Aardbeien croissant",
    "Petit gateau als Vierdaagse-gebak",
    "Choco twister",
    "Grote frisdrankflessen",
  ],
  priceCards: [
    ["Croissant aardbei", "€ 5,00"],
    ["Koffie XL", "€ 3,00"],
    ["Thee", "€ 2,50"],
    ["Frisdrank", "€ 3,50"],
    ["Water", "€ 2,50"],
    ["Croissant", "€ 2,50"],
    ["Belegde bol kaas of kipfilet", "€ 3,50"],
    ["Krentenbol", "€ 1,50"],
    ["Puddingbroodje", "€ 3,50"],
    ["Vulkoek", "€ 3,00"],
    ["Appelflap", "€ 3,50"],
    ["Pain au chocolat", "€ 3,00"],
    ["Koffiebroodje", "€ 3,00"],
    ["Kaneelbroodje", "€ 3,50"],
    ["Saucijsbroodje", "€ 3,50"],
    ["Croissant ham-kaas", "€ 3,50"],
    ["Proeverij gebak", "€ 5,95"],
  ],
  pastryLineup: [
    "Vierdaagse Parel",
    "Aardbei Tartelette",
    "Pistache Slofje",
    "Wandel Cheese",
    "Nijmeegs Steventje",
    "Passievol",
    "Hazelnootbol",
    "Framboos Slagroom",
    "Bossche Bol",
    "Tompouce",
    "Lemon Tartelette",
    "Red Velvet",
    "Appel Royale",
    "Abrikoos Slagroom",
  ],
  revenueItems: [
    ["Omzet totaal", "nog invullen"],
    ["Ziekerstraat", "nog invullen"],
    ["Kraam Houtlaan", "nog invullen"],
    ["Kraam Malden", "nog invullen"],
    ["Lent vrijdag", "nog invullen"],
    ["Wisselgeld", "€ 750 munten"],
  ],
  planningTips: [
    ["Houtlaan", "Roos/Fien 02:45, rest 03:15"],
    ["Malden", "Start 05:00, kraam + 20 stoelen + stroom"],
    ["Bezorging", "Donderdag 03:15, vrijdag 06:00"],
    ["Ziekerstraat", "Donderdag check ijs/gebak voor vrijdag"],
    ["Lent", "Vrijdag middag open of tot 15:00"],
  ],
  files: [
    {
      title: "4daagse evaluatie 2026",
      kind: "DOCX",
      detail: "Ruwe evaluatiepunten per locatie.",
      href: "/evaluaties/vierdaagse-2026/4daagse-evaluatie-2026.docx",
      size: "16 KB",
    },
    {
      title: "ZIEK menukaart 4Daagse 2026",
      kind: "PDF",
      detail: "30x A5 printbestand voor Ziekerstraat.",
      href: "/evaluaties/vierdaagse-2026/ziek-menukaart-4daagse-2026-30xa5.pdf",
      size: "634 KB",
    },
    {
      title: "KRAAM prijzen 4Daagse 2026",
      kind: "PDF",
      detail: "2x A1, 2x A3 en 2x A4 prijsbord.",
      href: "/evaluaties/vierdaagse-2026/kraam-prijzen-4daagse-2026.pdf",
      size: "619 KB",
    },
    {
      title: "4daagse plek instructies",
      kind: "PDF",
      detail: "2x A1 en 2x A3 instructiebord voor zitplekken.",
      href: "/evaluaties/vierdaagse-2026/plek-instructies-4daagse-2026.pdf",
      size: "3,9 MB",
    },
    {
      title: "Prijskaartjes 2026",
      kind: "AI",
      detail: "Illustrator-bronbestand met 37 prijskaartjes.",
      href: "/evaluaties/vierdaagse-2026/prijskaartjes-4daagse-2026.ai",
      size: "640 KB",
    },
  ],
};

function createEmptyHoliday(title: string, slug: string): HolidayEvaluation {
  return {
    slug,
    title,
    year: "volgt",
    status: "nog leeg",
    summary: "Nog klaarzetten met cijfers, evaluatie, assortiment en bestanden.",
    tags: ["nog invullen"],
    documentTitle: "Geschreven evaluatie",
    documentBody: `Evaluatie ${title}

Wat ging goed?
-

Wat kan beter?
-

Assortiment en prijzen
-

Cijfers en omzet
-

Bestanden en drukwerk
-

Tips voor volgend jaar
-`,
    evaluationSections: [],
    assortmentKeep: [],
    assortmentStop: [],
    priceCards: [],
    pastryLineup: [],
    revenueItems: [
      ["Omzet totaal", "nog invullen"],
      ["Belangrijkste locatie", "nog invullen"],
      ["Wisselgeld", "nog invullen"],
    ],
    planningTips: [],
    files: [],
  };
}

export const holidayEvaluations: HolidayEvaluation[] = [
  vierdaagseEvaluation,
  createEmptyHoliday("Carnaval", "carnaval"),
  createEmptyHoliday("Pasen", "pasen"),
  createEmptyHoliday("Koningsdag", "koningsdag"),
  createEmptyHoliday("Moederdag", "moederdag"),
  createEmptyHoliday("Sinterklaas", "sinterklaas"),
  createEmptyHoliday("Kerst", "kerst"),
  createEmptyHoliday("Oud & Nieuw", "oud-en-nieuw"),
];

export function getHolidayEvaluation(slug: string) {
  return holidayEvaluations.find((holiday) => holiday.slug === slug) || null;
}
