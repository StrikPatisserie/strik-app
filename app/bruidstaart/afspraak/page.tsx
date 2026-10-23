import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AppointmentPlanner from "../../bruidstaarten/afspraak/AppointmentPlanner";
import { weddingSettings } from "../../lib/weddingServer";
import { weddingLocalDate } from "../../lib/weddingAppointments";
import { weddingPageMetadata } from "../../lib/weddingSeo";
import WeddingStructuredData from "../../bruidstaarten/WeddingStructuredData";
export const dynamic = "force-dynamic";
export const metadata = weddingPageMetadata(true);
export default async function BridalAppointmentPage() {
  const settings = await weddingSettings().catch(() => null);
  if (!settings?.enabled) notFound();
  return <><WeddingStructuredData appointment /><AppointmentPlanner today={weddingLocalDate()} preview={false} website={(await headers()).get("x-strik-wedding-page") === "appointment"} /></>;
}
