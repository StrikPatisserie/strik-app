/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import StrikBackButton from "./StrikBackButton";
import { StrikPageHeading } from "./StrikPageTitle";

export type DepartmentHubItem = {
  href: string;
  title: string;
  description: string;
  icon: string;
  label?: string;
  accent?: "green" | "yellow" | "coral" | "blue";
  iconBackground?: string;
  iconColor?: string;
  controls?: React.ReactNode;
};

const accentClasses = {
  green: {
    border: "border-[#d7e2d2] hover:border-[#aebfa7] hover:bg-[#f7faf5]",
    block: "bg-[#c3d3bc]",
  },
  yellow: {
    border: "border-[#f0dc65] hover:border-[#d8b900] hover:bg-[#fffbea]",
    block: "bg-[#fed500]",
  },
  coral: {
    border: "border-[#e7b3a9] hover:border-[#d75a48] hover:bg-[#fff7f4]",
    block: "bg-[#d75a48]",
  },
  blue: {
    border: "border-[#d6c1cc] hover:border-[#a27a8e] hover:bg-[#fbf7f9]",
    block: "bg-[#a27a8e]",
  },
};

export default function DepartmentHub({
  title,
  icon,
  items,
  children,
  toolbar,
  showBackButton = true,
  linksEnabled = true,
  compactItems = false,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
  icon: string;
  items: readonly DepartmentHubItem[];
  children?: React.ReactNode;
  tone?: "green" | "yellow" | "coral";
  toolbar?: React.ReactNode;
  showBackButton?: boolean;
  linksEnabled?: boolean;
  compactItems?: boolean;
}>) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#c3d3bc] px-3 py-4 pb-24 text-[#49342d] sm:px-6 sm:py-6 lg:px-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[22rem] top-12 h-[34rem] w-[46rem] rotate-[-9deg] bg-[#dce6d8] opacity-[0.55] sm:-right-[28rem] sm:-top-40 sm:h-[68rem] sm:w-[90rem]"
        style={{
          WebkitMask:
            'url("/strik%20logo%20icon.svg") center / contain no-repeat',
          mask: 'url("/strik%20logo%20icon.svg") center / contain no-repeat',
        }}
      />

      <div className="relative mx-auto w-full max-w-[72rem]">
        {showBackButton && <StrikBackButton />}
        {toolbar}

        <StrikPageHeading title={title} icon={icon} className="mt-3" />

        <section
          className={`mt-4 grid sm:grid-cols-2 ${
            compactItems ? "mx-auto max-w-[64rem] gap-2" : "gap-2.5"
          }`}
        >
          {items.map((item) => {
            const accent = item.accent || "green";
            const accentClass = accentClasses[accent];
            const content = (
              <>
                <span
                  className={`flex items-center justify-center ${
                    compactItems
                      ? "h-9 w-9 rounded-[0.8rem] sm:h-10 sm:w-10"
                      : "h-11 w-11 rounded-xl sm:h-12 sm:w-12"
                  } ${
                    item.iconBackground ? "" : accentClass.block
                  }`}
                  style={
                    item.iconBackground
                      ? { background: item.iconBackground }
                      : undefined
                  }
                >
                  {item.iconColor ? (
                    <span
                      aria-hidden="true"
                      className={
                        compactItems
                          ? "h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]"
                          : "h-6 w-6 sm:h-7 sm:w-7"
                      }
                      style={{
                        backgroundColor: item.iconColor,
                        WebkitMask: `url("${item.icon}") center / contain no-repeat`,
                        mask: `url("${item.icon}") center / contain no-repeat`,
                      }}
                    />
                  ) : (
                    <img
                      src={item.icon}
                      alt=""
                      className={`object-contain ${
                        compactItems
                          ? "h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]"
                          : "h-6 w-6 sm:h-7 sm:w-7"
                      }`}
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block font-black leading-tight text-[#49342d] ${
                      compactItems
                        ? "text-[0.78rem] sm:text-sm"
                        : "text-sm sm:text-base"
                    }`}
                  >
                    {item.title}
                  </span>
                  {compactItems && item.description ? (
                    <span className="mt-0.5 block text-[0.58rem] font-medium italic leading-tight text-[#8a776d]">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex items-center justify-center rounded-full bg-[#f1e9df] font-black text-[#49342d] transition group-hover:translate-x-0.5 group-hover:bg-[#e7ddd1] ${
                    compactItems ? "h-6 w-6 text-xs" : "h-8 w-8 text-base"
                  }`}
                >
                  &gt;
                </span>
              </>
            );
            const className = `group grid min-w-0 items-center border bg-white/95 shadow-[0_7px_18px_rgba(73,52,45,.08)] backdrop-blur transition hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(73,52,45,.13)] active:scale-[0.995] ${
              compactItems
                ? "min-h-[3.35rem] grid-cols-[2.25rem_minmax(0,1fr)_1.5rem] gap-2 rounded-[0.95rem] p-1.5 sm:min-h-[3.65rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_1.5rem] sm:p-2"
                : "min-h-[4rem] grid-cols-[2.75rem_minmax(0,1fr)_2rem] gap-2.5 rounded-[1.15rem] p-2 sm:min-h-[4.5rem] sm:grid-cols-[3rem_minmax(0,1fr)_2rem] sm:p-2.5"
            } ${accentClass.border}`;

            const card = linksEnabled ? (
              <Link
                key={`${item.href}-${item.title}`}
                href={item.href}
                className={className}
              >
                {content}
              </Link>
            ) : (
              <div key={`${item.href}-${item.title}`} className={className}>
                {content}
              </div>
            );

            return item.controls ? (
              <div key={`${item.href}-${item.title}`} className="relative">
                {card}
                <div
                  className={`absolute z-10 ${
                    compactItems ? "bottom-1.5 right-9" : "bottom-2.5 right-12"
                  }`}
                >
                  {item.controls}
                </div>
              </div>
            ) : (
              card
            );
          })}
        </section>

        {children && <div className="mt-5">{children}</div>}
      </div>
    </main>
  );
}
