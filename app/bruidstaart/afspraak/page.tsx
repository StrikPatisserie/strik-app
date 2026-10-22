import { notFound } from "next/navigation";
import AppointmentPlanner from "../../bruidstaarten/afspraak/AppointmentPlanner";
import { weddingSettings } from "../../lib/weddingServer";
import { weddingLocalDate } from "../../lib/weddingAppointments";
export const dynamic = "force-dynamic";
export const metadata = { title: "Bruidstaartafspraak inplannen · Strik Patisserie Nijmegen" };
export default async function BridalAppointmentPage() {
  const settings = await weddingSettings().catch(() => null);
  if (!settings?.enabled) notFound();
  return <AppointmentPlanner today={weddingLocalDate()} preview={false} />;
}
