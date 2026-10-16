import type { MarginStatus, RecipeStatus } from "./types";
import { marginStatusLabel, recipeStatusLabel } from "./utils";
import styles from "./ManagementScreens.module.css";

export function Panel({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={`${styles.sharedPanel} border border-[#e8e4de] bg-white ${className}`}
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
    <div className={styles.sectionTitle}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8b8278]">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-2xl font-bold leading-tight text-[#1a1815]">{title}</h2>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#a39c91]">
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
      ? "border-[#d6e5d8] bg-[#f6faf4]"
      : tone === "pressure"
        ? "border-[#e8e4de] bg-[#faf8f5]"
        : tone === "critical"
          ? "border-[#fee2e2] bg-[#fef2f2]"
          : "border-[#e8e4de] bg-white";

  return (
    <div className={`border rounded-lg p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#8b8278]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold leading-none text-[#1a1815]">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#a39c91]">
        {detail}
      </p>
    </div>
  );
}

export function MarginBadge({ status }: Readonly<{ status: MarginStatus }>) {
  const className =
    status === "good"
      ? "bg-[#ecf4ed] text-[#4a6d5a]"
      : "bg-[#fef2f2] text-[#c42828]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}
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
      ? "bg-[#ecf4ed] text-[#4a6d5a]"
      : status === "draft"
        ? "bg-[#f5f2ee] text-[#6b645b]"
        : "bg-[#f5f2ee] text-[#a39c91]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}
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
    <label className={styles.field}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
    <label className={styles.field}>
      Zoeken
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function EmptyState({ text }: Readonly<{ text: string }>) {
  return (
    <p className="border border-[#e8e4de] bg-[#faf8f5] rounded-lg p-4 text-sm font-medium text-[#a39c91]">
      {text}
    </p>
  );
}
