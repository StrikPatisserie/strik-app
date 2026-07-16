import Link from "next/link";
import { StrikPageHeader, StrikShell } from "../StrikUI";

const vierdaagseCards = [
  {
    href: "/kraamrekenaar",
    title: "Rekentool kraam",
    icon: "/app%20strik_kraam.svg",
    tone: "orange",
  },
  {
    href: "/vierdaagse/kassa-tool",
    title: "Proeverij Ziekerstraat",
    icon: "/app%20strik_kassa.svg",
    tone: "green",
  },
] as const;

export default function VierdaagsePage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Vierdaagse"
        kicker="Strik"
        description="Kraam en Ziekerstraat."
      />

      <section className="mx-auto grid max-w-3xl grid-cols-2 gap-6 pt-6 sm:gap-10 sm:pt-10">
        {vierdaagseCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group grid justify-items-center gap-3 text-center transition active:scale-[0.98] sm:gap-4"
            aria-label={`${card.title} openen`}
          >
            <span
              className={`flex aspect-square w-full max-w-[10.5rem] items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white transition group-hover:scale-[1.03] group-hover:shadow-xl sm:max-w-[14rem] ${
                card.tone === "green"
                  ? "bg-[#24551d] shadow-[#24551d]/20"
                  : "bg-[#ef7d0a] shadow-[#ef7d0a]/20"
              }`}
            >
              <img
                src={card.icon}
                alt=""
                className="h-[58%] w-[58%] object-contain brightness-0 invert"
              />
            </span>
            <span className="max-w-40 text-sm font-black uppercase leading-tight tracking-normal text-[#1a1815] sm:max-w-none sm:text-base">
              {card.title}
            </span>
          </Link>
        ))}
      </section>
    </StrikShell>
  );
}
