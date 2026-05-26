import type { MarginStatus, RecipeStatus } from "./types";
import { marginStatusLabel, recipeStatusLabel } from "./utils";

export function Panel({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={`rounded-[1.35rem] border border-[#e7e0d8] bg-white/88 p-4 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
}>) {
  return (
    <div>
      {eyebrow && (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-1 text-xl font-black leading-tight">{title}</h2>
      {description && (
        <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
          {description}
        </p>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: Readonly<{
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "good" | "pressure" | "critical";
}>) {
  const toneClass =
    tone === "good"
      ? "border-[#c7ddbf] bg-[#f4faf0]"
      : tone === "pressure"
        ? "border-[#edd49b] bg-[#fff8e2]"
        : tone === "critical"
          ? "border-[#efc2bb] bg-[#fff4f1]"
          : "border-[#e7e0d8] bg-[#fffdf8]";

  return (
    <div className={`rounded-[1.15rem] border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black leading-none">{value}</p>
      <p className="mt-2 text-xs font-bold leading-relaxed text-[#2d2a26]/50">
        {detail}
      </p>
    </div>
  );
}

export function MarginBadge({ status }: Readonly<{ status: MarginStatus }>) {
  const className =
    status === "good"
      ? "bg-[#dce8d6] text-[#45663b]"
      : "bg-[#ffe0dc] text-[#a83e31]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${className}`}
    >
      {marginStatusLabel(status)}
    </span>
  );
}

export function RecipeStatusBadge({
  status,
}: Readonly<{ status: RecipeStatus }>) {
  const className =
    status === "active"
      ? "bg-[#dce8d6] text-[#45663b]"
      : status === "draft"
        ? "bg-[#fff0bd] text-[#8a5b10]"
        : "bg-[#ece7df] text-[#2d2a26]/55";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${className}`}
    >
      {recipeStatusLabel(status)}
    </span>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-2xl border border-[#e7e0d8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      Zoeken
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 rounded-2xl border border-[#e7e0d8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

export function EmptyState({ text }: Readonly<{ text: string }>) {
  return (
    <p className="rounded-2xl bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/55">
      {text}
    </p>
  );
}
