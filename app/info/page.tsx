import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import { fetchWordPressPdfFilesByLabel } from "../wordpressMedia";
import DocumentLibrary from "./DocumentLibrary";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const files = await fetchWordPressPdfFilesByLabel("winkel");

  return (
    <StrikShell>
      <StrikPageHeader title="Documenten" kicker="Winkel" icon={strikIcons.info} />

      <DocumentLibrary files={files} />
    </StrikShell>
  );
}
