import Link from "next/link";
import { StrikPageHeader, StrikShell } from "../../StrikUI";

const modeCards = [
  {
    href: "/vierdaagse/kassa",
    title: "Kassa",
    icon: "register",
    tone: "green",
  },
  {
    href: "/vierdaagse/productie-bediening",
    title: "Keuken",
    icon: "coffee-machine",
    tone: "orange",
  },
] as const;

function ModeIcon({
  icon,
}: Readonly<{ icon: (typeof modeCards)[number]["icon"] }>) {
  if (icon === "register") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true" className="h-16 w-16 sm:h-20 sm:w-20">
        <path
          d="M19 24h26l4 13H15l4-13Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <path
          d="M17 37h30v14H17V37ZM24 24l-3-10h22l-3 10M24 45h16"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <path
          d="M24 31h.01M32 31h.01M40 31h.01"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-16 w-16 sm:h-20 sm:w-20">
      <path
        d="M18 17h26a6 6 0 0 1 6 6v28H14V21a4 4 0 0 1 4-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d="M22 25h14M22 33h14M46 27h4a7 7 0 0 1 0 14h-4M23 51v5M41 51v5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d="M22 44h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
      />
    </svg>
  );
}

export default function VierdaagseKassaToolPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Proeverij tool"
        kicker="Vierdaagse"
      />

      <section className="mx-auto grid max-w-3xl grid-cols-2 gap-6 pt-6 sm:gap-10 sm:pt-10">
        {modeCards.map((card) => (
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
              <ModeIcon icon={card.icon} />
            </span>
            <span className="text-sm font-black uppercase tracking-normal text-[#1a1815] sm:text-base">
              {card.title}
            </span>
          </Link>
        ))}
      </section>
    </StrikShell>
  );
}
