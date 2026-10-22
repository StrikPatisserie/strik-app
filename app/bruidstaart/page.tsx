import { notFound } from "next/navigation";
import BridalInspiration from "../bruidstaarten/inspiratie/BridalInspiration";
import { weddingSettings } from "../lib/weddingServer";
export const dynamic = "force-dynamic";
export const metadata = { title: "Bruidstaarten op maat · Strik Patisserie Nijmegen" };
export default async function BridalPage() {
  const settings = await weddingSettings().catch(() => null);
  if (!settings?.enabled) notFound();
  return <BridalInspiration />;
}
