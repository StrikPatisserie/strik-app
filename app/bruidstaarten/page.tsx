import DepartmentHub from "../DepartmentHub";
import SecondaryResourceLink from "../SecondaryResourceLink";
import { strikIcons } from "../StrikUI";

const items = [
  {
    href: "/bruidstaarten/studio",
    title: "Bruidstaart Studio",
    description: "",
    icon: strikIcons.bruidstaart,
    accent: "coral" as const,
  },
  {
    href: "/bruidstaarten/agenda",
    title: "Geplande afspraken",
    description: "",
    icon: strikIcons.strikAgenda,
    accent: "green" as const,
  },
  {
    href: "/bruidstaarten/overzicht",
    title: "Bruidstaarten overzicht",
    description: "",
    icon: strikIcons.data,
    accent: "blue" as const,
  },
];

export default function BruidstaartenPage() {
  return (
    <DepartmentHub
      description="Studio, afspraken en definitieve bruidstaarten."
      title="Bruidstaarten"
      icon={strikIcons.bruidstaart}
      items={items}
    >
      <div className="flex justify-end">
        <SecondaryResourceLink
          href="https://strik-patisserie.nl/wp-content/uploads/2025/06/bruidstaart-inspiratie.pdf"
          title="Bekijk de bruidstaart voorbeelden"
          label="Inspiratie-pdf"
          icon={strikIcons.info}
          newTab
        />
      </div>
    </DepartmentHub>
  );
}
