import DepartmentHub from "../../DepartmentHub";
import { strikIcons } from "../../StrikUI";
import { holidayEvaluations } from "./evaluationData";

export default function ManagementCijfersEvaluatiesPage() {
  const items = holidayEvaluations.map((holiday) => ({
    href: `/management/cijfers-evaluaties/${holiday.slug}`,
    title: holiday.year === "volgt" ? holiday.title : `${holiday.title} ${holiday.year}`,
    description: "",
    icon: strikIcons.agenda,
    accent: holiday.status === "gevuld" ? ("green" as const) : ("blue" as const),
  }));

  return <DepartmentHub title="Feestdagen" description="" icon={strikIcons.data} items={items} />;
}
