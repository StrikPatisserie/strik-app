import { proxySinterklaasGet, proxySinterklaasMutation } from "@/app/sinterklaas/sinterklaasServerApi";
import { NextResponse } from "next/server";
import { b2bCustomers2024 } from "./seed2024";
import { addPersistentFolderContacts, syncFolderContactPreferences } from "@/app/lib/businessFolderContacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ENDPOINT = "sinterklaas-mailing";

export async function GET(request: Request) {
  const response = await proxySinterklaasGet(request, ENDPOINT);
  if (!response.ok) return response;
  const data = await response.clone().json().catch(() => ({}));
  try {
    const existing = Array.isArray(data.customers) && data.customers.length ? data.customers : b2bCustomers2024;
    const customers = await addPersistentFolderContacts(existing);
    return NextResponse.json({ ...data, customers, needsImport: !data.customers?.length || customers.length !== existing.length || customers.some((customer, index) => customer.recipients.length !== existing[index]?.recipients.length) });
  } catch {
    return NextResponse.json({ message: "B2B-contacten konden niet worden geladen. Probeer opnieuw." }, { status: 502 });
  }
}
export async function POST(request: Request) {
  const response = await proxySinterklaasMutation(request, ENDPOINT, "POST");
  if (!response.ok) return response;
  try {
    const data = await response.clone().json();
    if (Array.isArray(data.customers)) await syncFolderContactPreferences(data.customers);
    return response;
  } catch {
    return NextResponse.json({ message: "Mailing opgeslagen, maar toekomstige mailvoorkeuren bijwerken is mislukt. Probeer opnieuw." }, { status: 502 });
  }
}
export async function PATCH(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "PATCH"); }
export async function DELETE(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "DELETE"); }
