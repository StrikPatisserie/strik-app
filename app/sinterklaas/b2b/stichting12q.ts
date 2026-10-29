import { groupLetterLines, groupLetterTotals, serializeLetterGroup, type LetterOrderGroup } from "./groupedLetterOrders";

export const stichting12qGroup: LetterOrderGroup = {
  letterCostCents: 770, logoCostCents: 30,
  rows: [
    { company: "Broex Makelaar", melk: 20, wit: 15, puur: 15, withLogo: true },
    { company: "Diefac Stansvormen", melk: 24, wit: 23, puur: 23, withLogo: true },
    { company: "DIKW", melk: 0, wit: 0, puur: 0, withLogo: true },
    { company: "Goed Geregeld", melk: 20, wit: 0, puur: 0, withLogo: true },
    { company: "Bureau 9010", melk: 10, wit: 10, puur: 10, withLogo: true },
    { company: "Fooks", melk: 10, wit: 10, puur: 10, withLogo: true },
    { company: "Fiber Control", melk: 14, wit: 14, puur: 0, withLogo: true },
    { company: "Ponos", melk: 15, wit: 0, puur: 0, withLogo: true },
    { company: "Muller Corp BV", melk: 0, wit: 0, puur: 10, withLogo: true },
    { company: "Stichting 12Q", melk: 192, wit: 73, puur: 67, withLogo: false },
  ],
};
export function stichting12qImport() {
  const totals = groupLetterTotals(stichting12qGroup);
  return {
    id: "b2b-stichting-12q-2026", year: "2026", season: "sint", customerName: "Stichting 12Q",
    contactName: "", customerEmail: "", phone: "", deliveryWindowType: "week", deliveryWeek: "2026-W47",
    // Existing storage requires a sorting anchor even for a week window. This
    // Monday is never presented as a promised delivery day (type remains week).
    deliveryDate: "2026-11-16", deliveryDateEnd: "", productionDate: "", department: "chocolade",
    orderText: `${totals.quantity} grote chocolade vormletters Q. Deadline week 47 (2026). Verdeling per bedrijf bij de letteromschrijving. Verkoopprijs nog vastleggen.`,
    letterOrderText: serializeLetterGroup(stichting12qGroup), letterLines: groupLetterLines(stichting12qGroup),
    logo: `${totals.logos} letters met bedrijfslogo; 332 letters voor Stichting 12Q zonder logo. DIKW: 0 letters.`,
    packaging: "", importantNotes: "Inkoop: € 7,70 per grote vormletter Q + € 0,30 per logo, excl. btw. Totaal inkoop € 4.580,40 excl. btw. Verkoopprijs nog vastleggen. Deadline week 47; exacte leverdag nog afspreken.",
    priceAgreement: "", totalExVat: "", deliveryMethod: "", deliveryAddress: "", invoiceInfo: "",
    source: "excel", sourceSheet: "Bestelscreenshot Stichting 12Q · 29-10-2026", status: "akkoord",
    entered: false, productionScheduled: false, productionDone: false, letterProductionDone: false, packed: false, delivered: false, cancelled: false,
  };
}
