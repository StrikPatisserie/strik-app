import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import { fetchWordPressPdfFilesByLabel } from "../wordpressMedia";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const files = await fetchWordPressPdfFilesByLabel("winkel");

  return (
    <StrikShell>
      <StrikPageHeader
        title="Belangrijke winkelinfo"
        description="Algemene documenten voor de winkel, zoals prijs- en bedrijfsinformatie."
        icon={strikIcons.info}
      />

      <div className="space-y-3">
        {files.length === 0 ? (
          <div className="rounded-lg border border-[#e8e4de] bg-white p-5 text-sm text-[#a39c91]">
            Geen winkeldocumenten gevonden. Zet in WordPress bij het bestand in
            de titel, het bijschrift of de beschrijving &quot;winkel&quot;.
          </div>
        ) : (
          files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-[#e8e4de] bg-white p-4 transition hover:shadow-md active:scale-[0.97]"
            >
              <p className="text-xs font-medium text-[#a39c91]">
                {new Date(file.date).toLocaleDateString("nl-NL")}
              </p>

              <h2 className="mt-1.5 text-base font-semibold text-[#1a1815]">{file.title}</h2>

              <div className="mt-3 inline-block rounded-lg bg-[#ecf4ed] px-3 py-1.5 text-xs font-medium text-[#4a6d5a]">
                PDF openen
              </div>
            </a>
          ))
        )}
      </div>
    </StrikShell>
  );
}
