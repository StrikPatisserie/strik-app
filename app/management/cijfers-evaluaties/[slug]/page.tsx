import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import {
  getHolidayEvaluation,
  holidayEvaluations,
  type EvaluationPair,
} from "../evaluationData";
import { getHolidayEvaluationDocument } from "../actions";
import EvaluationDocumentEditor from "./EvaluationDocumentEditor";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return holidayEvaluations.map((holiday) => ({
    slug: holiday.slug,
  }));
}

function Pill({
  children,
  tone = "neutral",
}: Readonly<{ children: ReactNode; tone?: "green" | "orange" | "neutral" }>) {
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

function EmptyState({ label }: Readonly<{ label: string }>) {
  return (
    <div className="border border-dashed border-[#d8d0c5] bg-[#faf8f5] px-3 py-5 text-center text-sm font-bold text-[#8b8278]">
      {label}
    </div>
  );
}

function PairGrid({ items }: Readonly<{ items: EvaluationPair[] }>) {
  if (!items.length) return <EmptyState label="Nog niets ingevuld." />;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={`${label}-${value}`}
          className="flex items-center justify-between gap-3 border border-[#eee7de] bg-[#faf8f5] px-3 py-2"
        >
          <span className="text-sm font-black text-[#6b645b]">{label}</span>
          <span className="text-sm font-black text-[#1a1815]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function SimpleList({
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
      {items.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="text-sm font-bold leading-snug text-[#4f4942]">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm font-bold text-[#8b8278]">Nog leeg.</p>
      )}
    </section>
  );
}

export default async function ManagementHolidayEvaluationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const holiday = getHolidayEvaluation(slug);

  if (!holiday) {
    notFound();
  }

  const document = await getHolidayEvaluationDocument(holiday.slug);

  return (
    <StrikShell wide>
      <Link
        href="/management/cijfers-evaluaties"
        className="inline-flex min-h-10 items-center border border-[#e5ded5] bg-white px-3 text-sm font-black text-[#6b645b] shadow-sm transition hover:border-[#c6d8bf]"
      >
        &lt; Terug naar feestdagen
      </Link>

      <StrikPageHeader
        title={`${holiday.title} ${holiday.year}`}
        description={holiday.summary}
        icon={strikIcons.data}
        kicker="Cijfers & evaluaties"
        tone="light"
      />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["#evaluatie", "Evaluatie", "document wijzigen"],
          ["#bestanden", "Bestanden", `${holiday.files.length} bestanden`],
          ["#assortiment", "Assortiment", "prijzen en keuzes"],
          ["#tips", "Tips", "volgend jaar"],
        ].map(([href, title, detail]) => (
          <Link
            key={href}
            href={href}
            className="border border-[#e5ded5] bg-white px-3 py-2 shadow-sm transition hover:border-[#c6d8bf] hover:bg-[#f6fbf4]"
          >
            <span className="block text-lg font-black text-[#1a1815]">
              {title}
            </span>
            <span className="mt-1 block text-xs font-black uppercase text-[#ef5737]">
              {detail}
            </span>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <EvaluationDocumentEditor slug={holiday.slug} document={document} />

          <section id="assortiment" className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Assortiment
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
                  Prijzen en keuzes
                </h2>
              </div>
              <Pill>{holiday.priceCards.length || "geen"} prijzen</Pill>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <SimpleList
                title="Houden / opnieuw doen"
                items={holiday.assortmentKeep}
                tone="green"
              />
              <SimpleList
                title="Schrappen / aanpassen"
                items={holiday.assortmentStop}
                tone="orange"
              />
            </div>

            <div className="mt-4">
              <PairGrid items={holiday.priceCards} />
            </div>

            {holiday.pastryLineup.length ? (
              <div className="mt-4 border border-[#d8e4d2] bg-[#f6fbf4] p-3">
                <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#6d8068]">
                  Proeverij gebak
                </p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4942]">
                  {holiday.pastryLineup.join(" · ")}
                </p>
              </div>
            ) : null}
          </section>

          <section id="tips" className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Tips voor volgend jaar
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Leerpunten per onderdeel
            </h2>

            {holiday.evaluationSections.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {holiday.evaluationSections.map((section) => (
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
            ) : (
              <div className="mt-3">
                <EmptyState label="Nog geen losse leerpunten toegevoegd." />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {holiday.tags.map((tag) => (
                <Pill
                  key={tag}
                  tone={tag.includes("volgt") || tag.includes("nog") ? "orange" : "green"}
                >
                  {tag}
                </Pill>
              ))}
            </div>
          </section>

          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Cijfers
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Omzetblokken
            </h2>
            <div className="mt-3">
              <PairGrid items={holiday.revenueItems} />
            </div>
          </section>

          <section className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Planning
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Direct meenemen
            </h2>
            <div className="mt-3">
              <PairGrid items={holiday.planningTips} />
            </div>
          </section>

          <section id="bestanden" className="border border-[#e5ded5] bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8b8278]">
              Bestanden downloaden
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#1a1815]">
              Drukwerk en bijlagen
            </h2>
            {holiday.files.length ? (
              <div className="mt-3 grid gap-2">
                {holiday.files.map((file) => (
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
            ) : (
              <div className="mt-3">
                <EmptyState label="Nog geen bestanden gekoppeld." />
              </div>
            )}
          </section>
        </aside>
      </section>
    </StrikShell>
  );
}
