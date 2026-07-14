import Link from "next/link";
import { StrikPageHeader, StrikShell } from "../../StrikUI";

const modeCards = [
  {
    href: "/vierdaagse/kassa",
    label: "Invoer",
    title: "Kassa",
    description: "Maak na betaling snel een digitale bestelbon.",
    badge: "K",
  },
  {
    href: "/vierdaagse/productie-bediening",
    label: "Orderboard",
    title: "Productie & bediening",
    description: "Bekijk, maak klaar en lever bestellingen uit.",
    badge: "P",
  },
];

export default function VierdaagseKassaToolPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Kassa tool"
        kicker="Vierdaagse"
        description="Kies een werkmodus."
      />

      <section className="grid gap-3 md:grid-cols-2">
        {modeCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex min-h-28 items-center gap-3 rounded-lg border border-[#d6e5d8] bg-white p-3 shadow-sm transition hover:border-[#24551d] hover:shadow-md active:scale-[0.98]"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#24551d] text-xl font-black text-white">
              {card.badge}
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-1 block text-[0.66rem] font-black uppercase tracking-normal text-[#ef7d0a]">
                {card.label}
              </span>
              <span className="block text-base font-black leading-tight text-[#1a1815]">
                {card.title}
              </span>
              <span className="mt-1 block text-xs font-normal leading-snug text-[#6b645b]">
                {card.description}
              </span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#ef7d0a] text-lg font-black text-white transition group-hover:bg-[#d86a12]">
              →
            </span>
          </Link>
        ))}
      </section>
    </StrikShell>
  );
}
