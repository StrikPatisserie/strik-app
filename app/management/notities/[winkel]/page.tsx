import { notFound } from "next/navigation";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import NotesBoard from "./NotesBoard";
import { getNoteShop, noteShops } from "../notesApi";

export function generateStaticParams() {
  return noteShops.map((shop) => ({
    winkel: shop.slug,
  }));
}

export default async function WinkelNotitiesPage({
  params,
}: {
  params: Promise<{ winkel: string }>;
}) {
  const { winkel } = await params;
  const shop = getNoteShop(winkel);

  if (!shop) {
    notFound();
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title={`Notities ${shop.label}`}
        description="Losse notities en afvinkbare to-do's zonder datum."
        icon={strikIcons.notities}
        kicker="Management"
        tone="light"
      />

      <NotesBoard winkel={shop.slug} winkelLabel={shop.label} />
    </StrikShell>
  );
}
