/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

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
  emails: string[];
};

type MailingDraft = {
  template: TemplateKey;
  occasion: OccasionKey;
  content: TemplateContent;
  photoUrl?: string;
};

type MailingApiResponse = {
  customers?: Recipient[];
  draft?: MailingDraft;
  sent?: number;
  message?: string;
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
      body: `Beste team {{bedrijfsnaam}},\n\nTijdens de kerstdagen zijn wij op ${dutchDate(christmasDay)} en ${dutchDate(secondChristmasDay)} gesloten. Ook rond ${dutchDate(newYearsDay)} kan onze bestel- en leverplanning afwijken.\n\nWillen jullie een bestelling ontvangen op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door, zodat wij voldoende tijd hebben voor de voorbereidingen.\n\nLet op: door de kerstdrukte kan het levermoment op 24 december afwijken van het tijdstip dat jullie van ons gewend zijn. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.`,
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
      body: `Beste team {{bedrijfsnaam}},\n\nRond Sinterklaas verwachten wij extra drukte in onze bakkerij. Willen jullie een bestelling ontvangen vóór ${dutchDate(celebration)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door.\n\nVoor leveringen op ${dutchDate(delivery)} kan het bezorgmoment afwijken van jullie gebruikelijke tijdstip. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.`,
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
      body: `Beste team {{bedrijfsnaam}},\n\nRond Eerste en Tweede Paasdag, ${dutchDate(easter)} en ${dutchDate(easterMonday)}, wijkt onze bestel- en leverplanning af.\n\nWillen jullie een bestelling ontvangen vóór Pasen, op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door, zodat wij voldoende tijd hebben voor de voorbereidingen.\n\nDoor de paasdrukte kan het levermoment afwijken van het tijdstip dat jullie van ons gewend zijn. Als dit voor jullie geldt, laten we dat tijdig weten.\n\nHeb je een vraag? Antwoord gerust op deze mail.`,
    };
  }

  if (key === "kingsday") {
    const kingsDay = nextFixedDate(3, 27, now);
    const deadline = previousSunday(kingsDay);
    return {
      ...base,
      subject: `Bestellen en leveren rond Koningsdag ${kingsDay.getFullYear()}`,
      title: "Aangepaste planning rond Koningsdag",
      body: `Beste team {{bedrijfsnaam}},\n\nRond Koningsdag op ${dutchDate(kingsDay)} wijkt onze bestel- en leverplanning af. Geef bestellingen voor de week van Koningsdag daarom uiterlijk ${dutchDate(deadline)} aan ons door.\n\nOok kan het levermoment die week afwijken van het tijdstip dat jullie van ons gewend zijn. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.`,
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
      body: `Beste team {{bedrijfsnaam}},\n\nRond Hemelvaartsdag op ${dutchDate(ascension)} wijkt onze bestel- en leverplanning af. Willen jullie een bestelling ontvangen op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door.\n\nHet levermoment kan die week afwijken van jullie gebruikelijke tijdstip. Als dit voor jullie geldt, laten we dat natuurlijk tijdig weten.\n\nHeb je een vraag? Antwoord gerust op deze mail.`,
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
      body: `Beste team {{bedrijfsnaam}},\n\nRond Eerste en Tweede Pinksterdag, ${dutchDate(pentecost)} en ${dutchDate(pentecostMonday)}, wijkt onze bestel- en leverplanning af.\n\nWillen jullie een bestelling ontvangen vóór Pinksteren, op ${dutchDate(delivery)}? Geef deze dan uiterlijk ${dutchDate(deadline)} aan ons door. Het levermoment kan afwijken van jullie gebruikelijke tijdstip.\n\nHeb je een vraag? Antwoord gerust op deze mail.`,
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
      body: `Beste team {{bedrijfsnaam}},\n\nDe Nijmeegse 4Daagse vindt plaats van ${dutchDate(start)} tot en met ${dutchDate(end)}. Door de drukte en wegafsluitingen kan onze bezorgroute die week anders zijn dan jullie gewend zijn.\n\nGeef bestellingen voor de 4Daagseweek daarom uiterlijk ${dutchDate(deadline)} aan ons door. Het exacte levermoment stemmen we waar nodig persoonlijk met jullie af.\n\nHeb je een vraag over je bestelling of bereikbaarheid? Antwoord gerust op deze mail.`,
    };
  }

  return {
    ...base,
    subject: "Belangrijke bestel- en leverinformatie",
    title: "Een aangepaste bestel- en leverplanning",
    body: "Beste team {{bedrijfsnaam}},\n\nBinnenkort wijkt onze gebruikelijke bestel- en leverplanning af. Vul hier de juiste dagen, uiterste besteldatum en eventuele aangepaste levertijd in.\n\nHeb je een vraag over je bestelling of levering? Antwoord gerust op deze mail.",
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
    body: "Beste team {{bedrijfsnaam}},\n\nWe hebben iets nieuws voor onze vaste horecaklanten: kleine sloffen met banketbakkersroom en vers fruit. Handig als gebakje bij de koffie of als onderdeel van een luncharrangement.\n\nWillen jullie dit product toevoegen aan de vaste levering? Antwoord gerust op deze mail.",
    price: "",
    buttonLabel: "Bestellen of meer weten",
    buttonUrl: "mailto:info@strik-patisserie.nl",
  },
  cheesecake: {
    subject: "De nieuwe cheesecake van het seizoen",
    eyebrow: "Cheesecake seizoen 10-12p",
    title: "Cheesecake",
    body: "Beste team {{bedrijfsnaam}},\n\nOnze cheesecake van het seizoen is terug. Vul hier de smaak en een korte omschrijving in. Vanaf volgende week kan deze weer mee met jullie vaste levering.\n\nWillen jullie hem toevoegen aan de bestelling? Reageer dan eenvoudig op deze mail.",
    price: "",
    buttonLabel: "Bestellen of meer weten",
    buttonUrl: "mailto:info@strik-patisserie.nl",
  },
};

const initialRecipients: Recipient[] = [
  { id: "dries-en-co", company: "Dries en Co", emails: ["info@driesenco.nl", "lisette@driesenco.nl"] },
  { id: "jachtslot", company: "Jachtslot", emails: ["Restaurant@jachtslot.com"] },
  { id: "sanadome", company: "Sanadome", emails: ["Sebastiaan.Ruys@sanadome.nl", "Jacco.Beck@sanadome.nl"] },
  { id: "restaurant-steven", company: "Restaurant Steven", emails: ["info@stevennijmegen.nl", "roel@gezelligezakennijmegen.nl"] },
  { id: "hotel-credible", company: "Hotel Credible", emails: ["zeno@in-credible.nl"] },
  { id: "radboud-universiteit", company: "Radboud Universiteit", emails: ["martijn.gesthuizen@ru.nl", "supportfb-cf@ru.nl"] },
  { id: "sint-maartenskliniek", company: "Sint Maartenskliniek", emails: ["catering@maartenskliniek.nl", "T.Lamers@maartenskliniek.nl"] },
  { id: "radboud-vermaat", company: "Radboud Vermaat", emails: ["radboud-vergaderservice@vermaatgroep.nl"] },
  { id: "restaurant-blue-by-manna", company: "Restaurant BLUE by Manna", emails: ["info@manna-nijmegen.nl", "jay@manna-nijmegen.nl"] },
  { id: "bakkerij-koenen", company: "Bakkerij Koenen", emails: ["nijmegen@bakkerijkoenen.nl"] },
];

async function horecaApi(method = "GET", body?: unknown) {
  const response = await fetch("/api/horeca-mailing", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as MailingApiResponse | null;
  if (!response.ok) throw new Error(data?.message || "Horecamailing kon niet worden verwerkt.");
  return data || {};
}

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
  const previewBody = content.body.replaceAll("{{bedrijfsnaam}}", "Dries en Co");

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
            <img src={photo} alt="Gekozen afbeelding voor de mailing" className="aspect-[16/5] max-h-44 w-full object-cover" />
          ) : (
            <div className="relative flex h-10 items-center justify-center overflow-hidden sm:h-12" style={{ color: meta.accent }}>
              <span className="absolute -right-5 -top-12 h-20 w-20 rounded-full border-[15px] opacity-15" />
              <span className="absolute -bottom-14 -left-6 h-20 w-20 rounded-full border-[15px] opacity-15" />
              <TemplateIcon kind={meta.icon} className="relative h-6 w-6" />
            </div>
          )}
          <div className="px-5 py-3.5 sm:px-6">
            <p className="text-[.58rem] font-black uppercase tracking-[.2em]" style={{ color: meta.accent }}>{content.eyebrow || meta.label}</p>
            <h2 className="mt-1.5 text-[1.45rem] font-black leading-[1.05] text-[#302821] sm:text-[1.7rem]">{content.title || "Titel van je bericht"}</h2>
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
  const [editingRecipient, setEditingRecipient] = useState("");
  const [draftRecipient, setDraftRecipient] = useState({ company: "", emails: "" });
  const [previewMessage, setPreviewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const content = activeTemplate === "hours" ? contentByOccasion[occasion] : contentByTemplate[activeTemplate];
  const meta = activeTemplate === "hours"
    ? { ...templateMeta.hours, ...occasionMeta[occasion] }
    : templateMeta[activeTemplate];
  const priceMissing = activeTemplate !== "hours" && !content.price.trim();
  const selectedRecipients = recipients.filter((recipient) => selected.includes(recipient.id));
  const selectedAddressCount = selectedRecipients.reduce((total, recipient) => total + recipient.emails.length, 0);
  const shownRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) => `${recipient.company} ${recipient.emails.join(" ")}`.toLowerCase().includes(query));
  }, [recipients, search]);

  useEffect(() => {
    let active = true;
    void horecaApi()
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.customers) && data.customers.length > 0) {
          setRecipients(data.customers);
          setSelected(data.customers.map((recipient) => recipient.id));
        }
        if (data.draft) {
          setActiveTemplate(data.draft.template);
          setOccasion(data.draft.occasion);
          if (data.draft.template === "hours") {
            setContentByOccasion((current) => ({ ...current, [data.draft!.occasion]: data.draft!.content }));
          } else {
            setContentByTemplate((current) => ({ ...current, [data.draft!.template]: data.draft!.content }));
          }
          if (data.draft.photoUrl) {
            setPhoto(data.draft.photoUrl);
            setPhotoName("Opgeslagen foto");
          }
        }
        setPreviewMessage(data.message || "");
      })
      .catch((error) => {
        if (active) setPreviewMessage(error instanceof Error ? error.message : "Horecamailing laden is mislukt.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

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
    if (file.size > 3_000_000) {
      setPhotoError("Deze foto is groter dan 3 MB. Kies een kleinere afbeelding.");
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
    const emails = Array.from(new Set(draftRecipient.emails.split(/[;,\s]+/).map((email) => email.trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))));
    if (!company || emails.length === 0) return;
    if (editingRecipient) {
      setRecipients((current) => current.map((recipient) => recipient.id === editingRecipient ? { ...recipient, company, emails } : recipient));
    } else {
      const recipient = { id: `horeca-${Date.now()}`, company, emails };
      setRecipients((current) => [...current, recipient]);
      setSelected((current) => [...current, recipient.id]);
    }
    setDraftRecipient({ company: "", emails: "" });
    setEditingRecipient("");
    setAddOpen(false);
  }

  function editRecipient(recipient: Recipient) {
    setDraftRecipient({ company: recipient.company, emails: recipient.emails.join("; ") });
    setEditingRecipient(recipient.id);
    setAddOpen(true);
  }

  function draftPayload() {
    return {
      customers: recipients,
      draft: {
        template: activeTemplate,
        occasion,
        content,
        photoData: photo.startsWith("data:image/") ? photo : "",
        photoUrl: photo.startsWith("http") ? photo : "",
        photoName,
        removePhoto: !photo,
      },
    };
  }

  function applyServerData(data: MailingApiResponse) {
    if (Array.isArray(data.customers) && data.customers.length > 0) setRecipients(data.customers);
    if (data.draft?.photoUrl) {
      setPhoto(data.draft.photoUrl);
      setPhotoName("Opgeslagen foto");
    }
  }

  async function saveDraft(showMessage = true) {
    const data = await horecaApi("POST", draftPayload());
    applyServerData(data);
    if (showMessage) setPreviewMessage("Concept en horecalijst zijn opgeslagen.");
    return data;
  }

  async function saveNow() {
    setSaving(true);
    try {
      await saveDraft();
    } catch (error) {
      setPreviewMessage(error instanceof Error ? error.message : "Opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestMail() {
    if (priceMissing) return;
    setSending(true);
    try {
      await saveDraft(false);
      await horecaApi("PATCH", { test: true });
      setPreviewMessage("Testmail is verstuurd naar info@strik-patisserie.nl.");
    } catch (error) {
      setPreviewMessage(error instanceof Error ? error.message : "Testmail versturen is mislukt.");
    } finally {
      setSending(false);
    }
  }

  async function sendCampaign() {
    const jobs = selectedRecipients.flatMap((recipient) => recipient.emails.map((email) => ({ customerId: recipient.id, email })));
    if (!jobs.length || priceMissing) return;
    setSending(true);
    setSendProgress(0);
    setConfirmOpen(false);
    let completed = 0;
    try {
      await saveDraft(false);
      for (const job of jobs) {
        const data = await horecaApi("PATCH", job);
        applyServerData(data);
        completed += 1;
        setSendProgress(completed);
      }
      setPreviewMessage(`Mailing is afzonderlijk verstuurd naar ${jobs.length} adres${jobs.length === 1 ? "" : "sen"} van ${selectedRecipients.length} bedrijf${selectedRecipients.length === 1 ? "" : "ven"}.`);
    } catch (error) {
      setPreviewMessage(`${completed} van ${jobs.length} mails verstuurd. ${error instanceof Error ? error.message : "Versturen is gestopt."}`);
    } finally {
      setSending(false);
      setSendProgress(0);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <section className="flex flex-col gap-3 rounded-[1.35rem] border border-[#d4e2d2] bg-[#f3f8f1]/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebd8] text-[#315c46]">✓</span>
          <div>
            <p className="text-sm font-black text-[#315c46]">Horecamailing</p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#667568]">Aparte horecalijst · mails gaan altijd afzonderlijk naar ieder adres.</p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[.62rem] font-black uppercase tracking-[.14em] text-[#315c46]">{loading ? "Laden..." : "Klaar voor gebruik"}</span>
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
              <span className="mt-1.5 block normal-case tracking-normal text-[.66rem] font-semibold text-[#90867c]">Gebruik <strong>{"{{bedrijfsnaam}}"}</strong>; iedere mail begint standaard met “Beste team bedrijfsnaam”.</span>
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
                    <p className="mt-0.5 text-[.65rem] font-semibold text-[#8b8177]">JPG, PNG of WEBP · maximaal 3 MB</p>
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
              <p className="mt-0.5 text-xs font-semibold text-[#6f665e]">Voorbeeld voor team Dries en Co.</p>
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
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving || sending} onClick={() => void saveNow()} className="w-fit rounded-full border border-[#9eb59f] bg-white px-4 py-2.5 text-xs font-black text-[#315c46] shadow-sm disabled:opacity-45">{saving ? "Opslaan..." : "Opslaan"}</button>
            <button type="button" onClick={() => { setEditingRecipient(""); setDraftRecipient({ company: "", emails: "" }); setAddOpen((current) => !current); }} className="w-fit rounded-full bg-[#315c46] px-4 py-2.5 text-xs font-black text-white shadow-sm">+ Horecaklant toevoegen</button>
          </div>
        </div>

        {addOpen && (
          <div className="mt-4 grid gap-2 rounded-[1.15rem] border border-[#d7e2d2] bg-[#f4f8f2] p-3 sm:grid-cols-[.85fr_1.55fr_auto] sm:items-end">
            <label className={labelClass}>Bedrijf
              <input value={draftRecipient.company} onChange={(event) => setDraftRecipient((current) => ({ ...current, company: event.target.value }))} placeholder="Naam horecazaak" className={fieldClass} />
            </label>
            <label className={labelClass}>E-mailadres(sen)
              <input value={draftRecipient.emails} onChange={(event) => setDraftRecipient((current) => ({ ...current, emails: event.target.value }))} placeholder="adres@bedrijf.nl; tweede@bedrijf.nl" className={fieldClass} />
              <span className="mt-1 block normal-case tracking-normal text-[.62rem] font-semibold text-[#8a8178]">Meerdere adressen scheid je met een puntkomma.</span>
            </label>
            <button type="button" onClick={addRecipient} className="h-[2.65rem] rounded-xl bg-[#49342d] px-4 text-xs font-black text-white disabled:opacity-40" disabled={!draftRecipient.company.trim() || !draftRecipient.emails.includes("@")}>
              {editingRecipient ? "Wijzigingen bewaren" : "Toevoegen"}
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek bedrijf of e-mailadres" className="h-10 w-full rounded-xl border border-[#ded4c7] bg-[#fbfaf7] px-3 text-xs font-semibold outline-none focus:border-[#71907b] sm:max-w-sm" />
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
                  <span className="mt-0.5 block text-[.65rem] font-semibold leading-relaxed text-[#82786f]">{recipient.emails.join(" · ")}</span>
                </span>
                <button type="button" onClick={(event) => { event.preventDefault(); editRecipient(recipient); }} className="rounded-full bg-white px-2.5 py-1.5 text-[.6rem] font-black text-[#72685f] shadow-sm">Wijzig</button>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.55rem] border border-[#c7d8c5] bg-[#e6efe2]/95 p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
        <div>
          <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#5e7964]">Klaar voor controle</p>
          <p className="mt-1 text-base font-black text-[#2e4936]">{meta.shortLabel}-mail naar {selected.length} {selected.length === 1 ? "bedrijf" : "bedrijven"}</p>
          <p className="mt-1 text-xs font-semibold text-[#65746a]">{selectedAddressCount} adres{selectedAddressCount === 1 ? "" : "sen"} · ieder adres ontvangt een afzonderlijke mail met de eigen bedrijfsnaam.</p>
          {priceMissing && <p role="alert" className="mt-2 text-xs font-black text-[#a94a38]">Vul eerst de prijs in voordat deze mail kan worden verstuurd.</p>}
          {previewMessage && <p role="status" className="mt-2 text-xs font-black text-[#8a5e2d]">{previewMessage}</p>}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:min-w-[20rem] sm:flex-row sm:justify-end">
          <button type="button" disabled={sending || saving || priceMissing} onClick={() => void sendTestMail()} className="rounded-full border border-[#8da78f] bg-white px-4 py-3 text-xs font-black text-[#315c46] disabled:opacity-40">Test naar info@</button>
          <button type="button" disabled={sending || saving || priceMissing || selected.length === 0} onClick={() => setConfirmOpen(true)} className="rounded-full bg-[#315c46] px-5 py-3 text-xs font-black text-white shadow-md disabled:cursor-not-allowed disabled:opacity-40">{sending ? `Versturen ${sendProgress}/${selectedAddressCount}...` : "Controleren & versturen →"}</button>
        </div>
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#263b2b]/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="horeca-send-title">
          <section className="w-full max-w-lg rounded-[1.6rem] border border-[#ded6ca] bg-[#fffdf9] p-5 shadow-2xl sm:p-6">
            <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#758276]">Laatste controle</p>
            <h2 id="horeca-send-title" className="mt-1 text-2xl font-black text-[#302821]">Mailing definitief versturen?</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-[#6d645c]">Je verstuurt <strong>{selectedAddressCount} afzonderlijke mails</strong> naar {selected.length} geselecteerde {selected.length === 1 ? "organisatie" : "organisaties"}. Antwoorden komen altijd binnen op info@strik-patisserie.nl.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-full border border-[#d8cec2] bg-white px-5 py-3 text-xs font-black text-[#655c54]">Nog niet</button>
              <button type="button" onClick={() => void sendCampaign()} className="rounded-full bg-[#315c46] px-5 py-3 text-xs font-black text-white shadow-md">Definitief versturen</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
