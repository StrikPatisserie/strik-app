import { headers } from "next/headers";
import { notFound } from "next/navigation";
import B2BEntryPreview from "./B2BEntryPreview";
export const dynamic = "force-dynamic";
export const metadata = { title: "B2B invoer · lokale preview", robots: { index: false, follow: false } };
export default async function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test((await headers()).get("host") || "")) notFound();
  return <B2BEntryPreview />;
}
