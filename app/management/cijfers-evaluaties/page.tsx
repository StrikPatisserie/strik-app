import {
  StrikPageHeader,
  StrikShell,
  StrikSquareActionCard,
  strikIcons,
} from "../../StrikUI";
import { holidayEvaluations } from "./evaluationData";

export default function ManagementCijfersEvaluatiesPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader title="Feestdagen" icon={strikIcons.data} tone="light" />

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {holidayEvaluations.map((holiday) => (
          <StrikSquareActionCard
            key={holiday.slug}
            href={`/management/cijfers-evaluaties/${holiday.slug}`}
            title={
              holiday.year === "volgt"
                ? holiday.title
                : `${holiday.title} ${holiday.year}`
            }
            icon={strikIcons.agenda}
            tone={holiday.status === "gevuld" ? "green" : "neutral"}
            size="regular"
          />
        ))}
      </section>
    </StrikShell>
  );
}
