/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export const strikIcons = {
  agenda: "/icons_strik_agenda.svg",
  bruidstaart: "/icons_strik_bruidstaart.svg",
  cleaning: "/icons_strik_cleaning.svg",
  cleaningManagement: "/icons_strik_cleaning%20management.svg",
  info: "/icons_strik_info.svg",
  news: "/icons_strik_news.svg",
  newsManagement: "/icons_strik_add%20news%20management.svg",
};

const toneClasses = {
  light: "bg-[#eef3ea]",
  green: "bg-[#dce8d6]",
  medium: "bg-[#c3d3bc]",
  dark: "bg-[#a8bf9e]",
};

type Tone = keyof typeof toneClasses;

export function StrikShell({
  children,
  wide = false,
}: Readonly<{
  children: React.ReactNode;
  wide?: boolean;
}>) {
  return (
    <main className="min-h-screen bg-[#f4f0ea] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-md"}`}>
        {children}
      </div>
    </main>
  );
}

export function StrikPageHeader({
  title,
  description,
  icon,
  kicker = "Strik Patisserie",
  tone = "green",
}: Readonly<{
  title: string;
  description: string;
  icon?: string;
  kicker?: string;
  tone?: Tone;
}>) {
  return (
    <section
      className={`mb-6 rounded-[2rem] p-5 shadow-sm ${toneClasses[tone]}`}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/45">
            <img src={icon} alt="" className="h-10 w-10 object-contain" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#2d2a26]/55">
            {kicker}
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight">{title}</h1>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}

export function StrikActionCard({
  href,
  title,
  description,
  icon,
  label,
  tone = "green",
  locked = false,
}: Readonly<{
  href: string;
  title: string;
  description: string;
  icon: string;
  label?: string;
  tone?: Tone;
  locked?: boolean;
}>) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-[1.75rem] border border-[#e7e0d8]/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${toneClasses[tone]}`}
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/45">
        <img src={icon} alt="" className="h-10 w-10 object-contain" />
      </span>

      <span className="min-w-0 flex-1">
        {label && (
          <span className="mb-1 inline-block rounded-full bg-white/45 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#2d2a26]/55">
            {label}
          </span>
        )}
        <span className="flex items-center gap-2">
          <span className="text-xl font-bold leading-tight">{title}</span>
          {locked && (
            <span className="relative block h-4 w-4 rounded-b-sm bg-[#2d2a26]">
              <span className="absolute -top-3 left-1/2 h-4 w-3 -translate-x-1/2 rounded-t-full border-2 border-[#2d2a26] border-b-0" />
              <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
          {description}
        </span>
      </span>

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 text-xl font-light transition group-hover:bg-white">
        →
      </span>
    </Link>
  );
}
