export type BusinessSeason = "sint" | "kerst";
export type FolderSelection = BusinessSeason | "sint-kerst";

export const B2B_ORDER_BACK_EVENT = "strik:b2b-order-back";

export const businessSeasonColors = {
  sint: { accent: "#a6322d", pale: "#f7e6e1", border: "#e4bdb6" },
  kerst: { accent: "#202542", pale: "#e7ebf4", border: "#c5cbdc" },
} as const;

export const businessSeasons = {
  sint: { name: "Sinterklaas", shortName: "Sint", home: "/feestdagen/sint", orders: "/feestdagen/bedrijven?seizoen=sint", mailing: "/feestdagen/nieuwsbrief?seizoen=sint", folder: "https://app.strik-patisserie.nl/sint-voor-bedrijven" },
  kerst: { name: "Kerst", shortName: "Kerst", home: "/feestdagen/kerst", orders: "/feestdagen/bedrijven?seizoen=kerst", mailing: "/feestdagen/nieuwsbrief?seizoen=kerst", folder: "https://app.strik-patisserie.nl/kerst-voor-bedrijven" },
} as const;

export function orderBelongsToSeason(order: { season?: string }, season: BusinessSeason) {
  return (order.season || "sint") === season || order.season === "sint-kerst";
}

export function seasonLabel(season: string) {
  return season === "sint-kerst" ? "Sint & Kerst" : season === "kerst" ? "Kerst" : "Sinterklaas";
}

export function folderSelectionLabel(selection: FolderSelection) {
  return selection === "sint-kerst" ? "Sint- en Kerstfolder" : selection === "kerst" ? "Kerstfolder" : "Sintfolder";
}
