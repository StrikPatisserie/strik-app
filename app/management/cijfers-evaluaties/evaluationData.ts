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

export type EvaluationRecipeDefault = {
  id: string;
  name: string;
  articleNumber: string;
  costPrice: number;
  salesPrice: number;
  currentMargin: number;
  lastUpdated: string;
  quantity: number;
  revenueGross: number;
  capturedAt: string;
};

export type HolidayEvaluation = {
  slug: string;
  title: string;
  year: string;
  periodLabel?: string;
  calendarOrder?: number;
  icon: string;
  group: "feestdag" | "actie";
  status: "gevuld" | "nog leeg";
  summary: string;
  tags: string[];
  documentTitle: string;
  documentBody: string;
  tipsBody?: string;
  evaluationSections: EvaluationSection[];
  assortmentKeep: string[];
  assortmentStop: string[];
  priceCards: EvaluationPair[];
  pastryLineup: string[];
  revenueItems: EvaluationPair[];
  planningTips: EvaluationPair[];
  files: EvaluationFile[];
  recipeLinks?: EvaluationRecipeDefault[];
};

const vierdaagseDocumentBody = `Kernresultaat
- De Vierdaagsekraam kwam uit op € 29.155 omzet. De aansluiting klopt: € 23.250 resterend briefgeld + € 500 muntgeld + € 4.000 SumUp + € 1.180 uitbetaald loon + € 225 Lars = € 29.155.
- Loon en Lars zijn hierin kasbewegingen die bij de resterende contanten worden teruggeteld om de bruto-omzet te reconstrueren; het zijn geen extra verkoopkanalen.
- Ziekerstraat verwerkte 729 actieve bonnen, 2.643 artikelen en 862 stuks gebak/patisserie. Daarvan stonden 853 stuks expliciet in de categorie gebak; de bredere patisserie-telling neemt ook 9 passende artikelen uit andere categorieën mee. Gemiddeld stonden er 3,6 artikelen op een bon.
- De bonregistratie bevat aantallen en tijden, maar geen historische verkoopprijzen. Daarom is voor Ziekerstraat geen betrouwbare omzet of brutomarge bijgeschat.

Wat ging goed
- De appregistratie was compleet: alle 729 actieve bonnen bevatten zowel een klaar- als levertijd. Slechts 2 bonnen zijn geannuleerd.
- De mediane levertijd was 4 minuten. 75% werd binnen 7 minuten en 90% binnen 12 minuten geleverd.
- Donderdag en vrijdag liepen het strakst, met gemiddeld respectievelijk 2,6 en 2,7 minuten tot levering.
- De vraag was sterk en herkenbaar: koffie en thee vormden 50,8% van alle artikelen; de expliciete categorie gebak 32,3%.
- Cappuccino (578), koffie (400) en thee (136) waren de grootste volumes.
- Top 10 gebak/patisserie: hazelnootbol 116, cheesecake 102, Bossche bol 90, tompouce 80, aardbei-tartelette 60, appelpunt 57, Steventje 56, Vierdaagse Parel 54, pistacheslofje 43 en Passievol 42.
- Het terras verwerkte 399 bonnen en 1.432 artikelen; binnen waren dit 319 bonnen en 1.188 artikelen. Er waren 11 afhaalbonnen met 23 artikelen.
- De bestaande operationele keuzes werkten goed: de sneloven in Ziekerstraat, de vroege start aan de Houtlaan en de kraam met stroom en zitplaatsen in Malden.
- Pain au chocolat, ham-kaascroissant, medailles en de 9-vaks Vierdaagse chocoladedoosjes blijven goede onderdelen van het assortiment.

Waar zat de druk
- Zondag was operationeel het zwaarst: 130 bonnen, 513 artikelen, gemiddeld 9,6 minuten tot levering en 49 bonnen langer dan 10 minuten.
- Maandag had met 184 bonnen en 734 artikelen het hoogste volume; gemiddeld duurde levering 6,2 minuten.
- Over de hele week duurden 97 leveringen langer dan 10 minuten en 29 langer dan 15 minuten. Woensdag zat bovendien een uitschieter van 49 minuten.
- De drukste uren waren 11:00 en 14:00 met elk 440 artikelen, gevolgd door 13:00 en 15:00. De personeels- en koffiecapaciteit moet daarom vooral tussen 11:00 en 15:00 sterk zijn.
- Bonnen met 5 of 6 artikelen duurden gemiddeld 7,3 minuten, tegenover 4,3 minuten voor bonnen met 1 of 2 artikelen.

Assortiment
- Aardbeiencroissant en aardbeienwafel verkochten elk maar 3 stuks; schrappen is cijfermatig logisch.
- De twee petit-gateaux verkochten samen 53 stuks. Dat is geen nulvraag, maar duidelijk minder dan de klassieke toppers; alleen vervangen als kwaliteit of uitstraling de reden is.
- Vierdaagse Parel verkocht 54 stuks en zat daarmee in de middenmoot. Behouden kan, maar geef het een duidelijke plek naast de vaste hardlopers.
- Puddingbroodjes kwamen 29 keer voor. Plan ze bewust op zondag en maandag, maar niet als groot volumeartikel.
- Grote frisdrankflessen en Choco Twister kunnen uit het kraamassortiment; houd de drankkeuze compact.

Kraam en kas
- Van de gereconstrueerde kraamomzet bleef € 23.250 als briefgeld over: 79,7% van de totale omzet. SumUp was € 4.000, oftewel 13,7%.
- Het genoteerde kraamloon van € 1.180 is 4,0% van de omzet. Bewaar loon en andere kasuitgaven volgend jaar apart van betaalwijzen, zodat omzet, kosten en kascontrole direct leesbaar zijn.
- De oude werkwijze met € 750 wisselgeld in munten van € 0,50, € 1 en € 2 blijft passend.

Conclusie
De Vierdaagse was qua volume en bediening sterk. De grootste winst zit niet in een groter assortiment, maar in extra capaciteit op zondag en maandag, een snellere afhandeling van grotere bonnen en een zuiverdere dagelijkse kasregistratie bij de kraam.`;

const vierdaagseTipsBody = `Volgende editie
- Plan zondag en maandag tussen 11:00 en 15:00 een extra barista en een vaste uitloper/runner. Gebruik donderdag en vrijdag als norm voor de werkwijze.
- Markeer bonnen vanaf 5 artikelen direct als grote bon, zodat ze eerder verdeeld kunnen worden over koffie, gebak en bediening.
- Voeg snelle keuzeopties toe voor havermelk, decaf, slagroom, theesoort, extra bestek en zonder ijs; veel van de 80 vrije notities gingen hierover.
- Houd bij gebak de hardlopers ruim op voorraad: hazelnootbol, cheesecake, Bossche bol en tompouce. Schrap aardbeiencroissant en aardbeienwafel.
- Test een klassiek alternatief voor de petit-gateaux, maar vergelijk volgend jaar verkoop, derving en marge voordat beide verdwijnen.
- Controleer donderdag de voorraad ijs en gebak voor vrijdag en neem puddingbroodjes bewust mee voor zondag en maandag.
- Registreer bij de kraam per dag apart: contant verkocht, pin/SumUp, kasuitgaven, loon, afromingen en eindkas. Dan is de bruto-omzet zonder terugrekening zichtbaar.
- Koppel volgend jaar ook verkoopprijzen of kassa-omzet aan de Ziekerstraat-bonnen. Nu zijn volume en snelheid betrouwbaar, maar omzet en brutomarge per product nog niet.
- Behoud voor Houtlaan de start van Roos en Fien om 02:45 en de rest om 03:15. Malden opnieuw om 05:00 starten met stroom, kraam en 20 stoelen.
- Bezorgers donderdag om 03:15 laten starten; vrijdag om 06:00 en uiterlijk 07:00 laten vertrekken. Lent vrijdagmiddag openhouden of anders tot 15:00.`;

const vierdaagseEvaluation: HolidayEvaluation = {
  slug: "vierdaagse-2026",
  title: "Vierdaagse",
  year: "2026",
  periodLabel: "19 t/m 24 juli",
  calendarOrder: 721,
  icon: "/evaluation-icons/vierdaagse.svg?v=mono-20261002",
  group: "feestdag",
  status: "gevuld",
  summary:
    "Kraamomzet, Ziekerstraat-bonnen, wachttijden, assortiment en planning samengebracht.",
  tags: ["€ 29.155 kraamomzet", "729 bonnen", "2.643 artikelen"],
  documentTitle: "Geschreven evaluatie",
  documentBody: vierdaagseDocumentBody,
  tipsBody: vierdaagseTipsBody,
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
    ["Kraamomzet", "€ 29.155"],
    ["Bonnen Ziekerstraat", "729"],
    ["Artikelen Ziekerstraat", "2.643"],
    ["Gebak/patisserie", "862"],
    ["Mediane levertijd", "4 min"],
    ["SumUp kraam", "€ 4.000"],
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
      title: "Omzet kraam Vierdaagse 2026",
      kind: "PDF",
      detail: "Kasopbouw en gereconstrueerde kraamomzet van € 29.155.",
      href: "/evaluaties/vierdaagse-2026/omzet-kraam-vierdaagse-2026.pdf",
      size: "44 KB",
    },
    {
      title: "Ziekerstraat proeverijrapport 2026",
      kind: "XLSX",
      detail: "729 bonnen met producten, locaties en wacht- en levertijden.",
      href: "/evaluaties/vierdaagse-2026/ziekerstraat-proeverij-rapport-2026.xlsx",
      size: "111 KB",
    },
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
  group: HolidayEvaluation["group"] = "feestdag",
  periodLabel?: string,
  icon = "/icons_strik_agenda.svg",
  calendarOrder?: number
): HolidayEvaluation {
  return {
    slug,
    title,
    year: "volgt",
    periodLabel,
    calendarOrder,
    icon,
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
  title: "Speculaas 1+1 gratis",
  year: "2026",
  periodLabel: "1 t/m 30 september",
  icon: "/evaluation-icons/speculaas.svg?v=mono-20261002",
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
  recipeLinks: [
    {
      id: "recipe-new-1790830768113",
      name: "Speculaasbrok naturel",
      articleNumber: "40825",
      costPrice: 0.727,
      salesPrice: 4.95,
      currentMargin: 84,
      lastUpdated: "2026-10-01",
      quantity: 4223,
      revenueGross: 10533.6,
      capturedAt: "2026-10-02T12:30:00+02:00",
    },
    {
      id: "recipe-new-1782251670930",
      name: "Speculaasbrok met amandel",
      articleNumber: "40826",
      costPrice: 0.811,
      salesPrice: 7.95,
      currentMargin: 88.9,
      lastUpdated: "2026-08-13",
      quantity: 45,
      revenueGross: 352.8,
      capturedAt: "2026-10-02T12:30:00+02:00",
    },
  ],
};

const gebaksactie2026: HolidayEvaluation = {
  slug: "januari-gebaksactie",
  title: "Gebakjes voor €2",
  year: "2026",
  periodLabel: "14 t/m 16 januari",
  icon: "/evaluation-icons/gebakje.svg?v=mono-20261002",
  group: "actie",
  status: "gevuld",
  summary:
    "Verkoopanalyse van de gebaksactie over vijf winkels, inclusief vergelijking met 2025 en advies voor de volgende editie.",
  tags: ["6.499 gebakjes", "€ 16.085 gebaksomzet", "vrijdag +15% plannen"],
  documentTitle: "Evaluatietekst",
  documentBody: `Gebaksactie 2026 · gebakjes voor € 2

Kernresultaat
- Van woensdag 14 t/m vrijdag 16 januari zijn 6.499 gebakjes verkocht.
- De vijf winkels draaiden samen € 31.082 omzet; daarvan was € 16.085 gebaksomzet.
- Gebak vormde daarmee 51,8% van de totale winkelomzet.
- Vrijdag was met 2.929 stuks goed voor 45,1% van alle verkochte gebakjes.

Per winkel
- Heyendaal: 1.832 stuks, € 9.336 winkelomzet en € 4.655 gebaksomzet.
- Lent: 1.668 stuks, € 7.292 winkelomzet en € 4.129 gebaksomzet.
- Daalseweg: 1.069 stuks, € 5.140 winkelomzet en € 2.581 gebaksomzet.
- Ziekerstraat: 1.026 stuks, € 5.790 winkelomzet en € 2.548 gebaksomzet.
- Wijchen: 904 stuks, € 3.525 winkelomzet en € 2.172 gebaksomzet.
- Wijchen had met 61,6% het hoogste aandeel gebak in de winkelomzet; Ziekerstraat met 44,0% het laagste.

Vergelijking met 2025
- Het aantal kwam uit op 49% van 2025: 6.499 tegenover 13.222 gebakjes.
- De totale winkelomzet bleef met € 31.082 op 86% van 2025.
- De gebaksomzet bleef met € 16.085 op 80% van 2025.
- De gemiddelde geregistreerde gebaksomzet per geteld gebakje steeg van € 1,52 naar € 2,48. Dit is geen zuivere actieverkoopprijs: de omzetkolom bevat waarschijnlijk ook gebak buiten de € 2-selectie.
- De vergelijking vraagt voorzichtigheid: volgens de bron liep de actie in 2025 van dinsdag t/m vrijdag, terwijl 2026 alleen woensdag t/m vrijdag toont.

Beoordeling
- De prijsverhoging van € 1,50 naar € 2 beschermde de omzet: het volume halveerde vrijwel, maar de gebaksomzet daalde veel minder sterk.
- Heyendaal en Lent waren de grootste volumelocaties en samen goed voor 53,9% van alle verkochte stuks.
- De voorraad op vrijdag was volgens de evaluatie te laag; er had naar schatting circa 15% meer verkocht kunnen worden.
- Rendement en brutomarge kunnen nog niet definitief worden beoordeeld zonder kostprijs, derving, personeelsinzet en een aparte registratie van de echte actieartikelen.

Datacontrole
- Bij Lent tellen de drie dagbedragen voor gebak op tot € 4.130, terwijl het locatietotaal € 4.129 vermeldt. Het eindtotaal van € 16.085 volgt het locatietotaal; controleer dit verschil van € 1 in de bron.
- 6.499 stuks maal € 2 is € 12.998. Omdat € 16.085 als gebaksomzet staat genoteerd, meten de aantallen en de omzet waarschijnlijk niet exact dezelfde artikelgroep.`,
  tipsBody: `Volgende editie
- Plan vrijdag minimaal 15% ruimer: ongeveer 3.370 gebakjes in plaats van 2.929.
- Richtwaarde vrijdag per winkel: Heyendaal 845, Ziekerstraat 525, Wijchen 490, Daalseweg 555 en Lent 955 stuks.
- Registreer de € 2-actieartikelen met een eigen artikelgroep, zodat aantal × actieprijs direct aansluit op de omzet.
- Noteer dagelijks beginvoorraad, bijproductie, uitverkocht-moment en derving per winkel.
- Vergelijk volgende keer exact dezelfde weekdagen en hetzelfde aantal actiedagen met het voorgaande jaar.
- Leg vóór de actie kostprijs en minimale brutomarge vast; koppel daarna de gebruikte gebaksrecepten aan deze pagina.
- Houd extra voorraad vooral beschikbaar voor vrijdag en voor Heyendaal en Lent.`,
  evaluationSections: [
    {
      title: "Wat ging goed",
      items: [
        "€ 16.085 gebaksomzet uit drie actiedagen.",
        "Gebak vormde 51,8% van de totale winkelomzet.",
        "De hogere actieprijs ving een groot deel van de volumedaling op.",
        "Vrijdag was duidelijk de sterkste verkoopdag.",
      ],
    },
    {
      title: "Wat vraagt aandacht",
      items: [
        "Vrijdag was naar schatting 15% te krap gepland.",
        "Aantallen en gebaksomzet sluiten niet aan op uitsluitend € 2-artikelen.",
        "De vergelijking met 2025 gebruikt niet dezelfde actieduur.",
        "Bij Lent zit € 1 verschil tussen de dagregels en het locatietotaal.",
      ],
    },
  ],
  assortmentKeep: [
    "De € 2-prijs als duidelijke, eenvoudige winkelactie.",
    "Een gezamenlijke actie over alle vijf winkels.",
    "Dagelijkse verkoopcontrole per vestiging.",
  ],
  assortmentStop: [
    "Vrijdag plannen op hetzelfde niveau als woensdag en donderdag.",
    "Actieaantallen vergelijken met een bredere omzetcategorie.",
    "Jaren vergelijken met een verschillend aantal actiedagen.",
  ],
  priceCards: [
    ["Actieprijs 2026", "€ 2,00"],
    ["Actieprijs 2025", "€ 1,50"],
    ["Gebaksomzet per geteld stuk 2026", "€ 2,48"],
    ["Gebaksomzet per geteld stuk 2025", "€ 1,52"],
  ],
  pastryLineup: [],
  revenueItems: [
    ["Verkocht", "6.499"],
    ["Omzet winkels", "€ 31.082"],
    ["Omzet gebak", "€ 16.085"],
    ["Aandeel gebak", "51,8%"],
    ["Verkocht 2025", "13.222"],
    ["Omzet winkels 2025", "€ 36.045"],
    ["Omzet gebak 2025", "€ 20.071"],
  ],
  planningTips: [
    ["Vrijdag", "+15% voorraad plannen"],
    ["Registratie", "Actieartikelen apart meten"],
    ["Vergelijking", "Dezelfde dagen en duur gebruiken"],
    ["Rendement", "Kostprijs, derving en uren vastleggen"],
  ],
  files: [
    {
      title: "Verkoopcijfers gebaksactie 2026",
      kind: "PDF",
      detail: "Omzet en aantallen per dag en winkel, inclusief vergelijking met 2025.",
      href: "/evaluaties/gebaksactie-2026/verkoopcijfers-gebaksactie-2026.pdf",
      size: "1 pagina",
    },
  ],
};

const fixedFeastDayTemplates: HolidayEvaluation[] = [
  createEmptyHoliday(
    "Valentijn",
    "valentijn",
    "feestdag",
    undefined,
    "/evaluation-icons/valentijn.svg?v=mono-20261002",
    214
  ),
  createEmptyHoliday(
    "Pasen",
    "pasen",
    "feestdag",
    undefined,
    "/evaluation-icons/pasen.svg?v=mono-20261002",
    405
  ),
  createEmptyHoliday(
    "Koningsdag",
    "koningsdag",
    "feestdag",
    undefined,
    "/evaluation-icons/koningsdag.svg?v=mono-20261002",
    427
  ),
  createEmptyHoliday(
    "Moederdag",
    "moederdag",
    "feestdag",
    undefined,
    "/evaluation-icons/moederdag-roos.svg?v=mono-20261002",
    510
  ),
  createEmptyHoliday(
    "Vaderdag",
    "vaderdag",
    "feestdag",
    undefined,
    "/evaluation-icons/vaderdag.svg?v=mono-20261002",
    621
  ),
  createEmptyHoliday(
    "Vierdaagse",
    "vierdaagse",
    "feestdag",
    undefined,
    "/evaluation-icons/vierdaagse.svg?v=mono-20261002",
    721
  ),
  createEmptyHoliday(
    "Sinterklaas",
    "sinterklaas",
    "feestdag",
    undefined,
    "/evaluation-icons/sinterklaas.svg?v=mono-20261002",
    1205
  ),
  createEmptyHoliday(
    "Kerst",
    "kerst",
    "feestdag",
    undefined,
    "/evaluation-icons/kerst.svg?v=mono-20261002",
    1225
  ),
  createEmptyHoliday(
    "Oud & Nieuw",
    "oud-en-nieuw",
    "feestdag",
    undefined,
    "/evaluation-icons/oud-en-nieuw.svg?v=mono-20261002",
    1231
  ),
];

export const holidayEvaluations: HolidayEvaluation[] = [
  vierdaagseEvaluation,
  ...fixedFeastDayTemplates,
  speculaasSeptember2026,
  gebaksactie2026,
];

export const feastDayEvaluations = holidayEvaluations.filter(
  (evaluation) => evaluation.group === "feestdag"
);

export const otherActionEvaluations = holidayEvaluations.filter(
  (evaluation) => evaluation.group === "actie"
);

const dutchMonths = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

function dateAtUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number
) {
  const firstDay = dateAtUtc(year, month, 1);
  const offset = (weekday - firstDay.getUTCDay() + 7) % 7;
  return dateAtUtc(year, month, 1 + offset + (occurrence - 1) * 7);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateAtUtc(year, month, day);
}

function formatPeriod(start: Date, end?: Date) {
  const startDay = start.getUTCDate();
  const startMonth = dutchMonths[start.getUTCMonth()];
  if (!end) return `${startDay} ${startMonth}`;

  const endDay = end.getUTCDate();
  const endMonth = dutchMonths[end.getUTCMonth()];
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${startDay} t/m ${endDay} ${startMonth}`
    : `${startDay} ${startMonth} t/m ${endDay} ${endMonth}`;
}

function dateDetailsForFixedFeastDay(slug: string, year: number) {
  let start: Date;
  let end: Date | undefined;

  switch (slug) {
    case "valentijn":
      start = dateAtUtc(year, 2, 14);
      break;
    case "pasen":
      start = easterSunday(year);
      end = addUtcDays(start, 1);
      break;
    case "koningsdag": {
      const april27 = dateAtUtc(year, 4, 27);
      start = april27.getUTCDay() === 0 ? dateAtUtc(year, 4, 26) : april27;
      break;
    }
    case "moederdag":
      start = nthWeekdayOfMonth(year, 5, 0, 2);
      break;
    case "vaderdag":
      start = nthWeekdayOfMonth(year, 6, 0, 3);
      break;
    case "vierdaagse": {
      const thirdTuesday = nthWeekdayOfMonth(year, 7, 2, 3);
      start = addUtcDays(thirdTuesday, -2);
      end = addUtcDays(thirdTuesday, 3);
      break;
    }
    case "sinterklaas":
      start = dateAtUtc(year, 12, 5);
      break;
    case "kerst":
      start = dateAtUtc(year, 12, 25);
      end = dateAtUtc(year, 12, 26);
      break;
    case "oud-en-nieuw":
      start = dateAtUtc(year, 12, 31);
      end = dateAtUtc(year + 1, 1, 1);
      break;
    default:
      return null;
  }

  return {
    calendarOrder: (start.getUTCMonth() + 1) * 100 + start.getUTCDate(),
    periodLabel: formatPeriod(start, end),
  };
}

function instantiateFixedFeastDay(
  template: HolidayEvaluation,
  year: string
): HolidayEvaluation {
  const yearNumber = Number(year);
  const slug = `${template.slug}-${year}`;
  const exactEvaluation = holidayEvaluations.find(
    (evaluation) => evaluation.slug === slug
  );
  if (exactEvaluation) return exactEvaluation;

  const dateDetails = dateDetailsForFixedFeastDay(template.slug, yearNumber);
  return {
    ...template,
    slug,
    year,
    periodLabel: dateDetails?.periodLabel,
    calendarOrder: dateDetails?.calendarOrder ?? template.calendarOrder,
    documentBody: `Evaluatie ${template.title} ${year}\n\nWat ging goed?\n-\n\nWat kan beter?\n-\n\nAssortiment en prijzen\n-\n\nPlanning volgende editie\n-`,
  };
}

export function getFeastDayEvaluationsForYear(year: string) {
  return fixedFeastDayTemplates.map((template) =>
    instantiateFixedFeastDay(template, year)
  );
}

export function getLegacyFeastDaySlug(slug: string) {
  const match = /^(.*)-(\d{4})$/.exec(slug);
  if (!match || match[2] !== "2026") return null;

  return fixedFeastDayTemplates.some((template) => template.slug === match[1])
    ? match[1]
    : null;
}

export function getHolidayEvaluation(slug: string) {
  const exactEvaluation = holidayEvaluations.find(
    (holiday) => holiday.slug === slug
  );
  if (exactEvaluation) return exactEvaluation;

  const match = /^(.*)-(\d{4})$/.exec(slug);
  if (!match) return null;

  const template = fixedFeastDayTemplates.find(
    (evaluation) => evaluation.slug === match[1]
  );
  return template ? instantiateFixedFeastDay(template, match[2]) : null;
}
