import { proxySinterklaasGet, proxySinterklaasMutation } from "@/app/sinterklaas/sinterklaasServerApi";
import { NextResponse } from "next/server";
import { b2bCustomers2024 } from "./seed2024";
import { addPersistentFolderContacts, syncFolderContactPreferences } from "@/app/lib/businessFolderContacts";
import { createReminderMatcher, type MailingContact } from "@/app/sinterklaas/mailing/reminderEligibility";
import type { FolderSelection } from "@/app/lib/businessSeasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ENDPOINT = "sinterklaas-mailing";
const headers = { "Cache-Control": "private, no-store" };

async function reminderCheck(request: Request, campaignYear?: string) {
  const url = new URL(request.url);
  const year = campaignYear || url.searchParams.get("year") || String(new Date().getFullYear());
  const selection = url.searchParams.get("season") || "sint";
  if (!/^\d{4}$/.test(year) || (campaignYear && url.searchParams.has("year") && url.searchParams.get("year") !== year) || !["sint", "kerst", "sint-kerst"].includes(selection)) {
    return NextResponse.json({ message: "Controleer het jaar en de folderkeuze." }, { status: 400, headers });
  }
  // Ignore browser-provided search/status/shop filters: check all current B2B
  // records for the year, including manual orders and web-folder inquiries.
  url.search = "";
  url.searchParams.set("year", year);
  const response = await proxySinterklaasGet(new Request(url, { headers: request.headers }), "sinterklaas-b2b-orders");
  if (!response.ok) return response;
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.orders)) return NextResponse.json({ message: "Aanvragen en bestellingen konden niet worden gecontroleerd. Er is geen reminder verstuurd." }, { status: 502, headers });
  return createReminderMatcher(data.orders, year, selection as FolderSelection);
}

function checkedCampaign<T extends { customers?: MailingContact[] }>(campaign: T, match: ReturnType<typeof createReminderMatcher>) {
  return { ...campaign, customers: (campaign.customers || []).map(customer => ({ ...customer, reminderExclusion: match(customer) })) };
}

// Derived B2B status is read-only and is never written into the shared address
// book. The manual 'Besteld' flag remains separate and campaign-specific.
function cleanCampaign<T extends { customers?: MailingContact[] }>(campaign: T) {
  return { ...campaign, customers: (campaign.customers || []).map(customer => {
    const copy = { ...customer }; delete copy.reminderExclusion; return copy;
  }) };
}

export async function GET(request: Request) {
  const response = await proxySinterklaasGet(request, ENDPOINT);
  if (!response.ok) return response;
  const data = await response.clone().json().catch(() => ({}));
  try {
    const existing = Array.isArray(data.customers) && data.customers.length ? data.customers : b2bCustomers2024;
    const customers = await addPersistentFolderContacts(existing);
    const match = await reminderCheck(request);
    if (match instanceof Response) return match;
    return NextResponse.json({ ...checkedCampaign({ ...data, customers }, match), needsImport: !data.customers?.length || customers.length !== existing.length || customers.some((customer, index) => customer.recipients.length !== existing[index]?.recipients.length) }, { headers });
  } catch {
    return NextResponse.json({ message: "B2B-contacten konden niet worden geladen. Probeer opnieuw." }, { status: 502 });
  }
}
export async function POST(request: Request) {
  const input = await request.clone().json().catch(() => null);
  if (!input || !Array.isArray(input.customers)) return NextResponse.json({ message: "Ongeldige mailing." }, { status: 400, headers });
  const match = await reminderCheck(request, input.year);
  if (match instanceof Response) return match;
  const response = await proxySinterklaasMutation(new Request(request, { body: JSON.stringify(cleanCampaign(input)) }), ENDPOINT, "POST");
  if (!response.ok) return response;
  try {
    const data = await response.clone().json();
    if (Array.isArray(data.customers)) await syncFolderContactPreferences(data.customers);
    return NextResponse.json(checkedCampaign(data, match), { headers });
  } catch {
    return NextResponse.json({ message: "Mailing opgeslagen, maar toekomstige mailvoorkeuren bijwerken is mislukt. Probeer opnieuw." }, { status: 502 });
  }
}
export async function PATCH(request: Request) {
  const input = await request.clone().json().catch(() => null);
  if (!input?.campaign || !Array.isArray(input.campaign.customers)) return NextResponse.json({ message: "Ongeldige verzending." }, { status: 400, headers });
  const match = await reminderCheck(request, input.campaign.year);
  if (match instanceof Response) return match;
  if (input.kind === "reminder1" || input.kind === "reminder2") {
    // Re-read stored contact identity too, so a stale/edited browser cannot
    // bypass a newly matched order by omitting the derived exclusion flag.
    const stored = await proxySinterklaasGet(request, ENDPOINT);
    if (!stored.ok) return stored;
    const data = await stored.json().catch(() => null);
    if (!Array.isArray(data?.customers)) return NextResponse.json({ message: "De verzendlijst kon niet worden gecontroleerd. Er is geen reminder verstuurd." }, { status: 502, headers });
    const target = input.campaign.customers.find((customer: { id: string }) => customer.id === input.customerId);
    const saved = data.customers.find((customer: { id: string }) => customer.id === input.customerId);
    const exclusion = (target && match(target)) || (saved && match(saved));
    if (target?.ordered || saved?.ordered || exclusion) {
      const campaign = checkedCampaign(input.campaign, match);
      // Reflect the canonical match even if the draft contact was edited.
      campaign.customers = campaign.customers.map((customer: MailingContact & { id?: string }) => customer.id === input.customerId ? { ...customer, ...(exclusion ? { reminderExclusion: exclusion } : { ordered: true }) } : customer);
      return NextResponse.json({ ...campaign, skipped: true, skipReason: "Al een aanvraag of bestelling voor deze campagne." }, { headers });
    }
  }
  const response = await proxySinterklaasMutation(new Request(request, { body: JSON.stringify({ ...input, campaign: cleanCampaign(input.campaign) }) }), ENDPOINT, "PATCH");
  if (!response.ok) return response;
  return NextResponse.json(checkedCampaign(await response.json(), match), { headers });
}
export async function DELETE(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "DELETE"); }
