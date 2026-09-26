export default function StrikPageTitle({
  title,
}: Readonly<{
  title: string;
}>) {
  return (
    <h1
      className="strik-page-title max-w-full"
      style={{
        color: "#fff",
        fontSize: "clamp(0.84rem, 1.25vw, 0.98rem)",
        fontWeight: 500,
        letterSpacing: "0.3em",
        lineHeight: 1,
        textTransform: "uppercase",
      }}
    >
      {title}
    </h1>
  );
}

export function StrikPageHeading({
  title,
  icon,
  className = "",
}: Readonly<{
  title: string;
  icon?: string;
  className?: string;
}>) {
  return (
    <header className={`relative flex min-w-0 items-center gap-2 ${className}`}>
      {icon && (
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 bg-white"
          style={{
            WebkitMask: `url("${icon}") center / contain no-repeat`,
            mask: `url("${icon}") center / contain no-repeat`,
          }}
        />
      )}
      <StrikPageTitle title={title} />
    </header>
  );
}
