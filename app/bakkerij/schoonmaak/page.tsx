import Link from "next/link";
import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

const bakkerijHaccpLinks = [
  {
    href: "/bakkerij/schoonmaak/schoonmaakrooster",
    title: "Schoonmaakrooster",
    icon: strikIcons.cleaning,
  },
  {
    href: "/bakkerij/schoonmaak/temperatuurregistratie",
    title: "Temperatuurregistratie",
    icon: strikIcons.cleaning,
  },
];

export default function BakkerijSchoonmaakPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
        icon={strikIcons.cleaning}
      />

      <div className="grid gap-2">
        {bakkerijHaccpLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-16 items-center justify-between border border-[#cbdcc5] bg-white px-3 py-2 shadow-sm transition hover:bg-[#f6faf4] active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#c3d3bc]">
                <img src={item.icon} alt="" className="h-6 w-6 object-contain" />
              </span>
              <span className="truncate text-xl font-black text-[#1a1815]">
                {item.title}
              </span>
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#c3d3bc] text-xl font-black">
              &gt;
            </span>
          </Link>
        ))}
      </div>
    </StrikShell>
  );
}
