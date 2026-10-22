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
    title: "Afspraken · agenda & inplannen",
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
          href="/bruidstaarten/voorbeeld"
          title="Bekijk de bruidstaartpagina"
          label="Inspiratie & afspraken"
          icon={strikIcons.info}
          newTab
        />
      </div>
    </DepartmentHub>
  );
}
