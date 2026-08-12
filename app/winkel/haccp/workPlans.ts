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
  visibleOnWeekdays?: number[];
};

export type WinkelWorkPlanSection = {
  id: string;
  title: string;
  subtitle?: string;
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

const allWeekdays = [1, 2, 3, 4, 5, 6];
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
].map((item) => ({ ...item, visibleOnWeekdays: allWeekdays }));

export const winkelWorkPlanDefinitions: WinkelWorkPlanDefinition[] = [
  {
    id: "schoonmaakrooster",
    storeId: "heyendaal",
    storeLabel: "Heyendaal",
    title: "Schoonmaakrooster Heyendaal",
    subtitle: "Weektaak per dag plus vaste dagtaken.",
    cadenceLabel: "per werkdag",
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
        items: [
          {
            id: "za-vitrine",
            label: "Vitrine schoon",
            detail: "Alles eruit, ramen, stellage en daaronder.",
            visibleOnWeekdays: [6],
          },
          { id: "za-oven", label: "Oven schoon", visibleOnWeekdays: [6] },
          {
            id: "za-schrobben-plinten",
            label: "Schrobben en daarna plinten schoon",
            visibleOnWeekdays: [6],
          },
          {
            id: "za-broodmachine-compressor",
            label: "Broodmachine achter met compressor uitspuiten",
            visibleOnWeekdays: [6],
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
