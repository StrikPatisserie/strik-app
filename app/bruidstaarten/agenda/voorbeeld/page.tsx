import type { Metadata } from "next";
import AppointmentPlanner from "../../afspraak/AppointmentPlanner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Voorbeeld bruidstaartafspraak · Strik", robots: { index: false, follow: false } };

export default function AppointmentPreviewPage() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <AppointmentPlanner today={today} />;
}
