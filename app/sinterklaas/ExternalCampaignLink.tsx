export default function ExternalCampaignLink({
  href,
  title,
}: Readonly<{
  href: string;
  title: string;
}>) {
  return (
    <div className="mt-7 border-t border-[#e8e4de] pt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#8b8278]">
        Openbare pagina · opent in een nieuw tabblad
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-10 items-center gap-2 border border-dashed border-[#cfc8be] bg-[#faf8f5] px-3 text-sm font-semibold text-[#6b645b] transition hover:border-[#9b9185] hover:text-[#1a1815]"
      >
        {title} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
