import Link from "next/link";
import { StrikPageHeader, StrikShell } from "../StrikUI";

const vierdaagseCards = [
  {
    href: "/kraamrekenaar",
    title: "Rekentool kraam",
    icon: "stall",
    color: "orange",
  },
  {
    href: "/vierdaagse/kassa-tool",
    title: "Kassa ziekerstraat",
    icon: "register",
    color: "green",
  },
] as const;

function VierdaagseCardIcon({
  icon,
}: Readonly<{ icon: (typeof vierdaagseCards)[number]["icon"] }>) {
  if (icon === "register") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-8 w-8">
        <path
          d="M14 18h20l3 9H11l3-9Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          d="M12 27h24v10H12V27ZM18 18l-2-7h14l-2 7M18 32h12"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          d="M18 23h.01M24 23h.01M30 23h.01"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-8 w-8">
      <path
        d="M9 20h30l-4-9H13l-4 9Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M12 20v16M36 20v16M16 36h16M15 11v9M24 11v9M33 11v9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M13 36h22"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}

export default function VierdaagsePage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Vierdaagse"
        kicker="Strik"
        description="Kraam en Ziekerstraat."
      />

      <section className="grid gap-3 sm:grid-cols-2">
        {vierdaagseCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex min-h-24 items-center gap-3 rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm transition hover:border-[#24551d] hover:shadow-md active:scale-[0.98]"
          >
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md text-white shadow-sm ${
                card.color === "orange" ? "bg-[#ef7d0a]" : "bg-[#24551d]"
              }`}
            >
              <VierdaagseCardIcon icon={card.icon} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black leading-tight text-[#1a1815]">
                {card.title}
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
