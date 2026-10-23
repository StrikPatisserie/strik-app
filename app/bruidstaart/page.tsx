import { notFound } from "next/navigation";
import { headers } from "next/headers";
import BridalInspiration from "../bruidstaarten/inspiratie/BridalInspiration";
import { weddingSettings } from "../lib/weddingServer";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bruidstaarten op maat · Strik Patisserie Nijmegen",
  description: "Ontdek klassieke, naked en crème bruidstaarten uit onze eigen bakkerij. Bekijk voorbeelden en plan een vrijblijvend gesprek bij Strik in Nijmegen.",
  alternates: { canonical: "https://strik-patisserie.nl/bruidstaarten" },
};
export default async function BridalPage() {
  const settings = await weddingSettings().catch(() => null);
  if (!settings?.enabled) notFound();
  return <BridalInspiration website={(await headers()).get("x-strik-wedding-page") === "inspiration"} />;
}
