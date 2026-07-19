import Link from "next/link";
import { StrikPageHeader, StrikShell } from "../StrikUI";
import { filterAllowedItems } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";

const vierdaagseCards = [
  {
    href: "/kraamrekenaar",
    title: "Rekentool kraam",
    icon: "/Downloads/UITZOEKEN/market_10989752.png",
    tone: "orange",
  },
  {
    href: "/vierdaagse/kassa-tool",
    title: "Proeverij Ziekerstraat",
    icon: "/app%20strik_kassa.svg",
    tone: "green",
  },
] as const;

export const dynamic = "force-dynamic";

export default async function VierdaagsePage() {
  const profile = await getCurrentProfile();
  const visibleCards = filterAllowedItems(vierdaagseCards, profile);

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Vierdaagse"
        kicker="Strik"
        description="Kraam en Ziekerstraat."
      />

      <section className="mt-8 grid w-full max-w-[34rem] grid-cols-2 gap-1 overflow-hidden rounded-2xl bg-white p-1 shadow-sm sm:mt-10">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group grid aspect-square place-items-center px-3 py-4 text-center transition active:scale-[0.98] ${
              card.tone === "green" ? "bg-[#24551d]" : "bg-[#ef7d0a]"
            }`}
            aria-label={`${card.title} openen`}
          >
            <span className="grid justify-items-center gap-3 text-white transition group-hover:scale-[1.03]">
              <img
                src={card.icon}
                alt=""
                className="h-16 w-16 object-contain brightness-0 invert sm:h-20 sm:w-20"
              />
              <span className="max-w-36 text-sm font-black uppercase leading-tight tracking-normal sm:text-base">
                {card.title}
              </span>
            </span>
          </Link>
        ))}
      </section>
    </StrikShell>
  );
}
