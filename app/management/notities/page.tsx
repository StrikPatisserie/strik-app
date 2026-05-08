import {
  StrikActionCard,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";
import { noteShops } from "./notesApi";

export default function NotitiesPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Notities"
        description="Notities en to-do's per ijssalon."
        icon={strikIcons.notities}
        kicker="Management"
        tone="light"
      />

      <div className="space-y-3">
        {noteShops.map((shop) => (
          <StrikActionCard
            key={shop.slug}
            href={`/management/notities/${shop.slug}`}
            label="Notities"
            title={shop.label}
            description={`Open notities en to-do's voor ${shop.label}.`}
            icon={strikIcons.notities}
            tone="muted"
          />
        ))}
      </div>
    </StrikShell>
  );
}
