import { headers } from "next/headers";
import BusinessPage from "./BusinessPage";
import { businessPageMetadata, businessPageSchema } from "../lib/businessWebsite";

export const dynamic = "force-dynamic";
export const metadata = businessPageMetadata();

export default async function BusinessWebsitePage() {
  const website = (await headers()).get("x-strik-business-page") === "business";
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessPageSchema()).replace(/</g, "\\u003c") }} /><BusinessPage website={website} /></>;
}
