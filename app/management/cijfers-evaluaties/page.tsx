import Link from "next/link";
import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";
import {
  getFeastDayEvaluationsForYear,
  type HolidayEvaluation,
  otherActionEvaluations,
} from "./evaluationData";
import { getCustomHolidayEvaluations } from "./customEvaluationData";
import DeleteEvaluationButton from "./DeleteEvaluationButton";
import EvaluationOverviewToolbar from "./EvaluationOverviewToolbar";

function belongsToYear(evaluation: HolidayEvaluation, year: string) {
  return evaluation.year === year;
}

const feastDayIconStyles: Record<
  string,
  { background: string; color: string }
> = {
  vierdaagse: {
    background:
      "linear-gradient(90deg, #2f6540 0%, #2f6540 50%, #e8892f 50%, #e8892f 100%)",
    color: "#ffffff",
  },
  pasen: { background: "#fed500", color: "#49342d" },
  koningsdag: { background: "#ef8a24", color: "#49342d" },
  valentijn: { background: "#f2a9bf", color: "#49342d" },
  moederdag: { background: "#e8afc5", color: "#49342d" },
  vaderdag: { background: "#79a9d1", color: "#49342d" },
  sinterklaas: { background: "#e30613", color: "#ffffff" },
  kerst: { background: "#8e2637", color: "#ffffff" },
  "oud-en-nieuw": { background: "#264765", color: "#ffffff" },
};

const defaultFeastDayIconStyle = {
  background: "#f1e9df",
  color: "#49342d",
};

function MaskedEvaluationIcon({
  src,
  color,
}: Readonly<{ src: string; color: string }>) {
  return (
    <span
      aria-hidden="true"
      className="h-7 w-7"
      style={{
        backgroundColor: color,
        WebkitMask: `url("${src}") center / contain no-repeat`,
        mask: `url("${src}") center / contain no-repeat`,
      }}
    />
  );
}

export default async function ManagementCijfersEvaluatiesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ jaar?: string }>;
}>) {
  const params = await searchParams;
  const customEvaluations = await getCustomHolidayEvaluations();
  const customSlugs = new Set(
    customEvaluations.map((evaluation) => evaluation.slug)
  );
  const allActions = [
    ...otherActionEvaluations,
    ...customEvaluations.filter((evaluation) => evaluation.group === "actie"),
  ];
  const currentYear = String(new Date().getFullYear());
  const years = Array.from(
    new Set([
      String(Number(currentYear) + 1),
      currentYear,
      String(Number(currentYear) - 1),
      ...[...customEvaluations, ...allActions]
        .map((evaluation) => evaluation.year)
        .filter((year) => /^\d{4}$/.test(year)),
    ])
  ).sort((a, b) => Number(b) - Number(a));
  const selectedYear = years.includes(params.jaar || "")
    ? params.jaar || currentYear
    : currentYear;
  const visibleFeastDays = [
    ...getFeastDayEvaluationsForYear(selectedYear),
    ...customEvaluations.filter(
      (evaluation) =>
        evaluation.group === "feestdag" &&
        belongsToYear(evaluation, selectedYear)
    ),
  ]
    .sort(
      (a, b) =>
        (a.calendarOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.calendarOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title, "nl")
    );
  const visibleActions = allActions.filter((evaluation) =>
    belongsToYear(evaluation, selectedYear)
  );
  const items = visibleFeastDays.map((holiday) => {
    const baseSlug = holiday.slug.replace(/-\d{4}$/, "");
    const iconStyle =
      feastDayIconStyles[baseSlug] || defaultFeastDayIconStyle;

    return {
      href: `/management/cijfers-evaluaties/${holiday.slug}?jaar=${selectedYear}`,
      title: holiday.title,
      description: holiday.periodLabel || "",
      icon: holiday.icon,
      iconBackground: iconStyle.background,
      iconColor: iconStyle.color,
      accent:
        holiday.status === "gevuld" ? ("green" as const) : ("blue" as const),
      controls: customSlugs.has(holiday.slug) ? (
        <DeleteEvaluationButton slug={holiday.slug} title={holiday.title} />
      ) : undefined,
    };
  });

  return (
    <DepartmentHub
      title="Feestdagen"
      description=""
      icon={strikIcons.data}
      items={items}
      compactItems
      toolbar={
        <EvaluationOverviewToolbar years={years} selectedYear={selectedYear} />
      }
    >
      <section
        aria-labelledby="overige-acties-title"
        className="mx-auto max-w-[64rem]"
      >
        <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#6d8068]">
              Verkoopacties
            </p>
            <h2
              id="overige-acties-title"
              className="mt-0.5 text-xl font-black text-[#49342d] sm:text-2xl"
            >
              Overige acties
            </h2>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-[#6d8068]">
            {visibleActions.length} acties
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {visibleActions.map((action) => {
            const card = (
              <Link
                href={`/management/cijfers-evaluaties/${action.slug}?jaar=${selectedYear}`}
                className={`group grid min-h-[3.35rem] min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_1.5rem] items-center gap-2 rounded-[0.95rem] border bg-white/95 p-1.5 shadow-[0_7px_18px_rgba(73,52,45,.08)] backdrop-blur transition hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(73,52,45,.13)] active:scale-[0.995] sm:min-h-[3.65rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_1.5rem] sm:p-2 ${
                  action.status === "gevuld"
                    ? "border-[#d7e2d2] hover:border-[#aebfa7] hover:bg-[#f7faf5]"
                    : "border-[#d6c1cc] hover:border-[#a27a8e] hover:bg-[#fbf7f9]"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-[0.8rem] bg-[#c3d3bc] sm:h-10 sm:w-10"
                >
                  <span className="inline-flex scale-[0.78]">
                    <MaskedEvaluationIcon src={action.icon} color="#49342d" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.78rem] font-black leading-tight text-[#49342d] sm:text-sm">
                    {action.title}
                  </span>
                  {action.periodLabel ? (
                    <span className="mt-0.5 block text-[0.61rem] font-medium italic text-[#8a776d]">
                      {action.periodLabel}
                    </span>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f1e9df] text-xs font-black text-[#49342d] transition group-hover:translate-x-0.5 group-hover:bg-[#e7ddd1]"
                >
                  &gt;
                </span>
              </Link>
            );

            return customSlugs.has(action.slug) ? (
              <div key={action.slug} className="relative">
                {card}
                <div className="absolute bottom-1.5 right-9 z-10">
                  <DeleteEvaluationButton slug={action.slug} title={action.title} />
                </div>
              </div>
            ) : (
              <div key={action.slug}>{card}</div>
            );
          })}
        </div>
      </section>
    </DepartmentHub>
  );
}
