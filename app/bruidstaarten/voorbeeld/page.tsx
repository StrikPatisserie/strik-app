import type { Metadata } from "next";
import BridalInspiration from "../inspiratie/BridalInspiration";

export const metadata: Metadata = { title: "Bruidstaarten · Strik · Ontwerpvoorbeeld", robots: { index: false, follow: false } };
export default function BridalPreviewPage() { return <BridalInspiration preview />; }
