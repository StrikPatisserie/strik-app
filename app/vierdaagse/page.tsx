import Link from "next/link";
import { StrikPageHeader, StrikShell } from "../StrikUI";

const vierdaagseCards = [
  {
    href: "/kraamrekenaar",
    label: "Kraam",
    title: "Rekentool kraam",
    description: "Snel producten aantikken en totaalbedrag zien.",
    badge: "RT",
  },
  {
    href: "/vierdaagse/kassa-tool",
    label: "Terras",
    title: "Kassa tool",
    description: "Bestelbonnen maken en productie volgen.",
    badge: "KT",
  },
];

export default function VierdaagsePage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Vierdaagse"
        kicker="Strik"
        description="Kraam, terras en bediening."
      />

      <section className="grid gap-3 sm:grid-cols-2">
        {vierdaagseCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex min-h-28 items-center gap-3 rounded-lg border border-[#ef7d0a] bg-white p-3 shadow-sm transition hover:shadow-md active:scale-[0.98]"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#ef7d0a] text-lg font-black text-white shadow-sm">
              {card.badge}
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-1 block text-[0.66rem] font-black uppercase tracking-normal text-[#24551d]">
                {card.label}
              </span>
              <span className="block text-base font-black leading-tight text-[#1a1815]">
                {card.title}
              </span>
              <span className="mt-1 block text-xs font-normal leading-snug text-[#6b645b]">
                {card.description}
              </span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#24551d] text-lg font-black text-white transition group-hover:bg-[#1a4015]">
              →
            </span>
          </Link>
        ))}
      </section>
    </StrikShell>
  );
}
