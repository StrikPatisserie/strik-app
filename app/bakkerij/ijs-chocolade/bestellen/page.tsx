import { redirect } from "next/navigation";

export default function LegacyProductionPage() {
  redirect("/bakkerij/productie/bestellen");
}
