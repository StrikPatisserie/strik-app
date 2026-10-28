import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductionPreview from "./ProductionPreview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "STRAK gepland · preview",
  icons: { icon: "/strak-gepland/mark.svg", apple: "/strak-gepland/apple-touch-icon.png" }, robots: { index: false, follow: false },
};

export default function ProductionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ProductionPreview />;
}
