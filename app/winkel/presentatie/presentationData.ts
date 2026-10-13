export type PresentationPriority = "A" | "B" | "C";
export type PresentationClimate = "ongekoeld" | "gekoeld" | "vries";
export type PresentationCategory =
  | "brood"
  | "chocolade"
  | "gebak"
  | "hartig"
  | "cadeau"
  | "seizoen";

export type PresentationTouchpoint = {
  id: string;
  code: string;
  label: string;
  shortLabel: string;
  priority: PresentationPriority;
  climate: PresentationClimate;
  photoUrl: string;
  photoAlt: string;
  additionalPhotos?: { url: string; alt: string }[];
  movable?: boolean;
  advice: string;
  fixedUse: string;
  suitableFor: PresentationCategory[];
  map: { x: number; y: number; width: number; height: number };
};

export const PRESENTATION_CATEGORY_LABELS: Record<PresentationCategory, string> = {
  brood: "Brood",
  chocolade: "Chocolade",
  gebak: "Gebak",
  hartig: "Hartig",
  cadeau: "Cadeau",
  seizoen: "Seizoen",
};

export const HEYENDAAL_TOUCHPOINTS: PresentationTouchpoint[] = [
  {
    id: "koekmeubel",
    code: "A1",
    label: "Koekmeubel bij de ingang",
    shortLabel: "Koekmeubel",
    priority: "A",
    climate: "ongekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-b2-broodrekken.jpeg",
    photoAlt: "Koekmeubel recht voor de ingang, bij de Strik-pilaar",
    advice: "Hoofdplek voor één duidelijke week- of seizoensactie. Houd het beeld groot en rustig.",
    fixedUse: "Maximaal één hoofdactie; voorkant volledig herkenbaar vanaf de ingang.",
    suitableFor: ["brood", "chocolade", "cadeau", "seizoen"],
    map: { x: 520, y: 278, width: 240, height: 110 },
  },
  {
    id: "koekmeubel-voorkant",
    code: "A1a",
    label: "Koekmeubel · A1 voorkant",
    shortLabel: "Koek · voorkant",
    priority: "A",
    climate: "ongekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-a1-koekmeubel.jpeg",
    photoAlt: "Voorkant van het koekmeubel om de hoek van de grote pilaar",
    advice: "Stem dit deel af op de hoofdactie van het koekmeubel bij de ingang.",
    fixedUse: "Eén samenhangende presentatie rond de pilaar; houd de loopruimte vrij.",
    suitableFor: ["brood", "chocolade", "cadeau", "seizoen"],
    map: { x: 400, y: 278, width: 120, height: 110 },
  },
  {
    id: "etalage",
    code: "A2",
    label: "Etalage aan de voorzijde",
    shortLabel: "Etalage",
    priority: "A",
    climate: "ongekoeld",
    photoUrl: "",
    photoAlt: "Etalage",
    advice: "Gebruik voor een campagne die ook buiten de winkel direct herkenbaar moet zijn.",
    fixedUse: "Werk in één thema en herhaal niet het volledige assortiment.",
    suitableFor: ["chocolade", "cadeau", "seizoen"],
    map: { x: 430, y: 415, width: 170, height: 36 },
  },
  {
    id: "presentatieschap",
    code: "A3",
    label: "Presentatieschap achterin",
    shortLabel: "Presentatieschap",
    priority: "A",
    climate: "ongekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-a3-presentatieschap.jpeg",
    photoAlt: "Het presentatieschap achter de gebaksvitrine",
    advice: "Sterke tweede campagneplek voor cadeaus, nieuw assortiment of een seizoenslijn.",
    fixedUse: "Eén productfamilie met voldoende lege ruimte rondom.",
    suitableFor: ["chocolade", "cadeau", "seizoen"],
    map: { x: 420, y: 26, width: 290, height: 30 },
  },
  {
    id: "groene-kast",
    code: "A4",
    label: "Grote groene wandkast",
    shortLabel: "Groene kast",
    priority: "A",
    climate: "ongekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-a4-groene-kast.jpeg",
    photoAlt: "De grote groene verlichte kast in Heyendaalseweg",
    advice: "Geschikt voor een groter assortiment met vaste vakken en één blikvanger bovenin.",
    fixedUse: "Bovenste plank is blikvanger; overige planken blijven logisch per productgroep.",
    suitableFor: ["brood", "chocolade", "cadeau", "seizoen"],
    map: { x: 730, y: 24, width: 250, height: 72 },
  },
  {
    id: "grijpschap-kassa",
    code: "A5",
    label: "Grijpschap bij de kassa",
    shortLabel: "Kassa-grijpschap",
    priority: "A",
    climate: "ongekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-a5-grijpschap.jpeg",
    photoAlt: "Kleine cadeauproducten en chocolade bij de kassa",
    advice: "Alleen kleine impulsaankopen met een eenvoudige boodschap en duidelijke prijs.",
    fixedUse: "Maximaal twee artikelen; altijd direct mee te nemen.",
    suitableFor: ["chocolade", "cadeau", "seizoen"],
    map: { x: 270, y: 190, width: 85, height: 38 },
  },
  {
    id: "broodrekken",
    code: "B2",
    label: "Broodrekken linksachter",
    shortLabel: "Broodrekken",
    priority: "B",
    climate: "ongekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-b1-broodschap.jpeg",
    photoAlt: "Witte broodrekken achter de toonbank",
    advice: "Vaste broodpresentatie; een aanbieding krijgt hier één herkenbaar vak.",
    fixedUse: "Dagelijks brood blijft leidend; maximaal één actievak.",
    suitableFor: ["brood"],
    map: { x: 24, y: 25, width: 175, height: 82 },
  },
  {
    id: "chocoladewand",
    code: "B3",
    label: "Chocolade-wandschap",
    shortLabel: "Chocoladewand",
    priority: "B",
    climate: "ongekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-b3-chocoladewand.jpeg",
    photoAlt: "De bonbon- en chocoladewand van Heyendaalseweg",
    advice: "Gebruik voor verdieping van een chocolade- of cadeauactie, niet als tweede hoofdtafel.",
    fixedUse: "Behoud vaste productgroepen; campagneproducten krijgen één afgebakend vlak.",
    suitableFor: ["chocolade", "cadeau", "seizoen"],
    map: { x: 22, y: 302, width: 55, height: 150 },
  },
  {
    id: "gebaksvitrine",
    code: "B4",
    label: "Gebaksvitrine",
    shortLabel: "Gebaksvitrine",
    priority: "B",
    climate: "gekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-b4-gebaksvitrine.jpeg",
    photoAlt: "De grote gebaksvitrine van Heyendaalseweg",
    advice: "Hoofdplek voor gekoelde gebakaanbiedingen; reserveer één volledig vak.",
    fixedUse: "Niet over meerdere schappen verspreiden; prijskaartje direct bij het product.",
    suitableFor: ["gebak", "seizoen"],
    map: { x: 440, y: 125, width: 270, height: 72 },
  },
  {
    id: "hartige-vitrine",
    code: "B5",
    label: "Hartige deel van de vitrine",
    shortLabel: "Hartige vitrine",
    priority: "B",
    climate: "gekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-b5-hartige-vitrine.jpeg",
    photoAlt: "Het hartige gedeelte van de vitrine in Heyendaalseweg",
    advice: "Voor lunch- en snackacties. Houd één soort bij elkaar en vul zichtbaar bij.",
    fixedUse: "Alleen hartige producten; geen cadeau- of broodpresentatie.",
    suitableFor: ["hartig"],
    map: { x: 345, y: 125, width: 92, height: 72 },
  },
  {
    id: "zelfbedieningskoeling",
    code: "B6",
    label: "Zelfbedieningskoeling bij het raam",
    shortLabel: "Zelfbedieningskoeling",
    priority: "B",
    climate: "gekoeld",
    photoUrl: "/winkelpresentatie/heyendaal-a2-etalage.jpeg",
    photoAlt: "Zelfbedieningskoeling bij het raam",
    advice: "Plaats gekoelde meeneemproducten in één herkenbaar vak.",
    fixedUse: "Houd de koeling toegankelijk en behoud de gekoelde productgroepen.",
    suitableFor: ["gebak", "hartig", "seizoen"],
    map: { x: 905, y: 120, width: 74, height: 194 },
  },
  {
    id: "verrijdbaar-broodrek",
    code: "B7",
    label: "Verrijdbaar broodrek voor dagbroden",
    shortLabel: "Dagbroden",
    priority: "B",
    climate: "ongekoeld",
    movable: true,
    photoUrl: "",
    photoAlt: "",
    advice: "Verrijdbaar rek rechts naast de gebaksvitrine voor dagbroden. Alleen gebruiken wanneer het rek aanwezig is.",
    fixedUse: "Niet altijd aanwezig; houd de doorgang naast de vitrine vrij.",
    suitableFor: ["brood"],
    map: { x: 725, y: 125, width: 145, height: 72 },
  },
  {
    id: "vriezer",
    code: "C1",
    label: "Vriezer rechtsvoor",
    shortLabel: "Vriezer",
    priority: "C",
    climate: "vries",
    photoUrl: "/winkelpresentatie/heyendaal-c1-vriezer.jpeg",
    photoAlt: "De vriespresentatie bij het raam in Heyendaalseweg",
    advice: "Alleen inzetten wanneer de actie daadwerkelijk uit de vriezer wordt verkocht.",
    fixedUse: "Niet gebruiken als algemene campagneplek.",
    suitableFor: ["gebak", "seizoen"],
    map: { x: 905, y: 314, width: 74, height: 138 },
  },
];

export const HEYENDAAL_TOUCHPOINT_BY_ID = new Map(
  HEYENDAAL_TOUCHPOINTS.map((touchpoint) => [touchpoint.id, touchpoint])
);

export const CATEGORY_RECOMMENDATIONS: Record<
  PresentationCategory,
  { touchpointId: string; role: "hoofdplek" | "ondersteuning"; instruction: string }[]
> = {
  brood: [
    { touchpointId: "koekmeubel", role: "hoofdplek", instruction: "Bouw één ruim en herkenbaar actieblok." },
    { touchpointId: "broodrekken", role: "ondersteuning", instruction: "Herhaal het product in één vast vak." },
  ],
  chocolade: [
    { touchpointId: "koekmeubel", role: "hoofdplek", instruction: "Maak één groot chocoladebeeld met voldoende voorraad." },
    { touchpointId: "chocoladewand", role: "ondersteuning", instruction: "Maak één duidelijk campagnevak in de vaste wand." },
  ],
  gebak: [
    { touchpointId: "gebaksvitrine", role: "hoofdplek", instruction: "Reserveer één compleet vak en plaats de prijs direct ervoor." },
  ],
  hartig: [
    { touchpointId: "hartige-vitrine", role: "hoofdplek", instruction: "Bundel de actie in één gevuld vak." },
  ],
  cadeau: [
    { touchpointId: "koekmeubel", role: "hoofdplek", instruction: "Toon één compleet cadeauverhaal, niet meerdere losse thema’s." },
    { touchpointId: "grijpschap-kassa", role: "ondersteuning", instruction: "Plaats één klein meeneemartikel uit dezelfde lijn." },
  ],
  seizoen: [
    { touchpointId: "koekmeubel", role: "hoofdplek", instruction: "Maak dit de centrale seizoenspresentatie." },
    { touchpointId: "etalage", role: "ondersteuning", instruction: "Laat buiten direct hetzelfde thema zien." },
    { touchpointId: "presentatieschap", role: "ondersteuning", instruction: "Herhaal alleen de belangrijkste productfamilie." },
  ],
};

export function isPresentationCategory(value: string): value is PresentationCategory {
  return value in PRESENTATION_CATEGORY_LABELS;
}

export function getCurrentWeekStart(date = new Date()) {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = localDate.getDay() || 7;
  localDate.setDate(localDate.getDate() - day + 1);

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateOfMonth}`;
}

export function normalizeWeekStart(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return getCurrentWeekStart();

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return getCurrentWeekStart();

  return getCurrentWeekStart(date);
}

export function formatPresentationWeek(value: string) {
  const [year, month, day] = normalizeWeekStart(value).split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startText = start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  const endText = end.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  return `${startText} t/m ${endText}`;
}
