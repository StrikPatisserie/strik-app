import { StrikPageHeading } from "../../StrikPageTitle";
import { StrikShell, strikIcons } from "../../StrikUI";
import TeamAgendaManager from "./TeamAgendaManager";

export default function ManagementAgendaPage() {
  return (
    <StrikShell wide>
      <StrikPageHeading
        title="Strik Agenda"
        icon={strikIcons.strikAgenda}
        className="mb-2 mt-1"
      />

      <TeamAgendaManager />
    </StrikShell>
  );
}
