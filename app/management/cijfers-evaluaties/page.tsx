/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";
import {
  feastDayEvaluations,
  otherActionEvaluations,
} from "./evaluationData";

function evaluationTitle(evaluation: (typeof otherActionEvaluations)[number]) {
  return evaluation.year === "volgt"
    ? evaluation.title
    : `${evaluation.title} ${evaluation.year}`;
}

export default function ManagementCijfersEvaluatiesPage() {
  const items = feastDayEvaluations.map((holiday) => ({
    href: `/management/cijfers-evaluaties/${holiday.slug}`,
    title: evaluationTitle(holiday),
    description: "",
    icon: strikIcons.agenda,
    accent: holiday.status === "gevuld" ? ("green" as const) : ("blue" as const),
  }));

  return (
    <DepartmentHub
      title="Feestdagen"
      description=""
      icon={strikIcons.data}
      items={items}
    >
      <section aria-labelledby="overige-acties-title">
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
            {otherActionEvaluations.length} acties
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {otherActionEvaluations.map((action) => (
            <Link
              key={action.slug}
              href={`/management/cijfers-evaluaties/${action.slug}`}
              className={`group grid min-h-[4.5rem] min-w-0 grid-cols-[3rem_minmax(0,1fr)_2rem] items-center gap-2.5 rounded-[1.15rem] border bg-white/95 p-2.5 shadow-[0_7px_18px_rgba(73,52,45,.08)] backdrop-blur transition hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(73,52,45,.13)] active:scale-[0.995] ${
                action.status === "gevuld"
                  ? "border-[#d7e2d2] hover:border-[#aebfa7] hover:bg-[#f7faf5]"
                  : "border-[#d6c1cc] hover:border-[#a27a8e] hover:bg-[#fbf7f9]"
              }`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  action.status === "gevuld" ? "bg-[#c3d3bc]" : "bg-[#a27a8e]"
                }`}
              >
                <img
                  src={strikIcons.data}
                  alt=""
                  className="h-7 w-7 object-contain"
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight text-[#49342d] sm:text-base">
                  {evaluationTitle(action)}
                </span>
                <span className="mt-1 block text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#8a776d]">
                  {action.status === "gevuld"
                    ? "Evaluatie en boncontrole"
                    : "Klaar om in te vullen"}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1e9df] text-base font-black text-[#49342d] transition group-hover:translate-x-0.5 group-hover:bg-[#e7ddd1]"
              >
                &gt;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </DepartmentHub>
  );
}
