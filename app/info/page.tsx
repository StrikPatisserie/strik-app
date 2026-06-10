import { StrikShell } from "../StrikUI";
import { fetchWordPressPdfFilesByLabel } from "../wordpressMedia";
import DocumentLibrary from "./DocumentLibrary";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const files = await fetchWordPressPdfFilesByLabel("winkel");

  return (
    <StrikShell>
      <header className="mb-4 border-b border-[#e7e0d8] pb-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef5737]">
          Winkel
        </p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.12em] text-[#1a1815] sm:text-3xl">
          Documenten
        </h1>
      </header>

      <DocumentLibrary files={files} />
    </StrikShell>
  );
}
