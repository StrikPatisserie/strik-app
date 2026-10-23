import { notFound } from "next/navigation";
import { headers } from "next/headers";
import BridalInspiration from "../bruidstaarten/inspiratie/BridalInspiration";
import { weddingSettings } from "../lib/weddingServer";
import { weddingPageMetadata } from "../lib/weddingSeo";
import WeddingStructuredData from "../bruidstaarten/WeddingStructuredData";
export const dynamic = "force-dynamic";
export const metadata = weddingPageMetadata();
export default async function BridalPage() {
  const settings = await weddingSettings().catch(() => null);
  if (!settings?.enabled) notFound();
  return <><WeddingStructuredData /><BridalInspiration website={(await headers()).get("x-strik-wedding-page") === "inspiration"} /></>;
}
