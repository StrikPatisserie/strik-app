import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";

export type FolderRecipient = {
  id: string; contactName: string; email: string; doNotEmail: boolean; sent: unknown[];
  interests?: string[]; consentAt?: string; consentSource?: string;
};
export type FolderCustomer = { id: string; company: string; notes: string; recipients: FolderRecipient[]; ordered?: boolean; orderedAt?: string };
type PersistentContact = { company: string; notes: string; recipient: FolderRecipient; updatedAt: string };
const PREFIX = "business-folder-contact-v1-";
function key(email: string) { return PREFIX + createHash("sha256").update(email.trim().toLowerCase()).digest("hex"); }

export async function saveFolderContact(customer: FolderCustomer, email: string, confirmedConsent = false) {
  const recipient = customer.recipients.find((item) => item.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (!recipient) throw new Error("Contact ontbreekt.");
  const db = createAdminClient();
  const previous = await db.from("app_settings").select("value").eq("key", key(email)).maybeSingle();
  if (previous.error) throw new Error("Bestaande contactvoorkeur laden mislukt.");
  const existing = previous.data?.value as unknown as PersistentContact | undefined;
  const doNotEmail = !confirmedConsent && existing?.recipient.doNotEmail ? true : recipient.doNotEmail;
  const value: PersistentContact = { company: customer.company, notes: customer.notes, recipient: { ...recipient, doNotEmail, sent: [] }, updatedAt: new Date().toISOString() };
  const { error } = await createAdminClient().from("app_settings").upsert({ key: key(email), value: value as unknown as Json, updated_at: value.updatedAt }, { onConflict: "key" });
  if (error) throw new Error("Contact voor toekomstige campagnes opslaan mislukt.");
}

async function readContacts() {
  const { data, error } = await createAdminClient().from("app_settings").select("value").like("key", `${PREFIX}%`);
  if (error) throw new Error("B2B-contacten laden mislukt.");
  return (data || []).map((item) => item.value as unknown as PersistentContact).filter((item) => item?.recipient?.email);
}

export async function addPersistentFolderContacts(customers: FolderCustomer[]) {
  const contacts = await readContacts();
  const result = [...customers];
  const existing = new Set(customers.flatMap((customer) => customer.recipients || []).map((item) => item.email.trim().toLowerCase()));
  for (const contact of contacts) {
    const email = contact.recipient.email.trim().toLowerCase();
    if (existing.has(email)) continue;
    existing.add(email);
    const company = result.findIndex((item) => item.company.trim().toLowerCase() === contact.company.trim().toLowerCase());
    const recipient = { ...contact.recipient, sent: [] };
    if (company >= 0) result[company] = { ...result[company], recipients: [...result[company].recipients, recipient] };
    else result.unshift({ id: `website-${createHash("sha256").update(email).digest("hex").slice(0, 24)}`, company: contact.company, notes: contact.notes, recipients: [recipient] });
  }
  return result;
}

export async function syncFolderContactPreferences(customers: FolderCustomer[]) {
  const contacts = await readContacts();
  const recipients = new Map(customers.flatMap((item) => item.recipients || []).map((item) => [item.email.trim().toLowerCase(), item]));
  for (const contact of contacts) {
    const current = recipients.get(contact.recipient.email.trim().toLowerCase());
    if (!current || current.doNotEmail === contact.recipient.doNotEmail) continue;
    await saveFolderContact({ id: "", company: contact.company, notes: contact.notes, recipients: [{ ...contact.recipient, doNotEmail: current.doNotEmail }] }, contact.recipient.email, !current.doNotEmail);
  }
}
