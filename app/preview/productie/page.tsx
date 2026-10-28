import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductionPreview from "./ProductionPreview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Strik Productie · preview",
  robots: { index: false, follow: false },
};

export default function ProductionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ProductionPreview />;
}
