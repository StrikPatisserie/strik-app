/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import StrikBackButton from "./StrikBackButton";

export const strikIcons = {
  agenda: "/icons_strik_agenda.svg",
  bruidstaart: "/icons_strik_bruidstaart.svg",
  cleaning: "/icons_strik_cleaning.svg",
  cleaningManagement: "/icons_strik_cleaning%20management.svg",
  afsluitplan: "/icons_strik_afsluitplan.svg",
  ijs: "/icons_strik_ijs.svg",
  info: "/icons_strik_info.svg",
  management: "/icons_strik_management.svg",
  news: "/icons_strik_news.svg",
  newsManagement: "/icons_strik_add%20news%20management.svg",
  notities: "/icons_strik.svg",
  opstartplan: "/icons_strik_opstartplan.svg",
  photo: "/icons_strik_photo.svg",
  strikAgenda: "/icons_strik_strikagenda.svg",
  winkel: "/icons_strik_winkel.svg",
};

const toneClasses = {
  blue: "bg-[#dbe9ee]",
  honey: "bg-[#f1d28f]",
  pink: "bg-[#f4d8dc]",
  light: "bg-[#eef3ea]",
  green: "bg-[#dce8d6]",
  medium: "bg-[#c3d3bc]",
  muted: "bg-white/75",
  dark: "bg-[#a8bf9e]",
};

type Tone = keyof typeof toneClasses;

const actionCardSizeClasses = {
  compact: {
    card: "gap-3 rounded-[1.25rem] p-3",
    iconWrap: "h-12 w-12",
    icon: "h-7 w-7",
    label:
      "mb-0.5 inline-block rounded-full bg-white/45 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#2d2a26]/45",
    title: "text-base font-bold leading-tight",
    description: "mt-0.5 block text-xs font-semibold leading-snug text-[#2d2a26]/45",
    arrow: "h-8 w-8 text-base",
  },
  regular: {
    card: "gap-4 rounded-[1.75rem] p-4",
    iconWrap: "h-16 w-16",
    icon: "h-10 w-10",
    label:
      "mb-1 inline-block rounded-full bg-white/45 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#2d2a26]/55",
    title: "text-xl font-bold leading-tight",
    description: "mt-0.5 block text-sm font-semibold leading-relaxed text-[#2d2a26]/55",
    arrow: "h-10 w-10 text-xl",
  },
  large: {
    card: "gap-4 rounded-[1.75rem] p-5",
    iconWrap: "h-[4.5rem] w-[4.5rem]",
    icon: "h-12 w-12",
    label:
      "mb-1.5 inline-block rounded-full bg-white/45 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#2d2a26]/55",
    title: "text-2xl font-bold leading-tight",
    description: "mt-1 block text-sm font-semibold leading-relaxed text-[#2d2a26]/60",
    arrow: "h-11 w-11 text-2xl",
  },
};

type ActionCardSize = keyof typeof actionCardSizeClasses;

const squareActionCardSizeClasses = {
  compact: {
    card: "grid-rows-[3.35rem_1fr] rounded-[1.5rem] p-3",
    title: "text-lg",
    icon: "h-16 w-16",
    badge: "right-3 top-3 h-6 min-w-6 px-1.5 text-xs",
  },
  regular: {
    card: "grid-rows-[4.5rem_1fr] rounded-[2rem] p-5",
    title: "text-2xl",
    icon: "h-24 w-24",
    badge: "right-4 top-4 h-7 min-w-7 px-2 text-sm",
  },
};

type SquareActionCardSize = keyof typeof squareActionCardSizeClasses;

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
        <StrikBackButton />
        {children}
      </div>
    </main>
  );
}

export function StrikPageHeader({
  title,
  description,
}: Readonly<{
  title: string;
  description: string;
  icon?: string;
  kicker?: string;
  tone?: Tone;
}>) {
  const titleSizeClass =
    title.length > 22
      ? "text-[2.85rem]"
      : title.length > 14
      ? "text-[3.35rem]"
      : "text-[4.35rem]";

  return (
    <header className="mb-7 pt-8 text-center">
      <h1
        className={`mx-auto max-w-full break-words leading-none text-[#050505] ${titleSizeClass}`}
        style={{
          fontFamily: "Butterscotch, Marker Felt, cursive",
          letterSpacing: "0",
        }}
      >
        {title}
      </h1>
      {description && <p className="sr-only">{description}</p>}
    </header>
  );
}

export function StrikSquareActionCard({
  href,
  title,
  icon,
  badge,
  tone = "green",
  size = "regular",
}: Readonly<{
  href: string;
  title: string;
  icon: string;
  badge?: string | number;
  tone?: Tone;
  size?: SquareActionCardSize;
}>) {
  const sizeClasses = squareActionCardSizeClasses[size];

  return (
    <Link
      href={href}
      className={`group relative grid aspect-square items-center border border-[#e7e0d8]/80 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${sizeClasses.card} ${toneClasses[tone]}`}
    >
      {badge && (
        <span
          className={`absolute flex items-center justify-center rounded-full bg-[#e24b3b] font-black text-white shadow-sm ${sizeClasses.badge}`}
        >
          {badge}
        </span>
      )}
      <span
        className={`flex h-full items-center justify-center font-bold leading-tight text-[#050505] ${sizeClasses.title}`}
      >
        {title}
      </span>
      <span className="flex h-full items-center justify-center pt-3">
        <img
          src={icon}
          alt=""
          className={`object-contain transition group-hover:scale-105 ${sizeClasses.icon}`}
        />
      </span>
    </Link>
  );
}

export function StrikActionCard({
  href,
  title,
  description,
  icon,
  label,
  badge,
  tone = "green",
  size = "regular",
  locked = false,
}: Readonly<{
  href: string;
  title: string;
  description: string;
  icon: string;
  label?: string;
  badge?: string | number;
  tone?: Tone;
  size?: ActionCardSize;
  locked?: boolean;
}>) {
  const sizeClasses = actionCardSizeClasses[size];

  return (
    <Link
      href={href}
      className={`group relative flex items-center border border-[#e7e0d8]/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${sizeClasses.card} ${toneClasses[tone]}`}
    >
      {badge && (
        <span className="absolute right-4 top-4 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#e24b3b] px-2 text-sm font-black text-white shadow-sm">
          {badge}
        </span>
      )}

      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-white/45 ${sizeClasses.iconWrap}`}
      >
        <img src={icon} alt="" className={`object-contain ${sizeClasses.icon}`} />
      </span>

      <span className="min-w-0 flex-1">
        {label && (
          <span className={sizeClasses.label}>
            {label}
          </span>
        )}
        <span className="flex items-center gap-2">
          <span className={sizeClasses.title}>{title}</span>
          {locked && (
            <span className="relative block h-4 w-4 rounded-b-sm bg-[#2d2a26]">
              <span className="absolute -top-3 left-1/2 h-4 w-3 -translate-x-1/2 rounded-t-full border-2 border-[#2d2a26] border-b-0" />
              <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </span>
          )}
        </span>
        <span className={sizeClasses.description}>
          {description}
        </span>
      </span>

      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-white/60 font-light transition group-hover:bg-white ${sizeClasses.arrow}`}
      >
        →
      </span>
    </Link>
  );
}
