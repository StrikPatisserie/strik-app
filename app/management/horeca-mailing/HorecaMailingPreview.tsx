/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import { ChangeEvent, useMemo, useState } from "react";

type TemplateKey = "hours" | "product" | "cheesecake";
type OccasionKey = "christmas" | "sinterklaas" | "easter" | "kingsday" | "ascension" | "pentecost" | "vierdaagse" | "other";

type TemplateContent = {
  subject: string;
  eyebrow: string;
  title: string;
  body: string;
  price: string;
  buttonLabel: string;
  buttonUrl: string;
};

type Recipient = {
  id: string;
  company: string;
  contact: string;
  email: string;
};

const templateMeta: Record<TemplateKey, {
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  accentSoft: string;
  icon: "clock" | "sparkle" | "cake";
}> = {
  hours: {
    label: "Bestellen & levering",
    shortLabel: "Bestelupdate",
    description: "Besteldagen, deadlines en afwijkende levermomenten.",
    accent: "#315c46",
    accentSoft: "#dfead9",
    icon: "clock",
  },
  product: {
    label: "Nieuw product",
    shortLabel: "Nieuw",
    description: "Een nieuw product of een tijdelijke horeca-aanbieding.",
    accent: "#d95745",
    accentSoft: "#f8dfd8",
    icon: "sparkle",
  },
  cheesecake: {
    label: "Cheesecake smaak",
    shortLabel: "Smaak",
    description: "De nieuwe seizoenssmaak kort en smakelijk delen.",
    accent: "#8f6f82",
    accentSoft: "#eee2e8",
    icon: "cake",
  },
};

const occasionMeta: Record<OccasionKey, { label: string; accent: string; accentSoft: string }> = {
  christmas: { label: "Kerst & Nieuwjaar", accent: "#315c46", accentSoft: "#dfead9" },
  sinterklaas: { label: "Sinterklaas", accent: "#b54232", accentSoft: "#f8e1c1" },
  easter: { label: "Pasen", accent: "#9a7614", accentSoft: "#fbefb9" },
  kingsday: { label: "Koningsdag", accent: "#cf6428", accentSoft: "#fae3d1" },
  ascension: { label: "Hemelvaart", accent: "#587389", accentSoft: "#e1ebef" },
  pentecost: { label: "Pinksteren", accent: "#667e5a", accentSoft: "#e5eddf" },
  vierdaagse: { label: "Vierdaagse", accent: "#a25369", accentSoft: "#f1dfe5" },
  other: { label: "Ander moment", accent: "#665d55", accentSoft: "#ece8e2" },
};

const occasionKeys = Object.keys(occasionMeta) as OccasionKey[];

function dateAt(year: number, month: number, day: number) {
  return new Date(year, month, day, 12, 0, 0, 0);
}

function addCalendarDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function dateHasPassed(value: Date, now: Date) {
  return value.getTime() < dateAt(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function nextFixedDate(month: number, day: number, now: Date) {
  let result = dateAt(now.getFullYear(), month, day);
  if (dateHasPassed(result, now)) result = dateAt(now.getFullYear() + 1, month, day);
  return result;
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
  return dateAt(year, month - 1, day);
}

function nextEaster(now: Date) {
  let result = easterSunday(now.getFullYear());
  if (dateHasPassed(addCalendarDays(result, 1), now)) result = easterSunday(now.getFullYear() + 1);
  return result;
}

function nextDateFromEaster(now: Date, offset: number, lastDayOffset = offset) {
  let easter = easterSunday(now.getFullYear());
  if (dateHasPassed(addCalendarDays(easter, lastDayOffset), now)) easter = easterSunday(now.getFullYear() + 1);
  return addCalendarDays(easter, offset);
}

function thirdTuesdayOfJuly(year: number) {
  const first = dateAt(year, 6, 1);
  const daysUntilTuesday = (2 - first.getDay() + 7) % 7;
  return addCalendarDays(first, daysUntilTuesday + 14);
}

function nextVierdaagse(now: Date) {
  let result = thirdTuesdayOfJuly(now.getFullYear());
  if (dateHasPassed(addCalendarDays(result, 3), now)) result = thirdTuesdayOfJuly(now.getFullYear() + 1);
  return result;
}

function previousSunday(value: Date) {
  const daysBack = value.getDay() === 0 ? 7 : value.getDay();
  return addCalendarDays(value, -daysBack);
}

function dutchDate(value: Date, includeYear = true) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(value);
}

function occasionContent(key: OccasionKey, now = new Date()): TemplateContent {
  const base = {
    eyebrow: "Bestel- en leverinformatie",
    price: "",
    buttonLabel: "Neem contact op",
    buttonUrl: "mailto:info@strik-patisserie.nl",
  };

  if (key === "christmas") {
    const christmasDay = nextFixedDate(11, 25, now);
    const year = christmasDay.getFullYear();
    const secondChristmasDay = dateAt(year, 11, 26);
    const delivery = dateAt(year, 11, 24);
    const deadline = previousSunday(delivery);
    const newYearsDay = dateAt(year + 1, 0, 1);
    return {
      ...base,
      subject: `Bestellen en leveren rond Kerst ${year}`,
      title: "Belangrijke informatie voor jullie kerstbestelling",
      body: `Beste {{contactpersoon}},\n\nTijdens de kerstdagen zijn wij op ${dutchDate(christmasDay)} en ${dutchDate(secondChristmasDay)} gesloten. Ook rond ${dutchDate(newYearsDay)} kan onze bestel- en leverplanning afwijken.\n\nWillen jullie een bestelling ontvangen op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door, zodat wij voldoende tijd hebben voor de voorbereidingen.\n\nLet op: door de kerstdrukte kan het levermoment op 24 december afwijken van het tijdstip dat jullie van ons gewend zijn. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.`,
    };
  }

  if (key === "sinterklaas") {
    const celebration = nextFixedDate(11, 5, now);
    const delivery = addCalendarDays(celebration, -1);
    const deadline = previousSunday(delivery);
    return {
      ...base,
      subject: `Bestellen en leveren rond Sinterklaas ${celebration.getFullYear()}`,
      title: "Geef jullie Sinterklaasbestelling op tijd door",
      body: `Beste {{contactpersoon}},\n\nRond Sinterklaas verwachten wij extra drukte in onze bakkerij. Willen jullie een bestelling ontvangen vóór ${dutchDate(celebration)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door.\n\nVoor leveringen op ${dutchDate(delivery)} kan het bezorgmoment afwijken van jullie gebruikelijke tijdstip. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.`,
    };
  }

  if (key === "easter") {
    const easter = nextEaster(now);
    const easterMonday = addCalendarDays(easter, 1);
    const delivery = addCalendarDays(easter, -1);
    const deadline = previousSunday(delivery);
    return {
      ...base,
      subject: `Bestellen en leveren rond Pasen ${easter.getFullYear()}`,
      title: "Aangepaste planning rond Pasen",
      body: `Beste {{contactpersoon}},\n\nRond Eerste en Tweede Paasdag, ${dutchDate(easter)} en ${dutchDate(easterMonday)}, wijkt onze bestel- en leverplanning af.\n\nWillen jullie een bestelling ontvangen vóór Pasen, op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door, zodat wij voldoende tijd hebben voor de voorbereidingen.\n\nDoor de paasdrukte kan het levermoment afwijken van het tijdstip dat jullie van ons gewend zijn. Als dit voor jullie geldt, laten we dat tijdig weten.\n\nHeb je een vraag? Antwoord gerust op deze mail.`,
    };
  }

  if (key === "kingsday") {
    const kingsDay = nextFixedDate(3, 27, now);
    const deadline = previousSunday(kingsDay);
    return {
      ...base,
      subject: `Bestellen en leveren rond Koningsdag ${kingsDay.getFullYear()}`,
      title: "Aangepaste planning rond Koningsdag",
      body: `Beste {{contactpersoon}},\n\nRond Koningsdag op ${dutchDate(kingsDay)} wijkt onze bestel- en leverplanning af. Geef bestellingen voor de week van Koningsdag daarom uiterlijk ${dutchDate(deadline)} aan ons door.\n\nOok kan het levermoment die week afwijken van het tijdstip dat jullie van ons gewend zijn. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.`,
    };
  }

  if (key === "ascension") {
    const ascension = nextDateFromEaster(now, 39);
    const delivery = addCalendarDays(ascension, -1);
    const deadline = previousSunday(delivery);
    return {
      ...base,
      subject: `Bestellen en leveren rond Hemelvaart ${ascension.getFullYear()}`,
      title: "Aangepaste planning rond Hemelvaart",
      body: `Beste {{contactpersoon}},\n\nRond Hemelvaartsdag op ${dutchDate(ascension)} wijkt onze bestel- en leverplanning af. Willen jullie een bestelling ontvangen op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door.\n\nHet levermoment kan die week afwijken van jullie gebruikelijke tijdstip. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag? Antwoord gerust op deze mail.`,
    };
  }

  if (key === "pentecost") {
    const pentecost = nextDateFromEaster(now, 49, 50);
    const pentecostMonday = addCalendarDays(pentecost, 1);
    const delivery = addCalendarDays(pentecost, -1);
    const deadline = previousSunday(delivery);
    return {
      ...base,
      subject: `Bestellen en leveren rond Pinksteren ${pentecost.getFullYear()}`,
      title: "Aangepaste planning rond Pinksteren",
      body: `Beste {{contactpersoon}},\n\nRond Eerste en Tweede Pinksterdag, ${dutchDate(pentecost)} en ${dutchDate(pentecostMonday)}, wijkt onze bestel- en leverplanning af.\n\nWillen jullie een bestelling ontvangen vóór Pinksteren, op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door. Het levermoment kan afwijken van jullie gebruikelijke tijdstip.\n\nHeb je een vraag? Antwoord gerust op deze mail.`,
    };
  }

  if (key === "vierdaagse") {
    const start = nextVierdaagse(now);
    const end = addCalendarDays(start, 3);
    const deadline = previousSunday(start);
    return {
      ...base,
      subject: `Bestellen en leveren tijdens de 4Daagse ${start.getFullYear()}`,
      title: "Leveringen tijdens de Nijmeegse 4Daagse",
      body: `Beste {{contactpersoon}},\n\nDe Nijmeegse 4Daagse vindt plaats van ${dutchDate(start)} tot en met ${dutchDate(end)}. Door de drukte en wegafsluitingen kan onze bezorgroute die week anders zijn dan jullie gewend zijn.\n\nGeef bestellingen voor de 4Daagseweek daarom uiterlijk ${dutchDate(deadline)} aan ons door. Het exacte levermoment stemmen we waar nodig persoonlijk met jullie af.\n\nHeb je een vraag over je bestelling of bereikbaarheid? Antwoord gerust op deze mail.`,
    };
  }

  return {
    ...base,
    subject: "Belangrijke bestel- en leverinformatie",
    title: "Een aangepaste bestel- en leverplanning",
    body: "Beste {{contactpersoon}},\n\nBinnenkort wijkt onze gebruikelijke bestel- en leverplanning af. Vul hier de juiste dagen, uiterste besteldatum en eventuele aangepaste levertijd in.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.",
  };
}

function initialOccasionContent() {
  return Object.fromEntries(occasionKeys.map((key) => [key, occasionContent(key)])) as Record<OccasionKey, TemplateContent>;
}

const initialContent: Record<TemplateKey, TemplateContent> = {
  hours: occasionContent("christmas"),
  product: {
    subject: "Nieuw voor onze horecaklanten",
    eyebrow: "Vers uit onze bakkerij",
    title: "Nieuw: mini sloffen voor bij de koffie",
    body: "Beste {{contactpersoon}},\n\nWe hebben iets nieuws voor onze vaste horecaklanten: kleine sloffen met banketbakkersroom en vers fruit. Handig als gebakje bij de koffie of als onderdeel van een luncharrangement.\n\nWil je dit product toevoegen aan jullie vaste levering? Antwoord gerust op deze mail.",
    price: "",
    buttonLabel: "Bestellen of meer weten",
    buttonUrl: "mailto:info@strik-patisserie.nl",
  },
  cheesecake: {
    subject: "De nieuwe cheesecake van het seizoen",
    eyebrow: "Seizoenssmaak",
    title: "Pompoen-karamel is er weer",
    body: "Beste {{contactpersoon}},\n\nOnze cheesecake van het seizoen is terug: romige pompoen-cheesecake met karamel en een kruidige bodem. Vanaf volgende week kan deze weer mee met jullie vaste levering.\n\nWil je hem toevoegen aan je bestelling? Reageer dan eenvoudig op deze mail.",
    price: "",
    buttonLabel: "Bestellen of meer weten",
    buttonUrl: "mailto:info@strik-patisserie.nl",
  },
};

const initialRecipients: Recipient[] = [
  { id: "h1", company: "Restaurant De Linden", contact: "Sanne", email: "sanne@voorbeeld.nl" },
  { id: "h2", company: "Lunchbar De Markt", contact: "Milan", email: "milan@voorbeeld.nl" },
  { id: "h3", company: "Hotel aan de Waal", contact: "Inge", email: "inge@voorbeeld.nl" },
  { id: "h4", company: "Brasserie Het Plein", contact: "Robin", email: "robin@voorbeeld.nl" },
  { id: "h5", company: "Koffiebar No. 8", contact: "Noor", email: "noor@voorbeeld.nl" },
  { id: "h6", company: "Bistro Nijmegen", contact: "Joost", email: "joost@voorbeeld.nl" },
  { id: "h7", company: "De Stadskamer", contact: "Lotte", email: "lotte@voorbeeld.nl" },
  { id: "h8", company: "Café De Hoek", contact: "Daan", email: "daan@voorbeeld.nl" },
  { id: "h9", company: "Gasterij Lent", contact: "Eva", email: "eva@voorbeeld.nl" },
  { id: "h10", company: "Vergaderhuis Oost", contact: "Meike", email: "meike@voorbeeld.nl" },
];

function TemplateIcon({ kind, className = "h-6 w-6" }: Readonly<{ kind: "clock" | "sparkle" | "cake"; className?: string }>) {
  if (kind === "clock") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/></svg>;
  }
  if (kind === "cake") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11h14v8H5z"/><path d="M4 19h16M7 11V8h10v3M9 8V5h6v3"/><path d="M8 14c1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0"/></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.3 4.2L17.5 9l-4.2 1.5L12 15l-1.5-4.5L6 9l4.5-1.8L12 3Z"/><path d="m18.5 14 .7 2.2 2.3.8-2.3.8-.7 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/><path d="m5 14 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></svg>;
}

function PhotoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5"/></svg>;
}

function MailPreview({
  content,
  template,
  occasion,
  photo,
}: Readonly<{
  content: TemplateContent;
  template: TemplateKey;
  occasion: OccasionKey;
  photo: string;
}>) {
  const meta = template === "hours"
    ? { ...templateMeta.hours, ...occasionMeta[occasion] }
    : templateMeta[template];
  const previewBody = content.body.replaceAll("{{contactpersoon}}", "Sanne");

  return (
    <div className="overflow-hidden rounded-[1.65rem] border border-[#ded5ca] bg-[#f2eee7] shadow-[0_18px_45px_rgba(55,43,36,.12)]">
      <div className="border-b border-[#e6dfd5] bg-white px-4 py-3 text-[.67rem] leading-relaxed text-[#70685f]">
        <p><strong className="text-[#2c2824]">Van:</strong> Strik Patisserie &lt;info@strik-patisserie.nl&gt;</p>
        <p><strong className="text-[#2c2824]">Aan:</strong> iedere horecaklant afzonderlijk</p>
        <p><strong className="text-[#2c2824]">Antwoord naar:</strong> info@strik-patisserie.nl</p>
        <p className="truncate"><strong className="text-[#2c2824]">Onderwerp:</strong> {content.subject || "Nog geen onderwerp"}</p>
      </div>

      <div className="bg-white px-5 pb-6 pt-5 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <Image src="/strik-logo.png" alt="Strik Patisserie" width={82} height={54} className="h-11 w-auto object-contain" />
          <span className="rounded-full px-3 py-1.5 text-[.58rem] font-black uppercase tracking-[.19em]" style={{ backgroundColor: meta.accentSoft, color: meta.accent }}>
            {template === "hours" ? occasionMeta[occasion].label : "Horeca update"}
          </span>
        </div>

        <div className="mt-5 overflow-hidden rounded-[1.35rem]" style={{ backgroundColor: meta.accentSoft }}>
          {photo ? (
            <img src={photo} alt="Gekozen afbeelding voor de mailing" className="aspect-[16/8] w-full object-cover" />
          ) : (
            <div className="relative flex h-16 items-center justify-center overflow-hidden sm:h-20" style={{ color: meta.accent }}>
              <span className="absolute -right-5 -top-10 h-24 w-24 rounded-full border-[18px] opacity-15" />
              <span className="absolute -bottom-12 -left-6 h-24 w-24 rounded-full border-[18px] opacity-15" />
              <TemplateIcon kind={meta.icon} className="relative h-8 w-8" />
            </div>
          )}
          <div className="px-5 py-5 sm:px-6">
            <p className="text-[.58rem] font-black uppercase tracking-[.2em]" style={{ color: meta.accent }}>{content.eyebrow || meta.label}</p>
            <h2 className="mt-2 text-[1.55rem] font-black leading-[1.05] text-[#302821] sm:text-[1.8rem]">{content.title || "Titel van je bericht"}</h2>
          </div>
        </div>

        <div className="px-1 pb-1 pt-5 text-[.83rem] font-medium leading-[1.65] text-[#554c44] sm:px-2">
          {template !== "hours" && (
            <div className="mb-5 rounded-[1rem] border border-[#e5ddd2] bg-[#faf8f4] px-4 py-3">
              <p className="text-[.6rem] font-black uppercase tracking-[.16em]" style={{ color: meta.accent }}>
                {template === "product" ? "Winkelprijs incl. btw" : "Aanbiedingsprijs excl. btw"}
              </p>
              <p className="mt-1 text-xl font-black leading-none text-[#302821]">€ {content.price.trim() || "—"}</p>
              <p className="mt-1.5 text-[.66rem] font-semibold leading-snug text-[#776d64]">
                {template === "product"
                  ? "Jullie eigen horeca-prijsafspraken blijven van toepassing."
                  : "Deze aanbiedingsprijs geldt voor al onze horecaklanten."}
              </p>
            </div>
          )}
          {previewBody.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
            <p key={`${paragraph.slice(0, 18)}-${index}`} className="mb-3 whitespace-pre-line">{paragraph}</p>
          ))}
          {content.buttonLabel && (
            <span className="mt-2 inline-flex rounded-full px-5 py-3 text-xs font-black text-white" style={{ backgroundColor: meta.accent }}>
              {content.buttonLabel} →
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-4 text-[.59rem] font-semibold leading-relaxed text-white/85" style={{ backgroundColor: meta.accent }}>
        Strik Patisserie · Nijmegen · info@strik-patisserie.nl<br />
        Is dit niet het juiste e-mailadres voor deze informatie? Antwoord op deze mail en laat ons weten welk adres we voortaan mogen gebruiken.
      </div>
    </div>
  );
}

const fieldClass = "mt-1.5 w-full rounded-xl border border-[#ded4c7] bg-white px-3 py-2.5 text-sm font-semibold text-[#302821] outline-none transition focus:border-[#71907b] focus:ring-2 focus:ring-[#dce8dd]";
const labelClass = "block text-[.66rem] font-black uppercase tracking-[.14em] text-[#756c63]";

export default function HorecaMailingPreview() {
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>("hours");
  const [occasion, setOccasion] = useState<OccasionKey>("christmas");
  const [contentByTemplate, setContentByTemplate] = useState(initialContent);
  const [contentByOccasion, setContentByOccasion] = useState<Record<OccasionKey, TemplateContent>>(initialOccasionContent);
  const [photo, setPhoto] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [recipients, setRecipients] = useState(initialRecipients);
  const [selected, setSelected] = useState(() => initialRecipients.map((recipient) => recipient.id));
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [draftRecipient, setDraftRecipient] = useState({ company: "", contact: "", email: "" });
  const [previewMessage, setPreviewMessage] = useState("");

  const content = activeTemplate === "hours" ? contentByOccasion[occasion] : contentByTemplate[activeTemplate];
  const meta = activeTemplate === "hours"
    ? { ...templateMeta.hours, ...occasionMeta[occasion] }
    : templateMeta[activeTemplate];
  const priceMissing = activeTemplate !== "hours" && !content.price.trim();
  const shownRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) => `${recipient.company} ${recipient.contact} ${recipient.email}`.toLowerCase().includes(query));
  }, [recipients, search]);

  function patchContent(value: Partial<TemplateContent>) {
    if (activeTemplate === "hours") {
      setContentByOccasion((current) => ({
        ...current,
        [occasion]: { ...current[occasion], ...value },
      }));
      return;
    }
    setContentByTemplate((current) => ({
      ...current,
      [activeTemplate]: { ...current[activeTemplate], ...value },
    }));
  }

  function chooseTemplate(key: TemplateKey) {
    setActiveTemplate(key);
    setPhoto("");
    setPhotoName("");
    setPhotoError("");
    setPreviewMessage("");
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Kies een afbeelding, bijvoorbeeld JPG, PNG of WEBP.");
      return;
    }
    if (file.size > 5_000_000) {
      setPhotoError("Deze foto is groter dan 5 MB. Kies een kleinere afbeelding.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(typeof reader.result === "string" ? reader.result : "");
      setPhotoName(file.name);
      setPhotoError("");
    };
    reader.readAsDataURL(file);
  }

  function toggleRecipient(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function addRecipient() {
    const company = draftRecipient.company.trim();
    const contact = draftRecipient.contact.trim();
    const email = draftRecipient.email.trim();
    if (!company || !email.includes("@")) return;
    const recipient = { id: `preview-${Date.now()}`, company, contact, email };
    setRecipients((current) => [...current, recipient]);
    setSelected((current) => [...current, recipient.id]);
    setDraftRecipient({ company: "", contact: "", email: "" });
    setAddOpen(false);
  }

  return (
    <div className="space-y-4 pb-10">
      <section className="flex flex-col gap-3 rounded-[1.35rem] border border-[#e5d8c5] bg-[#fffaf2]/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3df9d] text-[#6c5120]">✦</span>
          <div>
            <p className="text-sm font-black text-[#49342d]">Lokale ontwerp-preview</p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#786d62]">Aparte horecalijst · niets wordt opgeslagen of verstuurd.</p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-[#ebe5da] px-3 py-1.5 text-[.62rem] font-black uppercase tracking-[.14em] text-[#665d55]">Eerst samen bijschaven</span>
      </section>

      <section className="rounded-[1.55rem] border border-[#ded6ca] bg-white/95 p-3 shadow-[0_12px_30px_rgba(63,50,42,.08)] sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#8b8177]">Stap 1</p>
            <h2 className="mt-0.5 text-xl font-black text-[#302821]">Wat wil je vertellen?</h2>
          </div>
          <p className="hidden text-xs font-semibold text-[#8a8178] sm:block">Ieder type heeft een eigen herkenbare mailstijl.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(templateMeta) as TemplateKey[]).map((key) => {
            const item = templateMeta[key];
            const active = activeTemplate === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => chooseTemplate(key)}
                className={`group flex min-h-[5.2rem] items-center gap-3 rounded-[1.15rem] border p-3 text-left transition ${active ? "border-transparent shadow-[0_8px_22px_rgba(50,42,35,.13)]" : "border-[#e7dfd4] bg-[#fbfaf7] hover:border-[#cfc4b7]"}`}
                style={active ? { backgroundColor: item.accentSoft, color: item.accent } : undefined}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm" style={{ color: item.accent }}><TemplateIcon kind={item.icon} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#302821]">{item.label}</span>
                  <span className="mt-0.5 block text-[.68rem] font-semibold leading-snug text-[#756c63]">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(25rem,.95fr)]">
        <section className="rounded-[1.55rem] border border-[#ded6ca] bg-white/95 p-4 shadow-[0_12px_30px_rgba(63,50,42,.08)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#8b8177]">Stap 2</p>
              <h2 className="mt-0.5 text-xl font-black text-[#302821]">Maak je bericht</h2>
            </div>
            <span className="rounded-full px-3 py-1.5 text-[.62rem] font-black uppercase tracking-[.13em]" style={{ backgroundColor: meta.accentSoft, color: meta.accent }}>{meta.label}</span>
          </div>

          <div className="mt-4 grid gap-3">
            {activeTemplate === "hours" && (
              <label className={labelClass}>Thema van deze bestelupdate
                <select value={occasion} onChange={(event) => setOccasion(event.target.value as OccasionKey)} className={fieldClass}>
                  {occasionKeys.map((key) => <option key={key} value={key}>{occasionMeta[key].label}</option>)}
                </select>
                <span className="mt-1.5 block normal-case tracking-normal text-[.66rem] font-semibold text-[#90867c]">Het gekozen thema bepaalt de kleur en herkenning van de mail. De tekst pas je hieronder zelf aan.</span>
              </label>
            )}
            <label className={labelClass}>Onderwerpregel
              <input value={content.subject} onChange={(event) => patchContent({ subject: event.target.value })} className={fieldClass} />
            </label>
            <div className="grid gap-3 sm:grid-cols-[.72fr_1.28fr]">
              <label className={labelClass}>Klein bovenkopje
                <input value={content.eyebrow} onChange={(event) => patchContent({ eyebrow: event.target.value })} className={fieldClass} />
              </label>
              <label className={labelClass}>Grote titel
                <input value={content.title} onChange={(event) => patchContent({ title: event.target.value })} className={fieldClass} />
              </label>
            </div>
            <label className={labelClass}>Tekst
              <textarea value={content.body} onChange={(event) => patchContent({ body: event.target.value })} rows={8} className={`${fieldClass} resize-y leading-relaxed`} />
              <span className="mt-1.5 block normal-case tracking-normal text-[.66rem] font-semibold text-[#90867c]">Gebruik <strong>{"{{contactpersoon}}"}</strong> voor de voornaam in iedere persoonlijke mail.</span>
            </label>

            {activeTemplate !== "hours" && (
              <label className={labelClass}>
                {activeTemplate === "product" ? "Winkelprijs incl. btw" : "Aanbiedingsprijs excl. btw"}
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-black text-[#5e554d]">€</span>
                  <input
                    value={content.price}
                    onChange={(event) => patchContent({ price: event.target.value.replace(/[^0-9,.]/g, "") })}
                    inputMode="decimal"
                    placeholder="Vul de prijs in"
                    className={`${fieldClass.replace("mt-1.5 ", "")} pl-8`}
                  />
                </div>
                <span className="mt-1.5 block normal-case tracking-normal text-[.66rem] font-semibold text-[#90867c]">
                  {activeTemplate === "product"
                    ? "We tonen de winkelprijs inclusief btw en vermelden dat eigen horeca-afspraken blijven gelden."
                    : "Eén aanbiedingsprijs exclusief btw, gelijk voor alle horecaklanten."}
                </span>
              </label>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Tekst op knop
                <input value={content.buttonLabel} onChange={(event) => patchContent({ buttonLabel: event.target.value })} className={fieldClass} />
              </label>
              <label className={labelClass}>Link van knop
                <input value={content.buttonUrl} onChange={(event) => patchContent({ buttonUrl: event.target.value })} className={fieldClass} />
              </label>
            </div>

            <div className="rounded-[1.15rem] border border-dashed border-[#cfc3b5] bg-[#fbf9f5] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6c6259] shadow-sm"><PhotoIcon /></span>
                  <div>
                    <p className="text-xs font-black text-[#3e3731]">Foto toevoegen <span className="font-semibold text-[#8b8177]">(optioneel)</span></p>
                    <p className="mt-0.5 text-[.65rem] font-semibold text-[#8b8177]">JPG, PNG of WEBP · maximaal 5 MB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {photo && <button type="button" onClick={() => { setPhoto(""); setPhotoName(""); }} className="rounded-full px-3 py-2 text-[.66rem] font-black text-[#8b4e43] underline">Verwijder</button>}
                  <label className="cursor-pointer rounded-full bg-[#49342d] px-4 py-2 text-[.68rem] font-black text-white shadow-sm">
                    {photo ? "Andere foto" : "+ Kies foto"}
                    <input type="file" accept="image/*" onChange={handlePhoto} className="sr-only" />
                  </label>
                </div>
              </div>
              {photoName && <p className="mt-2 truncate text-[.66rem] font-bold text-[#5f785f]">✓ {photoName}</p>}
              {photoError && <p role="alert" className="mt-2 text-[.66rem] font-bold text-[#b33f31]">{photoError}</p>}
            </div>
          </div>
        </section>

        <aside className="self-start rounded-[1.55rem] border border-[#ded6ca] bg-[#f5f0e8]/95 p-3 shadow-[0_12px_30px_rgba(63,50,42,.08)] sm:p-5 xl:sticky xl:top-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#8b8177]">Live voorbeeld</p>
              <p className="mt-0.5 text-xs font-semibold text-[#6f665e]">Zo ontvangt Sanne de mail.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-[.62rem] font-black text-[#72685f] shadow-sm">Mobiele mail</span>
          </div>
          <MailPreview content={content} template={activeTemplate} occasion={occasion} photo={photo} />
        </aside>
      </div>

      <section className="rounded-[1.55rem] border border-[#ded6ca] bg-white/95 p-4 shadow-[0_12px_30px_rgba(63,50,42,.08)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#8b8177]">Stap 3</p>
            <h2 className="mt-0.5 text-xl font-black text-[#302821]">Kies de horecaklanten</h2>
            <p className="mt-1 text-xs font-semibold text-[#7c7269]">Deze adressenlijst staat straks volledig los van de Sinterklaas-mailing.</p>
          </div>
          <button type="button" onClick={() => setAddOpen((current) => !current)} className="w-fit rounded-full bg-[#315c46] px-4 py-2.5 text-xs font-black text-white shadow-sm">+ Horecaklant toevoegen</button>
        </div>

        {addOpen && (
          <div className="mt-4 grid gap-2 rounded-[1.15rem] border border-[#d7e2d2] bg-[#f4f8f2] p-3 sm:grid-cols-[1fr_.8fr_1.15fr_auto] sm:items-end">
            <label className={labelClass}>Bedrijf
              <input value={draftRecipient.company} onChange={(event) => setDraftRecipient((current) => ({ ...current, company: event.target.value }))} placeholder="Naam horecazaak" className={fieldClass} />
            </label>
            <label className={labelClass}>Contactpersoon
              <input value={draftRecipient.contact} onChange={(event) => setDraftRecipient((current) => ({ ...current, contact: event.target.value }))} placeholder="Voornaam" className={fieldClass} />
            </label>
            <label className={labelClass}>E-mailadres
              <input type="email" value={draftRecipient.email} onChange={(event) => setDraftRecipient((current) => ({ ...current, email: event.target.value }))} placeholder="naam@bedrijf.nl" className={fieldClass} />
            </label>
            <button type="button" onClick={addRecipient} className="h-[2.65rem] rounded-xl bg-[#49342d] px-4 text-xs font-black text-white disabled:opacity-40" disabled={!draftRecipient.company.trim() || !draftRecipient.email.includes("@")}>Toevoegen</button>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek bedrijf, naam of e-mailadres" className="h-10 w-full rounded-xl border border-[#ded4c7] bg-[#fbfaf7] px-3 text-xs font-semibold outline-none focus:border-[#71907b] sm:max-w-sm" />
          <button type="button" onClick={() => setSelected(selected.length === recipients.length ? [] : recipients.map((recipient) => recipient.id))} className="w-fit text-xs font-black text-[#466b51] underline underline-offset-4">{selected.length === recipients.length ? "Niemand selecteren" : "Iedereen selecteren"}</button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {shownRecipients.map((recipient) => {
            const checked = selected.includes(recipient.id);
            return (
              <label key={recipient.id} className={`flex cursor-pointer items-center gap-3 rounded-[1rem] border p-3 transition ${checked ? "border-[#b7cdb6] bg-[#f2f7ef]" : "border-[#e6dfd5] bg-[#fbfaf8] opacity-65"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleRecipient(recipient.id)} className="h-5 w-5 shrink-0 accent-[#315c46]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-[#352f2a]">{recipient.company}</span>
                  <span className="mt-0.5 block truncate text-[.65rem] font-semibold text-[#82786f]">{recipient.contact ? `${recipient.contact} · ` : ""}{recipient.email}</span>
                </span>
                <button type="button" onClick={(event) => { event.preventDefault(); setPreviewMessage("In de echte versie kun je hier dit adres wijzigen of verwijderen."); }} className="rounded-full bg-white px-2.5 py-1.5 text-[.6rem] font-black text-[#72685f] shadow-sm">Wijzig</button>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.55rem] border border-[#c7d8c5] bg-[#e6efe2]/95 p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
        <div>
          <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#5e7964]">Klaar voor controle</p>
          <p className="mt-1 text-base font-black text-[#2e4936]">{meta.shortLabel}-mail naar {selected.length} {selected.length === 1 ? "horecaklant" : "horecaklanten"}</p>
          <p className="mt-1 text-xs font-semibold text-[#65746a]">Iedere klant ontvangt één persoonlijke mail; adressen zijn nooit zichtbaar voor anderen.</p>
          {priceMissing && <p role="alert" className="mt-2 text-xs font-black text-[#a94a38]">Vul eerst de prijs in voordat deze mail kan worden verstuurd.</p>}
          {previewMessage && <p role="status" className="mt-2 text-xs font-black text-[#8a5e2d]">{previewMessage}</p>}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:min-w-[20rem] sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setPreviewMessage("Preview: er is geen testmail verstuurd.")} className="rounded-full border border-[#8da78f] bg-white px-4 py-3 text-xs font-black text-[#315c46]">Testmail bekijken</button>
          <button type="button" disabled={priceMissing || selected.length === 0} onClick={() => setPreviewMessage("Preview: er is niets verstuurd of opgeslagen.")} className="rounded-full bg-[#315c46] px-5 py-3 text-xs font-black text-white shadow-md disabled:cursor-not-allowed disabled:opacity-40">Controleren & versturen →</button>
        </div>
      </section>
    </div>
  );
}
