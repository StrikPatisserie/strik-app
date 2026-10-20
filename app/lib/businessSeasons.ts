export type BusinessSeason = "sint" | "kerst";
export type FolderSelection = BusinessSeason | "sint-kerst";

export const businessSeasons = {
  sint: { name: "Sinterklaas", shortName: "Sint", home: "/sinterklaas/bedrijven", orders: "/sinterklaas/b2b", mailing: "/sinterklaas/mailing", folder: "https://app.strik-patisserie.nl/sint-voor-bedrijven" },
  kerst: { name: "Kerst", shortName: "Kerst", home: "/kerst", orders: "/kerst/b2b", mailing: "/kerst/mailing", folder: "https://app.strik-patisserie.nl/kerst-voor-bedrijven" },
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
