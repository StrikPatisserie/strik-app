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
  group: "feestdag" | "actie";
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
  group: "feestdag",
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

function createEmptyHoliday(
  title: string,
  slug: string,
  group: HolidayEvaluation["group"] = "feestdag"
): HolidayEvaluation {
  return {
    slug,
    title,
    year: "volgt",
    group,
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

const speculaasSeptember2026: HolidayEvaluation = {
  slug: "september-speculaas-2026",
  title: "September · Speculaas 1+1 gratis",
  year: "2026",
  group: "actie",
  status: "gevuld",
  summary:
    "Evaluatie van de septemberactie met verkoopresultaten, winkelverdeling en controle op de bestelbonnen.",
  tags: ["1+1 gratis", "4.268 verpakkingen", "rendement nog toetsen"],
  documentTitle: "Geschreven evaluatie",
  documentBody: `Septemberactie 2026 · Speculaasbrokken 1+1 gratis

Kernresultaat
- In september 2026 zijn 4.268 verpakkingen verkocht tegenover 237 in september 2025: ruim achttien keer zoveel.
- De omzet steeg van € 1.281,65 naar € 10.886,40.
- Naturel groeide van 169 naar 4.223 verpakkingen en vormde 98,9% van het verkochte volume.
- Luxe met amandel daalde van 68 naar 45 verpakkingen.

Per winkel · naturel 2026
- Daalseweg: 680 verpakkingen.
- Heyendaalseweg: 1.324 verpakkingen.
- Lent: 1.457 verpakkingen.
- Ziekerstraat: 762 verpakkingen.

Beoordeling
- De actie heeft een uitzonderlijk groot volume opgeleverd en werkte in alle vier de winkels.
- De omzet groeide minder hard dan het volume. Daardoor is omzet alleen niet genoeg om het rendement te beoordelen.
- De daling van luxe met amandel kan wijzen op verschuiving naar de actievariant, maar de verkoopdata bewijzen geen direct oorzakelijk verband.
- Voor een definitief oordeel ontbreken nog kostprijs, actieprijs, derving, personeelsinzet, winkelbezoek en bijverkoop.

Bonsteekproef 25 september 2026
- De lokaal aanwezige definitieve bonexport bevat 140 naturelverpakkingen op winkelbonnen: Heyendaalseweg 40, Daalseweg 40 en Lent 60.
- Op een losse klantbon staan 2 naturelverpakkingen.
- Dit is een dagsteekproef en geen maandtotaal. De boncontrole bovenaan deze pagina leest het volledige beschikbare logistiekarchief live uit.

Volgende editie
- Leg normale prijs, actieprijs en kostprijs vooraf vast en stuur op brutomarge in euro's.
- Meet winkelverkeer, gemiddelde bonwaarde en bijverkoop tijdens de actie.
- Bescherm de luxe amandelvariant met een eigen bundel, proeverij of duidelijkere positionering.
- Plan per week een controle op voorraad, derving en extra werkdruk per winkel.

Voorlopig oordeel
Commercieel indrukwekkend. Het financiële rendement moet nog worden vastgesteld.`,
  evaluationSections: [
    {
      title: "Wat werkte",
      items: [
        "Ruim achttien keer zoveel verpakkingen verkocht als in september 2025.",
        "De groei was zichtbaar in alle vier de vergelijkbare winkels.",
        "Lent verkocht met 1.457 stuks het grootste absolute naturel-volume.",
        "Daalseweg maakte met 17 naar 680 stuks de grootste relatieve sprong.",
      ],
    },
    {
      title: "Wat nog ontbreekt",
      items: [
        "Kostprijs en brutomarge per actieartikel.",
        "Derving en extra personeelsinzet tijdens de actie.",
        "Gemiddelde bonwaarde, winkelbezoek en bijverkoop.",
        "Een controlegroep of vergelijkbare periode zonder actie.",
      ],
    },
    {
      title: "Bonsteekproef · 25 september",
      items: [
        "Winkelbonnen: 140 naturel, verdeeld over Heyendaalseweg 40, Daalseweg 40 en Lent 60.",
        "Klantbonnen: 2 naturel.",
        "Dit is alleen de lokaal aanwezige dagexport; het maandtotaal wordt live uit het logistiekarchief berekend.",
      ],
    },
  ],
  assortmentKeep: [
    "Naturel als duidelijke actievariant.",
    "Een septemberactie in alle vier de winkels.",
    "Wekelijkse verkoopcontrole per vestiging.",
  ],
  assortmentStop: [
    "De actie herhalen zonder vooraf vastgelegde margegrens.",
    "Luxe met amandel zonder eigen positionering naast de naturelactie.",
    "Alleen op aantallen en omzet beoordelen.",
  ],
  priceCards: [
    ["Actie", "1+1 gratis"],
    ["Gem. opbrengst naturel 2026", "€ 2,49 per verpakking"],
    ["Gem. opbrengst amandel 2026", "€ 7,84 per verpakking"],
    ["Omzetgroei", "+750%"],
  ],
  pastryLineup: [],
  revenueItems: [
    ["Totaal verkocht 2025", "237"],
    ["Totaal verkocht 2026", "4.268"],
    ["Omzet 2025", "€ 1.281,65"],
    ["Omzet 2026", "€ 10.886,40"],
    ["Naturel 2026", "4.223"],
    ["Luxe amandel 2026", "45"],
  ],
  planningTips: [
    ["Vooraf", "Normale prijs, actieprijs, kostprijs en margegrens vastleggen"],
    ["Tijdens", "Verkeer, bonwaarde, bijverkoop, voorraad en derving meten"],
    ["Amandel", "Eigen positie, bundel of proeverij testen"],
    ["Na afloop", "Verkoop, bestellingen en productie per winkel vergelijken"],
  ],
  files: [],
};

export const holidayEvaluations: HolidayEvaluation[] = [
  vierdaagseEvaluation,
  createEmptyHoliday("Carnaval", "carnaval"),
  createEmptyHoliday("Pasen", "pasen"),
  createEmptyHoliday("Koningsdag", "koningsdag"),
  createEmptyHoliday("Moederdag", "moederdag"),
  createEmptyHoliday("Sinterklaas", "sinterklaas"),
  createEmptyHoliday("Kerst", "kerst"),
  createEmptyHoliday("Oud & Nieuw", "oud-en-nieuw"),
  speculaasSeptember2026,
  createEmptyHoliday(
    "Januari · Gebakjes voor €2",
    "januari-gebaksactie",
    "actie"
  ),
];

export const feastDayEvaluations = holidayEvaluations.filter(
  (evaluation) => evaluation.group === "feestdag"
);

export const otherActionEvaluations = holidayEvaluations.filter(
  (evaluation) => evaluation.group === "actie"
);

export function getHolidayEvaluation(slug: string) {
  return holidayEvaluations.find((holiday) => holiday.slug === slug) || null;
}
