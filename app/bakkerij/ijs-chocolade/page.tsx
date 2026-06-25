import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

const ijsChocoladeLinks = [
  {
    href: "/bakkerij/ijs-chocolade/recepten",
    label: "Recepten",
    icon: strikIcons.recepturen,
  },
  {
    href: "/bakkerij/ijs-chocolade/haccp",
    label: "HACCP",
    icon: strikIcons.cleaning,
  },
  {
    href: "/bakkerij/ijs-chocolade/bestellen",
    label: "Bestellen",
    icon: strikIcons.ijs,
  },
];

export default function IjsChocoladePage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs & chocolade"
        icon={strikIcons.ijs}
      />

      <div className="grid gap-2">
        {ijsChocoladeLinks.map((item) => (
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
