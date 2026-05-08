import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";

export const dynamic = "force-dynamic";

type FileItem = {
  id: string | number;
  url: string;
  date: string;
  title: string;
};

export default async function InfoPage() {
  const res = await fetch("https://strik-patisserie.nl/wp-json/strik/v1/files", {
    cache: "no-store",
  });

  const files = (await res.json()) as FileItem[];

  return (
    <StrikShell>
      <StrikPageHeader
        title="Belangrijke winkelinfo"
        description="Algemene documenten voor de winkel, zoals prijs- en bedrijfsinformatie."
        icon={strikIcons.info}
        tone="light"
      />

      <div className="space-y-3">
        {files.map((file) => (
          <a
            key={file.id}
            href={file.url}
            target="_blank"
            className="block rounded-[1.5rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm transition active:scale-[0.98] hover:shadow-md"
          >
            <p className="text-xs text-gray-500">
              {new Date(file.date).toLocaleDateString("nl-NL")}
            </p>

            <h2 className="mt-1 text-lg font-bold">{file.title}</h2>

            <div className="mt-3 inline-block rounded-full bg-[#c3d3bc] px-3 py-1 text-xs font-semibold">
              PDF openen
            </div>
          </a>
        ))}
      </div>
    </StrikShell>
  );
}
