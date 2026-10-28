import "server-only";
import { recipeStorageAuthHeaders } from "../lib/recipeStorageAuth";
import { ProductionStoreError } from "./documents.server";

// The transfer endpoint authenticates the existing manager session, never a
// shared integration key. Full snapshots stay on the application server.
export async function wordpressTransfer(action: "inspect" | "lock" | "snapshot" | "retire" | "unlock", lockId?: string): Promise<{ data: Record<string, unknown>; allergenLists: unknown[]; locked: boolean; retired: boolean }> {
  const response = await fetch("https://strik-patisserie.nl/wp-json/strik/v1/recepturen-storage-transfer", {
    method: "POST", headers: { ...await recipeStorageAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ action, lockId }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new ProductionStoreError(response.status === 404 ? "De WordPress-overdrachtsbeveiliging is nog niet geïnstalleerd." : response.status === 423 ? "Een andere overdracht heeft de WordPress-bron vergrendeld." : "De WordPress-bron kon niet veilig worden gelezen of vergrendeld. Er is niet omgeschakeld.", response.status === 423 ? 423 : 503);
  const result = await response.json();
  if (!result || !result.data || !Array.isArray(result.data.recipes) || !Array.isArray(result.allergenLists)) throw new ProductionStoreError("De WordPress-bron bevat geen geldige volledige export.");
  return result;
}
