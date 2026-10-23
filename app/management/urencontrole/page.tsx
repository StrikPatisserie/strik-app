import { requireAdminProfile } from "../../lib/auth/session";
import HoursReview from "./HoursReview";
export const dynamic = "force-dynamic";
export default async function HoursReviewPage() {
  await requireAdminProfile();
  return <HoursReview />;
}
