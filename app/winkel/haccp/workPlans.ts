import { WINKEL_STORE_IDS } from "../../lib/auth/access";

export type WinkelWorkPlanStoreId = (typeof WINKEL_STORE_IDS)[number];

export type WinkelWorkPlanId =
  | "schoonmaakrooster"
  | "afsluitplan"
  | "opstartplan";

export type WinkelWorkPlanItem = {
  id: string;
  label: string;
  detail?: string;
  steps?: string[];
  warning?: string;
  visibleOnWeekdays?: number[];
};

export type WinkelWorkPlanSection = {
  id: string;
  title: string;
  subtitle?: string;
  visibleOnWeekdays?: number[];
  items: WinkelWorkPlanItem[];
};

export type WinkelWorkPlanDefinition = {
  id: WinkelWorkPlanId;
  storeId: WinkelWorkPlanStoreId;
  storeLabel: string;
  title: string;
  subtitle: string;
  cadenceLabel: string;
  visibleOnWeekdays?: number[];
  sections: WinkelWorkPlanSection[];
};

export const WINKEL_WORK_PLAN_STORE_LABELS: Record<
  WinkelWorkPlanStoreId,
  string
> = {
  ziekerstraat: "Ziekerstraat",
  heyendaal: "Heyendaal",
  daalseweg: "Daalseweg",
  lent: "Lent",
};

const allWeekdays = [0, 1, 2, 3, 4, 5, 6];
const mondayThroughFriday = [1, 2, 3, 4, 5];

const heyendaalDailyCleaningItems: WinkelWorkPlanItem[] = [
  { id: "dag-stellage-oven", label: "Stellage onder de oven kruimelvrij" },
  { id: "dag-werkbank", label: "Werkbank schoon" },
  { id: "dag-glaswerk-vitrine", label: "Glaswerk vitrine schoon" },
  { id: "dag-aanvul-dozen-zakken", label: "Aanvul dozen en zakken" },
  {
    id: "dag-aanvul-macaron-amandelwerk",
    label: "Aanvul macaron en amandelwerk",
  },
  { id: "dag-aanvul-winkel", label: "Aanvul winkel" },
  { id: "dag-stofzuig", label: "Stofzuigen" },
  { id: "dag-legen-waterbak", label: "Waterbak legen" },
  {
    id: "dag-kasten-stukwerk-kassa",
    label: "Kasten onder stukwerk en kassa's schoon",
    detail: "Alles eruit halen.",
  },
  { id: "dag-choco-schap", label: "Choco schap voor kassa's schoon" },
  { id: "dag-bonbons", label: "Bonbons aanvullen" },
  { id: "dag-bladeren", label: "Bladeren buiten voor aanvegen" },
].map((item) => ({
  ...item,
  // Saturday's vacuuming is listed once in the after-closing block.
  visibleOnWeekdays: item.id === "dag-stofzuig" ? [0, 1, 2, 3, 4, 5] : allWeekdays,
}));

export const winkelWorkPlanDefinitions: WinkelWorkPlanDefinition[] = [
  {
    id: "schoonmaakrooster",
    storeId: "heyendaal",
    storeLabel: "Heyendaal",
    title: "Schoonmaakrooster Heyendaal",
    subtitle: "Weektaak per dag, weekendtaken per tijdblok en vaste dagtaken.",
    cadenceLabel: "per dag",
    sections: [
      {
        id: "week-maandag",
        title: "Weektaak maandag",
        items: [
          {
            id: "ma-koelmeubel-winkel",
            label: "Koelmeubel winkel schoon",
            detail: "Bovenop, erin en onder de platen.",
            visibleOnWeekdays: [1],
          },
          {
            id: "ma-etalage",
            label: "Etalage schoon",
            detail: "Stofvrij maken.",
            visibleOnWeekdays: [1],
          },
          {
            id: "ma-grote-vriezers-achter",
            label: "Grote vriezers achter opruimen",
            visibleOnWeekdays: [1],
          },
        ],
      },
      {
        id: "week-dinsdag",
        title: "Weektaak dinsdag",
        items: [
          {
            id: "di-koelingen-achter",
            label: "Koelingen achter schoon",
            detail: "Kleine en grote koeling.",
            visibleOnWeekdays: [2],
          },
          {
            id: "di-koekschappen",
            label: "Koekschappen en schap suikerbrood schoon",
            detail: "Alles van z'n plaats en datumcheck doen.",
            visibleOnWeekdays: [2],
          },
        ],
      },
      {
        id: "week-woensdag",
        title: "Weektaak woensdag",
        items: [
          {
            id: "wo-hoog-schapje",
            label: "Hoge schapje achter gebaksvitrine schoon",
            visibleOnWeekdays: [3],
          },
          {
            id: "wo-glazen-achterwand",
            label: "Glazen achterwand naast broodschap schoon",
            visibleOnWeekdays: [3],
          },
        ],
      },
      {
        id: "week-donderdag",
        title: "Weektaak donderdag",
        items: [
          {
            id: "do-choco-hok",
            label: "Choco hok opruimen",
            visibleOnWeekdays: [4],
          },
          {
            id: "do-werkbank-bureau",
            label: "Werkbank en bureau opruimen",
            visibleOnWeekdays: [4],
          },
        ],
      },
      {
        id: "week-vrijdag",
        title: "Weektaak vrijdag",
        items: [
          {
            id: "vr-wc",
            label: "WC schoon",
            visibleOnWeekdays: [5],
          },
          {
            id: "vr-vriesmeubel-winkel",
            label: "Vriesmeubel winkel schoon",
            detail: "Plus schapjes erop en erachter stofvrij. Alles van z'n plek en datumcheck doen.",
            visibleOnWeekdays: [5],
          },
        ],
      },
      {
        id: "week-zaterdag",
        title: "Weektaak zaterdag",
        visibleOnWeekdays: [6],
        items: [
          { id: "za-oven", label: "Oven schoon", visibleOnWeekdays: [6] },
        ],
      },
      {
        id: "zaterdag-voor-13",
        title: "Zaterdag · vóór 13:00",
        subtitle: "Schoonmaak achter. Vergeet ook de algemene dagtaken niet.",
        visibleOnWeekdays: [6],
        items: [
          { id: "za-werkbanken", label: "Alle werkbanken schoon en kruimelvrij" },
          { id: "za-stofzuig-achter", label: "Achter stofzuigen, inclusief het chocohok" },
          {
            id: "za-schrobben-achter",
            label: "Achter schrobben en het water wegtrekken, inclusief het chocohok",
            detail: "Haal de werkbanken aan de kant, zodat je ook eronder kunt schoonmaken.",
          },
          { id: "za-nadweilen", label: "Indien nodig nadweilen" },
          { id: "za-zondag-klaarleggen", label: "Croissants, broodjes en VGB-broden klaarleggen voor zondag" },
        ],
      },
      {
        id: "zaterdag-na-17",
        title: "Zaterdag · na 17:00",
        visibleOnWeekdays: [6],
        items: [
          {
            id: "za-broodmachine-compressor",
            label: "Snijmachine uitspuiten",
            detail: "Haal de snijmachine naar achteren, open de achterkant met de sleutel en spuit de machine uit met de compressor.",
          },
          {
            id: "za-vitrine",
            label: "Gebakskoeling leeg én schoon",
            steps: [
              "Haal alle gebaksplaten eruit en was ze apart af.",
              "Maak alle richeltjes van de gebaksplaten apart schoon; er mogen geen gebaksresten zichtbaar zijn.",
              "Haal alle witte rekjes aan de onderkant eruit en was ze apart af.",
              "Maak de binnenkant van de vitrine schoon.",
              "Haal de vitrine aan de voorkant naar voren en neem de binnenkant van het glaswerk af.",
              "Maak de voorkanten van de gebaksvitrine schoon; er mogen geen gebaksresten zichtbaar zijn.",
              "Plaats de roosters en gebaksplaatjes terug, inclusief het gebak voor verkoop op zondag.",
            ],
          },
        ],
      },
      {
        id: "zaterdag-na-sluiting",
        title: "Zaterdag · na sluitingstijd",
        visibleOnWeekdays: [6],
        items: [
          { id: "dag-stofzuig", label: "Winkel stofzuigen" },
          {
            id: "za-schrobben-plinten",
            label: "Winkelvloer schrobben en plinten afnemen",
            steps: ["Schrob de winkelvloer en trek het water naar buiten.", "Neem de plinten af."],
          },
        ],
      },
      {
        id: "zondag-na-sluiting",
        title: "Zondag · na sluitingstijd",
        subtitle: "Extra weekendtaken, naast de reguliere schoonmaaktaken. Gebruik het FIFO-plan bij het leeghalen.",
        visibleOnWeekdays: [0],
        items: [
          {
            id: "zo-zelfbedieningskoeling",
            label: "Zelfbedieningskoeling leeg en schoon",
            steps: [
              "Zet de koeling uit met de knop aan de onderzijde.",
              "Leg alle producten in winkelmandjes en doe de FIFO-check: welke producten gaan retour? Check het FIFO-plan.",
              "Haal alle witte plaatjes eruit, was ze per stuk af en leg ze in de keuken te drogen.",
              "Maak de koeling schoon.",
              "Til de plaat omhoog en maak ook de onderkant van de koeling schoon.",
            ],
          },
          {
            id: "zo-gebakskoeling",
            label: "Gebakskoeling leeg en schoon",
            steps: [
              "Haal het gebak uit de koeling en check het FIFO-plan. Zet gebak dat door kan naar maandag in de koelcel.",
              "Zet de koeling uit met de knop aan de onderkant.",
              "Maak gebruikte plaatjes schoon.",
              "Maak het glaswerk van de deurtjes schoon met Glassex.",
            ],
          },
        ],
      },
      {
        id: "zondag-fifo",
        title: "Zondag · FIFO-plan",
        subtitle: "Controleer de datum onder het karton van alle taarten en vlaaien, zodat maandag met vers gebak begint.",
        visibleOnWeekdays: [0],
        items: [
          {
            id: "zo-fifo-retour",
            label: "Retour selecteren",
            steps: [
              "Al het gebak van vrijdag of ouder gaat retour. Houd bij om welke producten het gaat.",
              "Bossche bollen en tompoucen van zaterdag of ouder gaan retour.",
              "Vlaaien van zaterdag: beoordeel kritisch of ze nog representatief zijn voor verkoop. Alleen goed uitziende vlaaien mogen maandag nog verkocht worden; de overige gaan retour.",
            ],
            warning: "Maak voor je collega's duidelijk welke vlaaien na maandag retour moeten. Vlaaien van vrijdag of ouder gaan altijd retour.",
          },
          {
            id: "zo-fifo-invriezen",
            label: "Invriezen · alleen gebak van zaterdag",
            detail: "Herfstparel, brownie tresor, hazelino, passiebombe, framboos slagroom, steventje, carrot rondo, red velvet punt en cheesecake punt.",
            warning: "Vries deze producten alleen in als ze van zaterdag zijn.",
          },
          {
            id: "zo-fifo-maandag",
            label: "Door naar maandag",
            steps: [
              "Appelpunt, appel carré, nougatine vanille en pistache slofje.",
              "Sloffen, appelfleur en petit gateau: alleen met een houdbaarheidsdatum tot maandag of later.",
              "Zet het gebak dat door kan naar maandag in de koelcel.",
            ],
            warning: "Geef alle producten die tot maandag goed zijn bij het afsluiten alvast een 20%- of 50%-sticker.",
          },
        ],
      },
      {
        id: "dagtaken",
        title: "Dagtaken",
        subtitle: "Naam wordt automatisch opgeslagen bij afvinken.",
        items: heyendaalDailyCleaningItems,
      },
    ],
  },
  {
    id: "afsluitplan",
    storeId: "heyendaal",
    storeLabel: "Heyendaal",
    title: "Afsluitplan Heyendaal",
    subtitle: "Maandag t/m vrijdag, compact per tijdblok.",
    cadenceLabel: "per dag",
    visibleOnWeekdays: mondayThroughFriday,
    sections: [
      {
        id: "voor-13",
        title: "Voor 13:00",
        subtitle: "Voordat degene van de ochtend naar huis gaat.",
        items: [
          {
            id: "voor13-achter-opruimen",
            label: "Achter opruimen en stofzuigen",
            detail: "Inclusief oven.",
          },
          {
            id: "voor13-croissants",
            label: "Croissants klaarleggen voor volgende dag",
          },
          {
            id: "voor13-broodjeshoek",
            label: "Broodjeshoek uitvegen",
            detail: "Broodjes naar voren op het rek.",
          },
          {
            id: "voor13-vriezer-aanvul",
            label: "Producten uit vriezer halen ter aanvul",
          },
          {
            id: "voor13-grote-oven-uit",
            label: "Grote oven uitzetten",
            detail: "Vanaf nu alleen nog de sneloven gebruiken.",
          },
        ],
      },
      {
        id: "tussen-13-15",
        title: "13:00 - 15:00",
        items: [
          {
            id: "13-15-producten-aanvullen",
            label: "Producten aanvullen",
            detail: "Alles eerst juiste datumstickers en groene stickers geven.",
          },
          {
            id: "13-15-vriezer-koeling",
            label: "Vriezer en zelfbedieningskoeling aanvullen",
            detail: "FIFO: nieuwste taartjes onderaan.",
          },
          {
            id: "13-15-verpakking",
            label: "Verpakking aanvullen",
            detail: "Check alle verpakking in de winkel.",
          },
          {
            id: "13-15-schoonmaak-check",
            label: "Schoonmaaktaken van vandaag checken",
            detail: "Deze staan ook in de app.",
          },
        ],
      },
      {
        id: "vanaf-15",
        title: "Vanaf 15:00 / 15:30",
        items: [
          {
            id: "15-brood-controleren",
            label: "Brood controleren",
            detail: "Wat kan morgen opgepiept worden, wat is teveel en vries je ongesneden in?",
          },
          {
            id: "15-broodrekken-vegen",
            label: "Broodrekken en broodvloer kruimelvrij maken",
            detail: "Ook vakjes met verpakkingsmateriaal.",
          },
          {
            id: "15-broodmachine-vegen",
            label: "Broodmachine vegen",
            detail: "Plastic zak met broodkruimels vervangen.",
          },
          { id: "15-broodmachine-achter", label: "Broodmachine naar achter" },
          {
            id: "15-broodkratten-kar",
            label: "Kar met rode broodkratten naar achter rijden",
          },
          {
            id: "15-vitrine-schoon",
            label: "Vitrine schoonmaken",
            detail: "Lege plaatjes helemaal schoon; plaatjes met producten zo kruimelvrij mogelijk.",
          },
          {
            id: "15-stofzuigen",
            label: "Stofzuigen op rustige momenten",
            detail: "Stofzuiger altijd uit wanneer klanten binnenkomen.",
          },
          {
            id: "15-glaswerk",
            label: "Glaswerk schoon",
            detail: "Met Glassex en torkrol.",
          },
          {
            id: "15-sneloven",
            label: "Sneloven uitzetten en schoonmaken",
            detail: "Kruimelvrij maken en van binnen schoonmaken.",
          },
        ],
      },
      {
        id: "rond-16-30",
        title: "Rond 16:30 / 17:00",
        items: [
          {
            id: "1630-nogmaals-stofzuigen",
            label: "Wanneer nodig nog een keer stofzuigen",
            detail: "Daarna stofzuiger terug op zijn plek.",
          },
          {
            id: "1630-winkelplanning",
            label: "Winkelplanning voor morgen invullen",
            detail: "Check verpakkingsmateriaal, voorraad vriezer en aanbiedingen van de week.",
          },
          {
            id: "1630-brood-opruimen",
            label: "Brood opruimen",
            detail: "In mandje van brood van gisteren of achter in de koeling voor Mark.",
          },
          {
            id: "1630-muntgeld",
            label: "Als er tijd is: muntgeld alvast tellen",
            detail: "Dan weet je na sluiting direct vanaf waar je tot 300 euro telt.",
          },
          {
            id: "1630-vuilnis",
            label: "Vuilniszakken vervangen en vuilnis klaarzetten",
            detail: "Niet op de grond, altijd in een krat of ergens op.",
          },
          {
            id: "1630-broodkratten",
            label: "Broodkratten klaarzetten",
            detail: "Koenen ongeveer wat er 's ochtends kwam; rest voor Strik.",
          },
        ],
      },
      {
        id: "deur-op-slot",
        title: "17:30 - deur op slot",
        items: [
          {
            id: "1730-platen-koelingen",
            label: "Alle platen op de koelingen en vriezer leggen",
          },
          {
            id: "1730-zon-scherm",
            label: "Bij zon scherm naar beneden",
            detail: "Zet waar nodig dozen voor de bonbons.",
          },
          {
            id: "1730-kassa",
            label: "Kassa afsluiten",
            detail: "Blauwe zakje met startgeld in de vriezer; omzetzakje in de kluis.",
          },
          {
            id: "1730-lichten",
            label: "Alle lichten uit",
            detail: "Ook de lichten van de gebakskoeling.",
          },
          {
            id: "1730-airco",
            label: "Airco in de zomer controleren",
            detail: "Altijd controleren of deze aan staat.",
          },
        ],
      },
    ],
  },
];

export function isWinkelWorkPlanStoreId(
  value: string
): value is WinkelWorkPlanStoreId {
  return WINKEL_STORE_IDS.includes(value as WinkelWorkPlanStoreId);
}

export function isWinkelWorkPlanId(value: string): value is WinkelWorkPlanId {
  return (
    value === "schoonmaakrooster" ||
    value === "afsluitplan" ||
    value === "opstartplan"
  );
}

export function getWinkelWorkPlanDefinition(
  storeId: string,
  planId: string
) {
  return winkelWorkPlanDefinitions.find(
    (definition) => definition.storeId === storeId && definition.id === planId
  );
}

export function getWinkelWorkPlansForStore(storeId: string) {
  return winkelWorkPlanDefinitions.filter(
    (definition) => definition.storeId === storeId
  );
}

export function getWinkelWorkPlansForPlan(planId: WinkelWorkPlanId) {
  return winkelWorkPlanDefinitions.filter(
    (definition) => definition.id === planId
  );
}

export function flattenWinkelWorkPlanItems(
  definition: WinkelWorkPlanDefinition
) {
  return definition.sections.flatMap((section) => section.items);
}
