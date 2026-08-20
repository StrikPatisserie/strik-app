import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";

export default function BakkerijLogistiekPage() {
  return (
    <StrikShell>
      <StrikPageHeader
        title="Bakkerij logistiek"
        icon={strikIcons.logistiek}
      />

      <section className="space-y-2">
        <StrikMenuLink
          href="/bakkerij/logistiek/dagstart"
          title="Dagstart"
          icon={strikIcons.logistiek}
        />
        <StrikMenuLink
          href="/bakkerij/logistiek/havelaar"
          title="Havelaar"
          icon={strikIcons.data}
        />
      </section>
    </StrikShell>
  );
}
