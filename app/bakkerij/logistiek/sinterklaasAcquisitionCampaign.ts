import type {
  LogisticsAcquisitionCampaign,
  LogisticsAcquisitionStop,
} from "./logisticsTypes";

export const sinterklaasAcquisitionCampaignId =
  "sinterklaas-folder-bedrijven-2026";
export const sinterklaasAcquisitionStartDate = "2026-10-08";
export const sinterklaasAcquisitionEndDate = "2026-10-17";

type CampaignStopSeed = Omit<LogisticsAcquisitionStop, "id" | "attention">;

const stopSeeds: CampaignStopSeed[] = [
  { company: "Nexperia B.V.", street: "Jonkerbosplein 52", postalCode: "6534 AB", city: "Nijmegen", routeCluster: "south" },
  { company: "Synthon B.V.", street: "Microweg 22", postalCode: "6545 CM", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "Symeres", street: "Kerkenbos 1013", postalCode: "6546 BB", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "AstraZeneca Nijmegen B.V.", street: "Lagelandseweg 78", postalCode: "6545 CG", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "Byondis B.V.", street: "Microweg 22", postalCode: "6545 CM", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "Batenburg Installatietechniek", street: "Factorijweg 15", postalCode: "6541 DM", city: "Nijmegen", routeCluster: "west" },
  { company: "DFDS Logistics Nijmegen B.V.", street: "Bedrijfsweg 8", postalCode: "6541 DC", city: "Nijmegen", routeCluster: "west" },
  { company: "Dar N.V.", street: "Kanaalstraat 401", postalCode: "6541 XK", city: "Nijmegen", routeCluster: "west" },
  { company: "Kropman Installatietechniek", street: "Lagelandseweg 84", postalCode: "6545 CG", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "Lamers High Tech Systems", street: "De Vlotkampweg 38", postalCode: "6545 AG", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "Sealed Air B.V.", street: "Lindenhoutseweg 45", postalCode: "6545 AH", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "Valuepack B.V.", street: "De Vlotkampweg 4", postalCode: "6545 AG", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "ROC Nijmegen", street: "Campusbaan 6", postalCode: "6512 BT", city: "Nijmegen", routeCluster: "station" },
  { company: "Hyster-Yale Group", street: "Nijverheidsweg 29", postalCode: "6541 CL", city: "Nijmegen", routeCluster: "west" },
  { company: "Cornelissen Transport", street: "Goudwerf 15", postalCode: "6641 TE", city: "Beuningen", routeCluster: "beuningen-weurt" },
  { company: "Klingele Golfkarton", street: "Binderskampweg 27", postalCode: "6545 CA", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "KlokGroep", street: "Kanaalstraat 200", postalCode: "6541 XN", city: "Nijmegen", routeCluster: "west" },
  { company: "WerkBedrijf Rijk van Nijmegen", street: "Nieuwe Dukenburgseweg 21A", postalCode: "6534 AD", city: "Nijmegen", routeCluster: "south" },
  { company: "De Variabele Groep", street: "Weurtseweg 500", postalCode: "6541 BE", city: "Nijmegen", routeCluster: "west" },
  { company: "Duynie Group", street: "Handelsweg 36-38", postalCode: "6541 CT", city: "Nijmegen", routeCluster: "west" },
  { company: "Max Planck Institute for Psycholinguistics", street: "Wundtlaan 1", postalCode: "6525 XD", city: "Nijmegen", routeCluster: "east" },
  { company: "ANAC Nijmegen", street: "Energieweg 100", postalCode: "6541 CZ", city: "Nijmegen", routeCluster: "west" },
  { company: "ARN B.V.", street: "Nieuwe Pieckelaan 1", postalCode: "6551 DX", city: "Weurt", routeCluster: "beuningen-weurt" },
  { company: "BCTN Nijmegen", street: "Winselingseweg 80", postalCode: "6541 AH", city: "Nijmegen", routeCluster: "west" },
  { company: "HKS Metals Nijmegen", street: "Nijverheidsweg 72", postalCode: "6541 CN", city: "Nijmegen", routeCluster: "west" },
  { company: "Planon", street: "Wijchenseweg 8", postalCode: "6537 TL", city: "Nijmegen", routeCluster: "dukenburg" },
  { company: "Bovemij Group", street: "Takenhofplein 2", postalCode: "6538 SZ", city: "Nijmegen", routeCluster: "dukenburg" },
  { company: "GX Software", street: "Wijchenseweg 111", postalCode: "6538 SW", city: "Nijmegen", routeCluster: "dukenburg" },
  { company: "KION", street: "Wijchenseweg 102", postalCode: "6538 SX", city: "Nijmegen", routeCluster: "dukenburg" },
  { company: "Talis", street: "Boekweitweg 6", postalCode: "6534 AC", city: "Nijmegen", routeCluster: "south" },
  { company: "Gemeente Nijmegen", street: "Korte Nieuwstraat 6", postalCode: "6511 PP", city: "Nijmegen", routeCluster: "center" },
  { company: "Pluryn", street: "Industrieweg 50", postalCode: "6541 TW", city: "Nijmegen", routeCluster: "west" },
  { company: "Hekkelman Advocaten & Notarissen", street: "Oranjesingel 1", postalCode: "6511 NJ", city: "Nijmegen", routeCluster: "center" },
  { company: "Poelmann van den Broek", street: "Wijchenseweg 10", postalCode: "6537 TL", city: "Nijmegen", routeCluster: "dukenburg" },
  { company: "Holland Casino Nijmegen", street: "Waalkade 68", postalCode: "6511 XP", city: "Nijmegen", routeCluster: "center" },
  { company: "Mercure Hotel Nijmegen Centre", street: "Stationsplein 29", postalCode: "6512 AB", city: "Nijmegen", routeCluster: "station" },
  { company: "HORNBACH Nijmegen", street: "Wendelring 3", postalCode: "6515 AN", city: "Nijmegen", routeCluster: "north" },
  { company: "N.E.C. Nijmegen", street: "Stadionplein 1", postalCode: "6532 AJ", city: "Nijmegen", routeCluster: "south" },
  { company: "Royal SMIT Transformers B.V.", street: "Groenestraat 336", postalCode: "6531 JC", city: "Nijmegen", routeCluster: "south" },
  { company: "Technische Unie Nijmegen", street: "Mercuriusstraat 1", postalCode: "6541 BM", city: "Nijmegen", routeCluster: "west" },
  { company: "XPO Logistics Nijmegen", street: "Lagelandseweg 70", postalCode: "6545 CG", city: "Nijmegen", routeCluster: "west-hightech" },
  { company: "Stichting De Waalboog", street: "Groesbeekseweg 327", postalCode: "6523 PA", city: "Nijmegen", routeCluster: "east" },
  { company: "Dustin Nijmegen", street: "Wijchenseweg 20", postalCode: "6537 TL", city: "Nijmegen", routeCluster: "dukenburg" },
  { company: "Woonwaarts", street: "Takenhofplein 3", postalCode: "6538 SZ", city: "Nijmegen", routeCluster: "dukenburg" },
];

function campaignStopId(company: string, postalCode: string) {
  return `${company}-${postalCode}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const sinterklaasAcquisitionStops: LogisticsAcquisitionStop[] =
  stopSeeds.map((stop) => ({
    ...stop,
    id: campaignStopId(stop.company, stop.postalCode),
    attention: "HR / Personeelszaken",
  }));

export function emptySinterklaasAcquisitionCampaign(): LogisticsAcquisitionCampaign {
  return {
    id: sinterklaasAcquisitionCampaignId,
    title: "Acquisitie Sinterklaasfolder",
    startDate: sinterklaasAcquisitionStartDate,
    endDate: sinterklaasAcquisitionEndDate,
    stops: sinterklaasAcquisitionStops,
    deliveries: [],
    updatedAt: new Date(0).toISOString(),
  };
}
