import type { Metadata } from "next";
import BusinessPage from "../BusinessPage";

export const metadata: Metadata = {
  title: "Zakelijk · Strik Patisserie · Ontwerpvoorbeeld",
  description: "Ontwerpvoorbeeld voor de nieuwe zakelijke pagina van Strik Patisserie.",
  robots: { index: false, follow: false },
  manifest: null,
};

export default function BusinessPreviewPage() {
  return <BusinessPage preview />;
}
