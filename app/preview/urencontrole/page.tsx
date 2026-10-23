import { notFound } from "next/navigation";
import HoursReview from "../../management/urencontrole/HoursReview";
export const dynamic = "force-dynamic";
export default function HoursReviewPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <HoursReview demo />;
}
