import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

export const dynamic = "force-dynamic";

type FileItem = {
  id: string | number;
  url: string;
  date: string;
  title: string;
};

async function fetchIjsFiles() {
  const res = await fetch(
    "https://strik-patisserie.nl/wp-json/strik/v1/files?type=ijs",
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return [] as FileItem[];
  }

  return (await res.json()) as FileItem[];
}

export default async function IJsInfoPage() {
  const files = await fetchIjsFiles();

  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs documenten"
        description="Specifieke informatie voor de ijssalons, zoals allergenenlijst 2026."
        icon={strikIcons.info}
        tone="light"
      />

      <div className="space-y-3">
        {files.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white p-5 text-sm text-gray-600 shadow-sm">
            Geen ijsdocumenten gevonden. Upload bestanden in WordPress met tag of type &quot;ijs&quot;.
          </div>
        ) : (
          files.map((file) => (
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
          ))
        )}
      </div>
    </StrikShell>
  );
}
