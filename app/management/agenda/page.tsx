import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import TeamAgendaManager from "./TeamAgendaManager";

export default function ManagementAgendaPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Strik agenda"
        description="Beheer feestdagen, personeelsdagen en teamactiviteiten."
        icon={strikIcons.strikAgenda}
        kicker="Management"
        tone="honey"
      />

      <TeamAgendaManager />
    </StrikShell>
  );
}
