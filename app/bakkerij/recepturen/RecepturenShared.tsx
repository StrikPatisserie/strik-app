import type { MarginStatus, RecipeStatus } from "./types";
import { marginStatusLabel, recipeStatusLabel } from "./utils";

export function Panel({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={`rounded-lg border border-[#d8d8d4] bg-white p-4 shadow-sm ${className}`}
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
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8c8c8c]">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-1 text-xl font-black leading-tight text-[#252525]">{title}</h2>
      {description && (
        <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#707070]">
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
      ? "border-[#c3d3bc] bg-[#f6faf4]"
      : tone === "pressure"
        ? "border-[#c3d3bc] bg-[#f5f5f3]"
        : tone === "critical"
          ? "border-[#d75a48] bg-[#fff4f1]"
          : "border-[#d8d8d4] bg-white";

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black leading-none">{value}</p>
      <p className="mt-2 text-xs font-bold leading-relaxed text-[#707070]">
        {detail}
      </p>
    </div>
  );
}

export function MarginBadge({ status }: Readonly<{ status: MarginStatus }>) {
  const className =
    status === "good"
      ? "bg-[#c3d3bc] text-[#252525]"
      : "bg-[#ffe0dc] text-[#d75a48]";

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
      ? "bg-[#c3d3bc] text-[#252525]"
      : status === "draft"
        ? "bg-[#efefed] text-[#252525]"
        : "bg-[#efefed] text-[#707070]";

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
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-lg border border-[#d8d8d4] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#252525] focus:outline-none focus:ring-2 focus:ring-[#c3d3bc]"
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
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
      Zoeken
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 rounded-lg border border-[#d8d8d4] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#252525] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#c3d3bc]"
      />
    </label>
  );
}

export function EmptyState({ text }: Readonly<{ text: string }>) {
  return (
    <p className="rounded-lg bg-[#f5f5f3] p-4 text-sm font-bold text-[#707070]">
      {text}
    </p>
  );
}
