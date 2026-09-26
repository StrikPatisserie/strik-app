/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import StrikBackButton from "./StrikBackButton";

export type DepartmentHubItem = {
  href: string;
  title: string;
  description: string;
  icon: string;
  label?: string;
  accent?: "green" | "yellow" | "coral" | "blue";
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

        <header className="relative mt-3 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <img
              src={icon}
              alt=""
              className="h-[1.65rem] w-[1.65rem] object-contain brightness-0 invert"
            />
          </span>
          <h1
            className="uppercase text-white"
            style={{
              fontSize: "clamp(0.84rem, 1.25vw, 0.98rem)",
              fontWeight: 500,
              letterSpacing: "0.3em",
              lineHeight: 1,
            }}
          >
            {title}
          </h1>
        </header>

        <section className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {items.map((item) => {
            const accent = item.accent || "green";
            const accentClass = accentClasses[accent];
            const content = (
              <>
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${accentClass.block}`}
                >
                  <img src={item.icon} alt="" className="h-6 w-6 object-contain sm:h-7 sm:w-7" />
                </span>
                <span className="min-w-0 text-sm font-black leading-tight text-[#49342d] sm:text-base">
                  {item.title}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1e9df] text-base font-black text-[#49342d] transition group-hover:translate-x-0.5 group-hover:bg-[#e7ddd1]"
                >
                  &gt;
                </span>
              </>
            );
            const className = `group grid min-h-[4rem] min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2rem] items-center gap-2.5 rounded-[1.15rem] border bg-white/95 p-2 shadow-[0_7px_18px_rgba(73,52,45,.08)] backdrop-blur transition hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(73,52,45,.13)] active:scale-[0.995] sm:min-h-[4.5rem] sm:grid-cols-[3rem_minmax(0,1fr)_2rem] sm:p-2.5 ${accentClass.border}`;

            return linksEnabled ? (
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
          })}
        </section>

        {children && <div className="mt-5">{children}</div>}
      </div>
    </main>
  );
}
