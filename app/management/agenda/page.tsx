import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import TeamAgendaManager from "./TeamAgendaManager";

export default function ManagementAgendaPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Strik Agenda"
        description="Agenda, verjaardagen en jubilea."
        icon={strikIcons.strikAgenda}
        kicker="Management"
        tone="honey"
      />

      <TeamAgendaManager />
    </StrikShell>
  );
}
