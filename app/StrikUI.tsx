/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import StrikBackButton from "./StrikBackButton";
import StrikPageTitle from "./StrikPageTitle";

export const strikIcons = {
  agenda: "/icons_strik_agenda.svg",
  bakkerij: "/apps%20strik_Bakkerij.svg",
  data: "/APP_iconss__data.svg",
  gebak: "/icons_strik_winkel.svg",
  bruidstaart: "/icons_strik_bruidstaart.svg",
  cleaning: "/icons_strik_cleaning.svg",
  cleaningManagement: "/icons_strik_cleaning%20management.svg",
  afsluitplan: "/icons_strik_afsluitplan.svg",
  ijs: "/APP_icons_strik%20ijsbakje.svg",
  ijsChocolade: "/APP_icons_ijsenchoco.svg",
  info: "/icons_strik_info.svg",
  logistiek: "/aoo-logistiek.svg",
  management: "/icons_strik_management.svg",
  news: "/icons_strik_news.svg",
  newsManagement: "/icons_strik_add%20news%20management.svg",
  notities: "/icons_strik.svg",
  opstartplan: "/icons_strik_opstartplan.svg",
  overview: "/APP_iconss__overview.svg",
  photo: "/icons_strik_photo.svg",
  recepturen: "/apps%20strik_recepten.svg",
  sinterklaas: "/APP_icons_strik_SINT.svg",
  strikAgenda: "/icons_strik_strikagenda.svg",
  winkel: "/APP_icons_strikk__winkel.svg",
};

const toneClasses = {
  primary: "bg-[#ecf4ed] border-[#d6e5d8]",
  secondary: "bg-[#fef9f3] border-[#f3d4a4]",
  neutral: "bg-white border-[#e8e4de]",
  success: "bg-[#f0fdf4] border-[#dcfce7]",
  error: "bg-[#fef2f2] border-[#fee2e2]",
  warning: "bg-[#fffbeb] border-[#fef3c7]",
  blue: "bg-[#eef7fa] border-[#dbe9ee]",
  honey: "bg-[#fef9f3] border-[#f3d4a4]",
  pink: "bg-[#fff1f4] border-[#f4d8dc]",
  light: "bg-[#f6faf4] border-[#d6e5d8]",
  green: "bg-[#ecf4ed] border-[#d6e5d8]",
  medium: "bg-[#f0f5ed] border-[#c3d3bc]",
  muted: "bg-white/75 border-[#e8e4de]",
  dark: "bg-[#e4eee0] border-[#a8bf9e]",
};

type Tone = keyof typeof toneClasses;

const actionCardSizeClasses = {
  compact: {
    card: "gap-3 rounded-lg p-3",
    iconWrap: "h-10 w-10",
    icon: "h-6 w-6",
    label:
      "mb-0.5 inline-block text-[0.65rem] font-semibold uppercase tracking-wider text-[#8b8278]",
    title: "text-sm font-bold leading-tight text-[#1a1815]",
    description: "mt-1 block text-xs leading-snug text-[#a39c91]",
    arrow: "h-8 w-8 text-base flex-shrink-0",
  },
  regular: {
    card: "gap-3 rounded-xl p-3",
    iconWrap: "h-10 w-10",
    icon: "h-6 w-6",
    label:
      "mb-1 inline-block text-[0.66rem] font-semibold uppercase tracking-wider text-[#8b8278]",
    title: "text-sm font-bold leading-tight text-[#1a1815]",
    description: "mt-1 block text-xs leading-snug text-[#a39c91]",
    arrow: "h-8 w-8 text-base flex-shrink-0",
  },
  large: {
    card: "gap-3 rounded-xl p-4",
    iconWrap: "h-12 w-12",
    icon: "h-6 w-6",
    label:
      "mb-1 inline-block text-[0.66rem] font-semibold uppercase tracking-wider text-[#8b8278]",
    title: "text-base font-bold leading-tight text-[#1a1815]",
    description: "mt-1 block text-sm leading-snug text-[#a39c91]",
    arrow: "h-9 w-9 text-lg flex-shrink-0",
  },
};

type ActionCardSize = keyof typeof actionCardSizeClasses;

const squareActionCardSizeClasses = {
  compact: {
    card: "grid-rows-[3rem_1fr] rounded-lg p-3",
    title: "text-sm font-bold",
    icon: "h-10 w-10",
    badge: "right-2 top-2 h-5 min-w-5 px-1.5 text-xs",
  },
  regular: {
    card: "grid-rows-[3.5rem_1fr] rounded-xl p-3",
    title: "text-base font-bold",
    icon: "h-12 w-12",
    badge: "right-3 top-3 h-6 min-w-6 px-2 text-sm",
  },
  large: {
    card: "grid-rows-[4rem_1fr] rounded-xl p-4",
    title: "text-lg font-bold",
    icon: "h-16 w-16",
    badge: "right-4 top-4 h-7 min-w-7 px-2 text-sm",
  },
};

type SquareActionCardSize = keyof typeof squareActionCardSizeClasses;

const menuToneClasses = {
  green: {
    border: "border-[#cbdcc5]",
    hover: "hover:bg-[#f6faf4]",
    block: "bg-[#c3d3bc]",
  },
  yellow: {
    border: "border-[#eadb8b]",
    hover: "hover:bg-[#fff8d8]",
    block: "bg-[#f7df83]",
  },
  blue: {
    border: "border-[#bcd7e8]",
    hover: "hover:bg-[#edf5fb]",
    block: "bg-[#b9d7ea]",
  },
  neutral: {
    border: "border-[#e8e4de]",
    hover: "hover:bg-[#faf8f5]",
    block: "bg-[#ddd7cd]",
  },
};

type MenuTone = keyof typeof menuToneClasses;

function StrikMenuRowContent({
  title,
  icon,
  symbol,
  tone,
}: Readonly<{
  title: string;
  icon?: string;
  symbol?: React.ReactNode;
  tone: MenuTone;
}>) {
  const toneClass = menuToneClasses[tone];

  return (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center ${toneClass.block}`}
        >
          {icon ? (
            <img src={icon} alt="" className="h-6 w-6 object-contain" />
          ) : (
            <span className="text-sm font-black text-[#1a1815]">
              {symbol}
            </span>
          )}
        </span>
        <span className="truncate text-xl font-black text-[#1a1815]">
          {title}
        </span>
      </span>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center text-xl font-black ${toneClass.block}`}
        aria-hidden="true"
      >
        &gt;
      </span>
    </>
  );
}

export function StrikMenuLink({
  href,
  title,
  icon,
  symbol,
  tone = "green",
  target,
  rel,
}: Readonly<{
  href: string;
  title: string;
  icon?: string;
  symbol?: React.ReactNode;
  tone?: MenuTone;
  target?: "_self" | "_blank" | "_parent" | "_top";
  rel?: string;
}>) {
  const toneClass = menuToneClasses[tone];

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={`flex min-h-16 items-center justify-between border bg-white px-3 py-2 shadow-sm transition active:scale-[0.99] ${toneClass.border} ${toneClass.hover}`}
    >
      <StrikMenuRowContent
        title={title}
        icon={icon}
        symbol={symbol}
        tone={tone}
      />
    </Link>
  );
}

export function StrikMenuButton({
  title,
  icon,
  symbol,
  tone = "green",
  onClick,
}: Readonly<{
  title: string;
  icon?: string;
  symbol?: React.ReactNode;
  tone?: MenuTone;
  onClick: () => void;
}>) {
  const toneClass = menuToneClasses[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 items-center justify-between border bg-white px-3 py-2 text-left shadow-sm transition active:scale-[0.99] ${toneClass.border} ${toneClass.hover}`}
    >
      <StrikMenuRowContent
        title={title}
        icon={icon}
        symbol={symbol}
        tone={tone}
      />
    </button>
  );
}

export function StrikShell({
  children,
  wide = false,
}: Readonly<{
  children: React.ReactNode;
  wide?: boolean;
}>) {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-5 pb-24 text-[#1a1815] sm:px-6 lg:px-7">
      <div className={`mx-auto w-full ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
        <StrikBackButton />
        {children}
      </div>
    </main>
  );
}

export function StrikPageHeader({
  title,
  description,
  icon,
  kicker,
}: Readonly<{
  title: string;
  description?: string;
  icon?: string;
  kicker?: string;
  tone?: Tone;
}>) {
  return (
    <header className="mb-4 flex min-w-0 flex-col gap-1.5 pb-1 sm:mb-5">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        {icon && (
          <span
            aria-hidden="true"
            className="block h-[clamp(1rem,4.4vw,1.8rem)] w-[clamp(1rem,4.4vw,1.8rem)] shrink-0 bg-[#ef5737]"
            style={{
              WebkitMask: `url("${icon}") center / contain no-repeat`,
              mask: `url("${icon}") center / contain no-repeat`,
            }}
          />
        )}
        <div className="min-w-0">
          <StrikPageTitle title={title} />
        </div>
      </div>
      {(kicker || description) && (
        <p className="max-w-2xl pl-[calc(clamp(1rem,4.4vw,1.8rem)+0.75rem)] text-xs font-normal leading-snug tracking-normal text-[#6b645b] sm:pl-[calc(clamp(1rem,4.4vw,1.8rem)+1rem)] sm:text-sm">
          {[kicker?.toLowerCase(), description].filter(Boolean).join(" · ")}
        </p>
      )}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: Readonly<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e8e4de] bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-black text-[#1a1815]">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-[#6b645b]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StrikSquareActionCard({
  href,
  title,
  icon,
  badge,
  tone = "primary",
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
  const toneClass = toneClasses[tone];

  return (
    <Link
      href={href}
      className={`group relative grid aspect-square items-center border transition-all hover:shadow-md active:scale-[0.97] ${sizeClasses.card} ${toneClass}`}
    >
      {badge && (
        <span
          className={`absolute flex items-center justify-center rounded-full bg-[#ef4444] font-bold text-white shadow-sm ${sizeClasses.badge}`}
        >
          {badge}
        </span>
      )}
      <span
        className={`flex h-full items-center justify-center font-semibold leading-tight text-[#1a1815] text-center ${sizeClasses.title}`}
      >
        {title}
      </span>
      <span className="flex h-full items-center justify-center">
        <img
          src={icon}
          alt=""
          className={`object-contain transition group-hover:scale-110 ${sizeClasses.icon}`}
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
  tone = "neutral",
  size = "regular",
  locked = false,
  target,
  rel,
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
  target?: "_self" | "_blank" | "_parent" | "_top";
  rel?: string;
}>) {
  const sizeClasses = actionCardSizeClasses[size];
  const toneClass = toneClasses[tone];

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={`group relative flex items-center border transition-all hover:shadow-md active:scale-[0.97] ${sizeClasses.card} ${toneClass}`}
    >
      {badge && (
        <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef4444] px-2 text-xs font-bold text-white shadow-sm">
          {badge}
        </span>
      )}

      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-[#ecf4ed] ${sizeClasses.iconWrap}`}
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
            <span className="text-sm">🔒</span>
          )}
        </span>
        <span className={sizeClasses.description}>
          {description}
        </span>
      </span>

      <span
        className={`flex shrink-0 items-center justify-center font-light text-[#d9d2c9] transition group-hover:text-[#8b8278] ${sizeClasses.arrow}`}
      >
        →
      </span>
    </Link>
  );
}
