import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";

const haccpLinks = [
  {
    href: "/schoonmaak?plan=opstart",
    label: "Opstart",
    icon: strikIcons.opstartplan,
  },
  {
    href: "/schoonmaak?plan=afsluit",
    label: "Afsluit",
    icon: strikIcons.afsluitplan,
  },
  {
    href: "/winkel/schoonmaak-registratie",
    label: "Temperaturen",
    icon: strikIcons.cleaning,
  },
];

export default function IjsChocoladeHaccpPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="HACCP"
        icon={strikIcons.cleaning}
      />

      <div className="grid gap-2">
        {haccpLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-16 items-center justify-between border border-[#eadb8b] bg-white px-3 py-2 shadow-sm transition hover:bg-[#fff8d8] active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#f7df83]">
                <img src={item.icon} alt="" className="h-6 w-6 object-contain" />
              </span>
              <span className="truncate text-xl font-black text-[#1a1815]">
                {item.label}
              </span>
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#f7df83] text-xl font-black">
              &gt;
            </span>
          </Link>
        ))}
      </div>
    </StrikShell>
  );
}
