import type { CustomerAllergenList } from "./types";

const API_URL = "/api/allergen-lists";

async function readResponse(response: Response) {
  const data = await response.json().catch(() => null) as
    | { lists?: CustomerAllergenList[]; message?: string }
    | null;
  if (!response.ok) {
    throw new Error(data?.message || "Allergenenarchief is niet beschikbaar.");
  }
  return Array.isArray(data?.lists) ? data.lists : [];
}

export async function fetchAllergenLists() {
  return readResponse(await fetch(API_URL, { cache: "no-store" }));
}

export async function saveAllergenLists(lists: CustomerAllergenList[]) {
  return readResponse(await fetch(API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lists }),
  }));
}
