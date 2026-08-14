/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

type EvaluationFile = {
  title: string;
  kind: string;
  detail: string;
  href: string;
  size: string;
};

type EvaluationSection = {
  title: string;
  items: string[];
};

const holidayButtons = [
  { title: "Vierdaagse", year: "2026", status: "gevuld", active: true },
  { title: "Carnaval", year: "volgt", status: "nog leeg", active: false },
  { title: "Pasen", year: "volgt", status: "nog leeg", active: false },
  { title: "Koningsdag", year: "volgt", status: "nog leeg", active: false },
  { title: "Moederdag", year: "volgt", status: "nog leeg", active: false },
  { title: "Sinterklaas", year: "volgt", status: "nog leeg", active: false },
  { title: "Kerst", year: "volgt", status: "nog leeg", active: false },
  { title: "Oud & Nieuw", year: "volgt", status: "nog leeg", active: false },
];

const evaluationSections: EvaluationSection[] = [
  {
    title: "Ziekerstraat",
    items: [
      "Werken met de app ging super.",
      "Aardbeien wafel en aardbeien croissant volgend jaar schrappen.",
      "Petit gateau was net niet raak; liever een symfonie of ouderwets gebakje als Vierdaagse-gebak.",
      "Geen grote frisdrankflessen meer, alleen normale flesjes.",
      "Snel-oven was heel handig.",
    ],
  },
  {
    title: "Kraam Houtlaan",
    items: [
      "Start Roos en Fien om 02:45 en de rest om 03:15 was perfect.",
      "Pain au chocolat en ham-kaas croissant waren een succes.",
      "Choco twister eruit.",
      "Frisdrank beperken tot Spa blauw, cola normaal, AA en Aquarius.",
    ],
  },
  {
    title: "Kraam Malden",
    items: [
      "Kraampje was perfect; volgend jaar weer huren met 20 stoelen.",
      "Starten om 05:00 was perfect.",
      "Stroom voor het eerst gebruikt en dat was heel fijn.",
    ],
  },
  {
    title: "Divers",
    items: [
      "Vrijdag in Lent ook de middag open, of anders tot 15:00.",
      "Medailles liepen heel goed; ook weer in de winkel zetten.",
      "9-vaks Vierdaagse chocoladedoosjes liepen goed.",
      "Bezorgers: donderdag 03:15 starten, vrijdag 06:00 starten en uiterlijk 07:00 weg.",
      "Donderdag checken of Ziekerstraat genoeg ijs en gebak voor vrijdag heeft besteld.",
      "Voor zondag, maandag en de rest van de week ook puddingbroodjes in Ziekerstraat.",
      "Ongeveer € 750 wisselgeld regelen, alleen munten van € 0,50, € 1 en € 2.",
    ],
  },
];

const assortmentKeep = [
  "Pain au chocolat",
  "Croissant ham-kaas",
  "Medailles",
  "9-vaks Vierdaagse chocolade",
  "Puddingbroodjes voor na de Vierdaagse",
];

const assortmentStop = [
  "Aardbeien wafel",
  "Aardbeien croissant",
  "Petit gateau als Vierdaagse-gebak",
  "Choco twister",
  "Grote frisdrankflessen",
];

const priceCards = [
  ["Croissant aardbei", "€ 5,00"],
  ["Koffie XL", "€ 3,00"],
  ["Thee", "€ 2,50"],
  ["Frisdrank", "€ 3,50"],
  ["Water", "€ 2,50"],
  ["Croissant", "€ 2,50"],
  ["Belegde bol kaas of kipfilet", "€ 3,50"],
  ["Krentenbol", "€ 1,50"],
  ["Puddingbroodje", "€ 3,50"],
  ["Vulkoek", "€ 3,00"],
  ["Appelflap", "€ 3,50"],
  ["Pain au chocolat", "€ 3,00"],
  ["Koffiebroodje", "€ 3,00"],
  ["Kaneelbroodje", "€ 3,50"],
  ["Saucijsbroodje", "€ 3,50"],
  ["Croissant ham-kaas", "€ 3,50"],
  ["Proeverij gebak", "€ 5,95"],
];

const pastryLineup = [
  "Vierdaagse Parel",
  "Aardbei Tartelette",
  "Pistache Slofje",
  "Wandel Cheese",
  "Nijmeegs Steventje",
  "Passievol",
  "Hazelnootbol",
  "Framboos Slagroom",
  "Bossche Bol",
  "Tompouce",
  "Lemon Tartelette",
  "Red Velvet",
  "Appel Royale",
  "Abrikoos Slagroom",
];

const evaluationFiles: EvaluationFile[] = [
  {
    title: "4daagse evaluatie 2026",
    kind: "DOCX",
    detail: "Ruwe evaluatiepunten per locatie.",
    href: "/evaluaties/vierdaagse-2026/4daagse-evaluatie-2026.docx",
    size: "16 KB",
  },
  {
    title: "ZIEK menukaart 4Daagse 2026",
    kind: "PDF",
    detail: "30x A5 printbestand voor Ziekerstraat.",
    href: "/evaluaties/vierdaagse-2026/ziek-menukaart-4daagse-2026-30xa5.pdf",
    size: "634 KB",
  },
  {
    title: "KRAAM prijzen 4Daagse 2026",
    kind: "PDF",
    detail: "2x A1, 2x A3 en 2x A4 prijsbord.",
    href: "/evaluaties/vierdaagse-2026/kraam-prijzen-4daagse-2026.pdf",
    size: "619 KB",
  },
  {
    title: "4daagse plek instructies",
    kind: "PDF",
    detail: "2x A1 en 2x A3 instructiebord voor zitplekken.",
    href: "/evaluaties/vierdaagse-2026/plek-instructies-4daagse-2026.pdf",
    size: "3,9 MB",
  },
  {
    title: "Prijskaartjes 2026",
    kind: "AI",
    detail: "Illustrator-bronbestand met 37 prijskaartjes.",
    href: "/evaluaties/vierdaagse-2026/prijskaartjes-4daagse-2026.ai",
    size: "640 KB",
  },
];

const revenuePlaceholders = [
  ["Omzet totaal", "nog invullen"],
  ["Ziekerstraat", "nog invullen"],
  ["Kraam Houtlaan", "nog invullen"],
  ["Kraam Malden", "nog invullen"],
  ["Lent vrijdag", "nog invullen"],
  ["Wisselgeld", "€ 750 munten"],
];

function Pill({
  children,
  tone = "neutral",
}: Readonly<{ children: React.ReactNode; tone?: "green" | "orange" | "neutral" }>) {
  const toneClass =
    tone === "green"
      ? "border-[#c6d8bf] bg-[#ecf4ed] text-[#36533a]"
      : tone === "orange"
        ? "border-[#f0c5aa] bg-[#fff3ec] text-[#a5452d]"
        : "border-[#e5ded5] bg-white text-[#6b645b]";

  return (
    <span className={`border px-2 py-1 text-[0.66rem] font-black uppercase ${toneClass}`}>
      {children}
    </span>
  );
}

function SmallListCard({
  title,
  items,
  tone,
}: Readonly<{
  title: string;
  items: string[];
  tone: "green" | "orange";
}>) {
  const toneClass =
    tone === "green"
      ? "border-[#c6d8bf] bg-[#f6fbf4]"
      : "border-[#f0c5aa] bg-[#fff8f4]";

  return (
    <section className={`border p-3 ${toneClass}`}>
      <h3 className="text-sm font-black uppercase tracking-normal text-[#1a1815]">
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm font-bold leading-snug text-[#4f4942]">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ManagementCijfersEvaluatiesPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Cijfers & evaluaties"
        description="Feestdagen terugkijken: omzet, assortiment, leerpunten en drukwerk voor volgend jaar."
        icon={strikIcons.data}
        kicker="Management"
        tone="light"
      />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {holidayButtons.map((holiday) => (
          <button
            key={holiday.title}
            type="button"
            className={`min-h-[4.5rem] border px-3 py-2 text-left shadow-sm transition ${
              holiday.active
                ? "border-[#c6d8bf] bg-[#ecf4ed]"
                : "border-[#e5ded5] bg-white/86"
            }`}
          >
            <span className="block text-[0.62rem] font-black uppercase tracking-normal text-[#8b8278]">
              {holiday.year}
            </span>
            <span className="mt-0.5 block text-lg font-black leading-tight text-[#1a1815]">
              {holiday.title}
            </span>
            <span className="mt-1 block text-xs font-black uppercase text-[#ef5737]">
              {holiday.status}
            </span>
          </button>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Vierdaagse
                </p>
                <h2 className="mt-1 text-3xl font-black leading-tight text-[#1a1815]">
                  Evaluatie 2026
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="green">app werkte goed</Pill>
                <Pill tone="green">drukwerk bewaard</Pill>
                <Pill tone="orange">omzet volgt</Pill>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {evaluationSections.map((section) => (
                <section key={section.title} className="border border-[#eee7de] bg-[#faf8f5] p-3">
                  <h3 className="text-base font-black text-[#1a1815]">
                    {section.title}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item} className="text-sm font-bold leading-snug text-[#4f4942]">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <SmallListCard title="Houden / opnieuw doen" items={assortmentKeep} tone="green" />
            <SmallListCard title="Schrappen / aanpassen" items={assortmentStop} tone="orange" />
          </section>

          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Assortiment & prijzen
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
                  Prijskaartjes 2026
                </h2>
              </div>
              <Pill>37 prijskaartjes</Pill>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {priceCards.map(([item, price]) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 border border-[#eee7de] bg-[#faf8f5] px-3 py-2"
                >
                  <span className="text-sm font-black text-[#1a1815]">{item}</span>
                  <span className="shrink-0 text-sm font-black text-[#ef5737]">
                    {price}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border border-[#d8e4d2] bg-[#f6fbf4] p-3">
              <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#6d8068]">
                Proeverij gebak € 5,95
              </p>
              <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4942]">
                {pastryLineup.join(" · ")}
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Cijfers
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Omzetblokken
            </h2>
            <div className="mt-3 grid gap-2">
              {revenuePlaceholders.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border border-[#eee7de] bg-[#faf8f5] px-3 py-2"
                >
                  <span className="text-sm font-black text-[#6b645b]">{label}</span>
                  <span className="text-sm font-black text-[#1a1815]">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Planning 2027
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Direct meenemen
            </h2>
            <div className="mt-3 grid gap-2">
              {[
                ["Houtlaan", "Roos/Fien 02:45, rest 03:15"],
                ["Malden", "Start 05:00, kraam + 20 stoelen + stroom"],
                ["Bezorging", "Donderdag 03:15, vrijdag 06:00"],
                ["Ziekerstraat", "Donderdag check ijs/gebak voor vrijdag"],
                ["Lent", "Vrijdag middag open of tot 15:00"],
              ].map(([label, value]) => (
                <div key={label} className="border border-[#eee7de] bg-[#faf8f5] p-3">
                  <p className="text-[0.66rem] font-black uppercase text-[#8b8278]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-black text-[#1a1815]">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Bestanden & drukwerk
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Vierdaagse 2026
            </h2>
            <div className="mt-3 grid gap-2">
              {evaluationFiles.map((file) => (
                <Link
                  key={file.href}
                  href={file.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid grid-cols-[3rem_1fr_auto] items-center gap-3 border border-[#eee7de] bg-[#faf8f5] px-3 py-2 transition hover:border-[#c6d8bf] hover:bg-white"
                >
                  <span className="flex h-10 w-10 items-center justify-center bg-[#ecf4ed] text-xs font-black text-[#36533a]">
                    {file.kind}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#1a1815]">
                      {file.title}
                    </span>
                    <span className="mt-0.5 block text-xs font-bold leading-snug text-[#7b7268]">
                      {file.detail}
                    </span>
                  </span>
                  <span className="text-xs font-black uppercase text-[#ef5737]">
                    {file.size}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </StrikShell>
  );
}
