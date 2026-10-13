import { notFound } from "next/navigation";
import PresentationPreview from "./PresentationPreview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PresentationPreview />;
}
