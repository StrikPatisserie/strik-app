/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export default function SecondaryResourceLink({
  href,
  title,
  label,
  icon,
  newTab = false,
}: Readonly<{
  href: string;
  title: string;
  label: string;
  icon: string;
  newTab?: boolean;
}>) {
  const className =
    "group flex w-full max-w-md items-center gap-3 rounded-full border border-white/70 bg-white/45 p-1.5 pr-4 shadow-[0_7px_18px_rgba(73,52,45,.07)] backdrop-blur transition hover:bg-white/65";
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fffaf0]">
        <img src={icon} alt="" className="h-6 w-6 object-contain opacity-60" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.5rem] font-black uppercase tracking-[0.15em] text-[#49342d]/40">
          {label}
        </span>
        <span className="block truncate text-xs font-black text-[#49342d]/75">
          {title}
        </span>
      </span>
      <span className="text-sm font-black text-[#49342d]/45 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
        ↗
      </span>
    </>
  );

  return newTab ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
