import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WelcomePreview from "./WelcomePreview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Welkom bij Strik · ontwerpvoorstel",
  robots: { index: false, follow: false },
};

export default function WelcomePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WelcomePreview />;
}
