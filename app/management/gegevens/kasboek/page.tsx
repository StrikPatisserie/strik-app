import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import KasboekMaandrapportClient from "./KasboekMaandrapportClient";

export default function ManagementKasboekPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Kasboek"
        description="Maandrapport per locatie met omzet, stortingen, pin, bonnen en kasverschillen."
        icon={strikIcons.data}
        kicker="Management · Gegevens"
        tone="green"
      />

      <KasboekMaandrapportClient />
    </StrikShell>
  );
}
