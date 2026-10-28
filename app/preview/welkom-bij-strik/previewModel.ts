// This module contains fictional preview data only. No personnel API or storage.
export const PREVIEW_DATE = "2026-10-27";
export type Track = "winkel" | "bakkerij";
export type Profile = {
  firstName: string; lastName: string; email: string; phone: string;
  address: string; postalCode: string; city: string;
};
export type Wage = { id: string; effectiveFrom: string; amount: number; reason: string };
export type Contract = {
  revision: number; name: string; address: string; job: string; location: string;
  startDate: string; endDate: string; hours: number; wage: number; template: string;
};
export type Evaluation = { date: string; time: string; employeeNote: string; report: string; shared: boolean; seen: boolean };
export type Colleague = {
  id: string; profile: Profile; track: Track; location: string; startDate: string;
  hours: number; endDate: string; submitted: boolean; checked: boolean;
  payroll: { identityChecked: boolean; accountantConfirmed: boolean };
  read: string[]; completed: string[]; onboardingDone: boolean;
  contract: Contract | null; contractState: "none" | "draft" | "sent" | "employee-signed" | "signed";
  wages: Wage[]; evaluation: Evaluation;
};
export type Policy = { welcome: boolean; contract: boolean; onboarding: boolean; evaluation: boolean; reviewMonths: number; ownerEmail: string };
export const INITIAL_POLICY: Policy = { welcome: true, contract: true, onboarding: true, evaluation: true, reviewMonths: 3, ownerEmail: "personeelsbeheer@example.invalid" };
export type FaqItem = { id: string; category: string; question: string; answer: string; confirmed: boolean };
export function initialFaq(): FaqItem[] {
  return [
    { id: "salaris", category: "Salaris", question: "Wanneer wordt mijn salaris uitbetaald?", answer: "", confirmed: false },
    { id: "loonstrook", category: "Salaris", question: "Waar vind ik mijn loonstrook?", answer: "", confirmed: false },
    { id: "uren", category: "Uren & rooster", question: "Mijn gewerkte uren kloppen niet. Wat nu?", answer: "Bekijk je planning en geregistreerde uren in Tamigo. Ontbreekt er iets of kloppen de tijden niet? Geef de datum, tijden en een korte toelichting door aan Roos, zodat zij dit kan controleren.", confirmed: true },
    { id: "rooster", category: "Uren & rooster", question: "Bij wie kan ik terecht met vragen over mijn rooster?", answer: "Bespreek vragen over je rooster, werkuren en afspraken met Roos. Zij is je aanspreekpunt bij Strik.", confirmed: true },
    { id: "loonafspraak", category: "Salaris", question: "Waar staat mijn afgesproken uurloon?", answer: "Je persoonlijke loonafspraak staat in je contract. Heb je vragen over een afspraak of een wijziging? Bespreek die met Roos.", confirmed: true },
    { id: "prive", category: "Gegevens", question: "Hoe lever ik mijn BSN en identiteitsbewijs aan?", answer: "Roos vertelt je via welk accountantportaal je de benodigde gegevens rechtstreeks kunt aanleveren. Upload ze niet in deze app en stuur ze niet per gewone mail. Neem vóór je eerste werkdag je originele geldige identiteitsbewijs mee voor de controle.", confirmed: true },
  ];
}
// Unconfirmed company policy must never appear as an established employee answer.
export function publishedAnswer(item: FaqItem) { return item.confirmed ? item.answer.trim() : ""; }
export type Lesson = { id: string; title: string; minutes: number; description: string; steps: string[] };
export const LESSONS: Record<Track, Lesson[]> = {
  winkel: [
    { id: "w1", title: "Een goed begin achter de toonbank", minutes: 5, description: "Van de eerste begroeting tot een tevreden klant.", steps: ["Laat je rondleiden door je collega’s. Waar vind je de producten, verpakkingen en actuele informatie?", "Begroet de klant en vraag voor welk moment het gebak is. Luister eerst, geef daarna gericht advies.", "Oefen het inpakken en afrekenen met je collega’s. Vraag hulp als je iets nog niet kent."] },
    { id: "w2", title: "Leer ons gebak kennen", minutes: 8, description: "Proeven, kijken en het verhaal van het product leren.", steps: ["Bekijk samen het assortiment. Welke producten komen vandaag vers uit de bakkerij?", "Bespreek de smaken, formaten en presentatie. Gebruik de actuele productinformatie voor je advies.", "Een vraag over allergenen of dieetwensen? Raadpleeg de actuele allergeneninformatie en vraag je collega; doe geen aannames."] },
    { id: "w3", title: "Fris, verzorgd en klaar voor de dag", minutes: 6, description: "Samen openen, schoon werken en zorgvuldig afsluiten.", steps: ["Neem de opstartlijst van jouw winkel door. Vraag Roos om uitleg als iets onduidelijk is.", "Laat zien waar je de temperatuurregistratie en schoonmaaktaken in de app vindt.", "Oefen het controleren van datums en volg het actuele FIFO-plan van jouw winkel."] },
    { id: "w4", title: "Bestellingen zonder verrassingen", minutes: 5, description: "Luisteren, controleren en goed overdragen.", steps: ["Herhaal met de klant wat besteld wordt, voor hoeveel personen en op welke datum en tijd.", "Leg bijzondere wensen vast op de juiste bestelregel. Controleer samen de gegevens.", "Vraag Roos hoe je de bestelling overdraagt en waar je openstaande vragen noteert."] },
  ],
  bakkerij: [
    { id: "b1", title: "Welkom op de werkvloer", minutes: 5, description: "Je werkplek, je collega’s en de dagstart.", steps: ["Maak kennis met Roos en de collega’s van jouw afdeling.", "Loop de werkplek langs: grondstoffen, gereedschap, opslag en de actuele productieplanning.", "Bespreek vóór je begint welke werkzaamheden je zelfstandig mag doen en waarvoor je begeleiding nodig hebt."] },
    { id: "b2", title: "Van recept naar mooi gebak", minutes: 8, description: "Het ambacht leer je samen, stap voor stap.", steps: ["Vraag waar je de actuele recepten vindt. Lees eerst hoeveelheden, werkwijze en aandachtspunten.", "Bekijk de gewenste afwerking en presentatie. Vraag om een voorbeeld voordat je begint.", "Werk een eerste product samen af. Bespreek wat goed gaat en wat je nog wilt oefenen."] },
    { id: "b3", title: "Schoon en zorgvuldig werken", minutes: 6, description: "Vind de juiste werkinstructies voor jouw afdeling.", steps: ["Neem de actuele hygiëne- en schoonmaakinstructies door. Stel je vragen aan Roos.", "Laat zien waar grondstof-, datum- en allergeneninformatie staat. Vraag hulp bij twijfel.", "Gebruik machines pas nadat je de bijbehorende instructie en begeleiding hebt gekregen."] },
    { id: "b4", title: "Een goede overdracht", minutes: 4, description: "Productie, bijzonderheden en de volgende collega.", steps: ["Controleer hoeveelheden en bijzondere wensen aan de hand van de productieopdracht.", "Bespreek hoe je producten en kratten herkenbaar klaarzet voor logistiek.", "Geef openstaande vragen en afwijkingen door aan Roos voordat je afsluit."] },
  ],
};
export const DOCUMENTS = [
  { id: "gids", title: "Je inwerkgids", subtitle: "Een wegwijzer voor je eerste weken", icon: "book" as const, sections: ["Je eerste dag: kennismaken, rondleiding en samen starten.", "Roos is je aanspreekpunt voor vragen over je werk en je start bij Strik.", "Leren op de werkvloer: meekijken, samen oefenen en zelfstandig proberen.", "Na het inwerken: samen terugkijken en de volgende leerdoelen kiezen."] },
  { id: "regels", title: "Zo werken we samen", subtitle: "Onze algemene afspraken", icon: "heart" as const, sections: ["We helpen elkaar en spreken elkaar vriendelijk en duidelijk aan.", "Je rooster en werkafspraken bespreek je met Roos.", "Volg de actuele instructies voor kleding, hygiëne en veilig werken op jouw werkplek.", "Vragen, een foutje of iets onduidelijks? Bespreek het met Roos."] },
  { id: "formulier", title: "Indiensttreding", subtitle: "Contactgegevens & je start", icon: "file" as const, sections: ["Je vult je contact- en adresgegevens in bij Mijn gegevens.", "Personeelsbeheer controleert je gegevens voordat het contract wordt klaargezet.", "BSN, identiteitskopie en loonheffingsgegevens lever je rechtstreeks aan bij het accountantportaal dat Roos bevestigt. Deze app bewaart alleen de voortgang, geen kopie van die gegevens."] },
];

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ongeldige datum");
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Ongeldige datum");
  return date;
}
export function addMonths(value: string, count: number) {
  const date = parseDate(value), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + count);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end));
  return date.toISOString().slice(0, 10);
}
export function addDays(value: string, count: number) {
  const date = parseDate(value); date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function dateLabel(value: string, full = false) {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", day: "numeric", month: full ? "long" : "short", year: full ? "numeric" : undefined, weekday: "short" }).format(parseDate(value));
}
export function money(amount: number) { return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount); }
export function colleagueName(person: Colleague) { return `${person.profile.firstName} ${person.profile.lastName}`.trim(); }
export function wageAt(person: Colleague, date: string) {
  return [...person.wages].reverse().filter(wage => wage.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] || null;
}
export function contractDraft(person: Colleague): Contract | null {
  const wage = wageAt(person, person.startDate);
  if (!person.checked || !wage) return null;
  return { revision: (person.contract?.revision || 0) + 1, name: colleagueName(person), address: `${person.profile.address}, ${person.profile.postalCode} ${person.profile.city}`, job: person.track === "winkel" ? "Verkoopmedewerker" : "Medewerker patisserie", location: person.location, startDate: person.startDate, endDate: person.endDate, hours: person.hours, wage: wage.amount, template: "Strik · bepaalde tijd · voorbeeldtemplate" };
}
export function statusLabel(person: Colleague) {
  if (!person.submitted) return "Gegevens aanvullen";
  if (!person.checked) return "Gegevens controleren";
  if (person.contractState === "none") return "Contract klaarzetten";
  if (person.contractState === "draft") return "Concept controleren";
  if (person.contractState === "sent") return "Ondertekening";
  if (person.contractState === "employee-signed") return "Strik nog ondertekenen";
  if (!person.onboardingDone) return "Aan het inwerken";
  return "Goed op weg";
}
export function reminders(person: Colleague, policy: Policy) {
  const items: { id: string; date: string; title: string; description: string }[] = [];
  if (policy.contract && person.contractState !== "signed") items.push({ id: "contract", date: addDays(person.startDate, -3), title: "Contract controleren", description: "Controleer gegevens en loonafspraak en zet het contract klaar vóór de eerste werkdag." });
  if (policy.onboarding && person.onboardingDone) items.push({ id: "inwerken", date: PREVIEW_DATE, title: "Inwerken afgerond", description: "Loop de afspraken, het dossier en de contractstatus nog één keer samen na." });
  if (policy.evaluation && !person.evaluation.date) items.push({ id: "evaluatie", date: addMonths(person.startDate, policy.reviewMonths), title: `${policy.reviewMonths}-maandengesprek`, description: "Plan een gesprek en vraag je collega vooraf hoe het gaat." });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
export function initialColleagues(): Colleague[] {
  const make = (id: string, firstName: string, lastName: string, track: Track, location: string, startDate: string, amount: number): Colleague => ({
    id, profile: { firstName, lastName, email: `${firstName.toLowerCase()}@example.invalid`, phone: "", address: "Voorbeeldstraat 12", postalCode: "0000 AA", city: "Nijmegen" }, track, location, startDate, hours: 24, endDate: addMonths(startDate, 6), submitted: false, checked: false, payroll: { identityChecked: false, accountantConfirmed: false }, read: [], completed: [], onboardingDone: false, contract: null, contractState: "none", wages: [{ id: `${id}-loon-1`, effectiveFrom: startDate, amount, reason: "Afspraak bij indiensttreding · fictief" }], evaluation: { date: "", time: "10:00", employeeNote: "", report: "", shared: false, seen: false },
  });
  const noor = make("demo-noor", "Noor", "Jansen", "winkel", "Lent", "2026-11-02", 16.80);
  const sam = make("demo-sam", "Sam", "de Vries", "bakkerij", "Bakkerij Malden", "2026-11-09", 17.60);
  sam.submitted = sam.checked = true; sam.read = ["gids", "regels"]; sam.contract = contractDraft(sam); sam.contractState = "draft";
  const mila = make("demo-mila", "Mila", "Peters", "winkel", "Ziekerstraat", "2026-08-01", 17.20);
  mila.submitted = mila.checked = mila.onboardingDone = true; mila.read = ["gids", "regels"]; mila.completed = LESSONS.winkel.map(item => item.id); mila.contract = contractDraft(mila); mila.contractState = "signed";
  const jules = make("demo-jules", "Jules", "Bakker", "bakkerij", "Bakkerij Malden", "2026-10-19", 18.10);
  jules.submitted = jules.checked = true; jules.completed = ["b1", "b2"]; jules.contract = contractDraft(jules); jules.contractState = "signed";
  return [noor, sam, mila, jules];
}
