export default function StrikPageTitle({
  title,
}: Readonly<{
  title: string;
}>) {
  return <h1 className="strik-page-title max-w-full">{title}</h1>;
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
