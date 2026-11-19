import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import NewRecipeForm from "@/app/productie/NewRecipeForm";

export default async function NewProductionRecipePage() {
  const profile = await requireCurrentProfile();
  if (!productionDepartments(profile).length) notFound();
  return <NewRecipeForm />;
}
