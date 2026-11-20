export const HOLIDAYS = [
  { id: "sint", name: "Sinterklaas", slug: "sinterklaas", icon: "/APP_icons_strik_SINT.svg", color: "#a6322d" },
  { id: "kerst", name: "Kerst", slug: "kerst", icon: "/evaluation-icons/kerst.svg", color: "#344363" },
  { id: "oud-en-nieuw", name: "Oud & Nieuw", slug: "oud-en-nieuw", icon: "/evaluation-icons/oud-en-nieuw.svg", color: "#7e586f" },
  { id: "pasen", name: "Pasen", slug: "pasen", icon: "/evaluation-icons/pasen.svg", color: "#9a7722" },
  { id: "koningsdag", name: "Koningsdag", slug: "koningsdag", icon: "/evaluation-icons/koningsdag.svg", color: "#b55b24" },
  { id: "valentijn", name: "Valentijn", slug: "valentijn", icon: "/evaluation-icons/valentijn.svg", color: "#a65370" },
  { id: "moederdag", name: "Moederdag", slug: "moederdag", icon: "/evaluation-icons/moederdag-roos.svg", color: "#966579" },
  { id: "vaderdag", name: "Vaderdag", slug: "vaderdag", icon: "/evaluation-icons/vaderdag.svg", color: "#477794" },
  { id: "vierdaagse", name: "Vierdaagse", slug: "vierdaagse", icon: "/evaluation-icons/vierdaagse.svg", color: "#3f704c" },
] as const;
export type HolidayId = typeof HOLIDAYS[number]["id"];
export type BatchSetup = { start: string; date: string; deadline: string; pickup: string };
export type SeasonConfig = { owner: string; startDate: string; endDate: string; assortment: string; instructions: string; letters: boolean; business: boolean; mailing: boolean; pricesChecked: boolean; batches: BatchSetup[]; legacy?: boolean };
export type Season = { season: HolidayId; year: number; state: "opening" | "active" | "closing" | "closed"; config: SeasonConfig; revision: number; closure_notes?: ClosureNotes; started_at: string | null; closed_at: string | null };
export type ClosureNotes = { good: string; improve: string; next: string; exceptions: string; reviewed: boolean };
export type RecordData = Record<string, unknown>;
export type ArchiveSources = { complete: boolean; capturedAt: string; letters: RecordData[]; b2b: RecordData[]; mailing: RecordData[] };
export type SeasonArchive = { season: HolidayId; year: number; captured_at: string; config: SeasonConfig; notes: ClosureNotes; sources: ArchiveSources; central: Record<string, RecordData[]> };
export function holiday(id: string) { return HOLIDAYS.find(item => item.id === id); }
export function amsterdamYear(now = new Date()) { return Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Amsterdam", year: "numeric" }).format(now)); }
export function emptyConfig(year: number): SeasonConfig { return { owner: "", startDate: `${year}-01-01`, endDate: `${year}-12-31`, assortment: "", instructions: "", letters: false, business: false, mailing: false, pricesChecked: false, batches: [] }; }
const validDate = (value: string) => /^20\d\d-\d\d-\d\d$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function validateSetup(id: string, year: number, input: SeasonConfig) {
  if (!holiday(id) || !Number.isInteger(year) || year < amsterdamYear() || year > amsterdamYear()+5) throw Error("Kies een geldig seizoen en jaar.");
  if (!input || typeof input !== "object" || ![input.owner,input.assortment,input.instructions,input.startDate,input.endDate].every(v=>typeof v === "string")) throw Error("Controleer de inrichting.");
  if (input.owner.trim().length<2 || input.owner.length>160) throw Error("Vul een verantwoordelijke in.");
  if (!validDate(input.startDate) || !validDate(input.endDate) || !input.startDate.startsWith(String(year)) || input.endDate<input.startDate || input.endDate>`${year+1}-01-07`) throw Error("Kies een geldige periode binnen deze editie.");
  if (!input.assortment.trim() || input.assortment.length>8000 || input.instructions.length>8000 || input.pricesChecked!==true) throw Error("Beschrijf het assortiment en bevestig de controle van prijzen en werkwijze.");
  if ([input.letters,input.business,input.mailing].some(v=>typeof v!=="boolean")) throw Error("Kies welke onderdelen je gebruikt.");
  if ((input.business||input.mailing) && !["sint","kerst"].includes(id)) throw Error("Deze zakelijke onderdelen zijn beschikbaar voor Sint en Kerst.");
  if (input.letters && id!=="sint") throw Error("Chocoladeletters horen bij Sinterklaas.");
  if (!Array.isArray(input.batches) || input.batches.length>12) throw Error("Kies maximaal 12 productiedagen.");
  if (input.letters) {
    if (!input.batches.length) throw Error("Voeg minstens één productiedag toe.");
    const seen=new Set<string>();
    for (const b of input.batches) {
      if (!b || ![b.start,b.date,b.pickup].every(v=>typeof v==="string"&&validDate(v)) || !/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(b.deadline) || !validDate(b.deadline.slice(0,10)) || b.deadline.slice(11)>"23:59" || b.deadline.slice(0,10)<input.startDate || b.deadline.slice(0,10)>=b.start || b.start>b.date || b.date>b.pickup || b.pickup>`${year}-12-05` || b.pickup>input.endDate || !b.date.startsWith(String(year)) || seen.has(b.date)) throw Error("Controleer de productiedagen: deadline vóór productie, levering erna en uiterlijk 5 december. Kies unieke datums binnen de seizoenperiode.");
      seen.add(b.date);
    }
  }
  return { owner: input.owner.trim(), startDate: input.startDate, endDate: input.endDate, assortment: input.assortment.trim(), instructions: input.instructions.trim(), letters: input.letters, business: input.business, mailing: input.mailing, pricesChecked: true, batches: input.letters ? input.batches.map(b=>({start:b.start,date:b.date,deadline:b.deadline,pickup:b.pickup})) : [] } satisfies SeasonConfig;
}
export function validateClosure(notes: ClosureNotes) {
  if (!notes || notes.reviewed!==true || ![notes.good,notes.improve,notes.next,notes.exceptions].every(v=>typeof v==="string"&&v.length<=10000)) throw Error("Bevestig de controle en controleer de toelichting bij open punten.");
  return notes;
}
const number = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const rows = (v: unknown): RecordData[] => Array.isArray(v) ? v.filter((r):r is RecordData=>Boolean(r)&&typeof r==="object") : [];
export function seasonSummary(sources: ArchiveSources, central: SeasonArchive["central"] = {}) {
  const letters=rows(sources.letters).filter(o=>o.status!=="geannuleerd"), b2b=rows(sources.b2b).filter(o=>!o.cancelled&&o.status!=="geannuleerd");
  const online=rows(central.orders).filter(o=>o.channel==="ONLINE"&&o.fulfillment_status!=="CANCELLED"), onlineIds=new Set(online.map(o=>o.id));
  const onlineItems=rows(central.items).filter(o=>onlineIds.has(o.order_id));
  const onlineById=new Map(online.map(o=>[o.id,o]));
  // Combined orders are reported separately, never counted as exclusive Sint/Kerst revenue.
  const agreed=b2b.filter(o=>o.status==="akkoord"), exclusive=agreed.filter(o=>o.season!=="sint-kerst"), combined=agreed.filter(o=>o.season==="sint-kerst");
  const openLetters=letters.filter(o=>!o.pickedUp&&o.status!=="opgehaald"), openB2B=agreed.filter(o=>!o.delivered), openOnline=online.filter(o=>!["PICKED_UP","DELIVERED","COMPLETED"].includes(String(o.fulfillment_status)));
  const mailing=rows(sources.mailing).map(c=>({selection:String(c.selection||"sint"),contacts:rows(c.customers).length,sent:rows(c.customers).reduce((sum,c)=>sum+rows(c.recipients).filter(r=>r.folderSentAt||r.sentAt).length,0)}));
  return { storeOrders:letters.length, storeLetters:letters.reduce((n,o)=>n+rows(o.lines).reduce((s,l)=>s+number(l.quantity),0),0), storeValue:letters.reduce((n,o)=>n+number(o.totalCents),0)/100,
    deliveries:letters.filter(o=>o.delivery).length, onlineOrders:online.length, onlineLetters:onlineItems.reduce((n,o)=>n+number(o.quantity),0), onlineValue:onlineItems.reduce((n,o)=>n+number(o.quantity)*(number(o.unit_price_cents)+number(o.logo_price_cents)+(onlineById.get(o.order_id)?.gift_wrap ? number(onlineById.get(o.order_id)?.gift_wrap_price_cents) : 0)),0)/100,
    b2bOrders:b2b.length, agreedOrders:agreed.length, b2bValueExVat:exclusive.reduce((n,o)=>n+number(String(o.totalExVat||0).replace(",",".")),0), combinedOrders:combined.length,
    rounds:rows(central.batches).filter(b=>b.status!=="CLOSED").length, registered:rows(central.registrations).reduce((n,r)=>n+number(r.quantity),0),
    openCount:openLetters.length+openB2B.length+openOnline.length,
    outstanding:[...openLetters.map(o=>String(o.code||o.customerName||o.id)),...openB2B.map(o=>String(o.customerName||o.id)),...openOnline.map(o=>String(o.order_number||o.id))], mailing };
}
