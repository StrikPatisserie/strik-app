import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AppointmentPlanner from "../../bruidstaarten/afspraak/AppointmentPlanner";
import { weddingSettings } from "../../lib/weddingServer";
import { weddingLocalDate } from "../../lib/weddingAppointments";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bruidstaartafspraak inplannen · Strik Patisserie Nijmegen",
  description: "Plan jullie vrijblijvende bruidstaartafspraak bij Strik aan de Ziekerstraat in Nijmegen. Kies direct een beschikbare dag en tijd.",
  alternates: { canonical: "https://strik-patisserie.nl/bruidstaarten/afspraak" },
};
export default async function BridalAppointmentPage() {
  const settings = await weddingSettings().catch(() => null);
  if (!settings?.enabled) notFound();
  return <AppointmentPlanner today={weddingLocalDate()} preview={false} website={(await headers()).get("x-strik-wedding-page") === "appointment"} />;
}
