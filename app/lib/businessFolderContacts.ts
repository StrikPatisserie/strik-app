import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { contactEmailKey, type HistoryOrder } from "../sinterklaas/mailing/orderHistory";
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
  const contacts: PersistentContact[] = [];
  const db = createAdminClient();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("app_settings").select("value").like("key", `${PREFIX}%`).order("key").range(offset, offset + 499);
    if (error) throw new Error("B2B-contacten laden mislukt.");
    contacts.push(...(data || []).map(item => item.value as unknown as PersistentContact).filter(item => item?.recipient?.email));
    if (!data || data.length < 500) return contacts;
  }
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


/** Capture contacts once; an order edit must never undo a saved mail preference.
 * This only stores the contact. Sending remains an explicit mailing action.
 */
export async function rememberB2BContacts(orders: HistoryOrder[], customers: FolderCustomer[] = []) {
  const known = new Map(customers.flatMap(customer => customer.recipients).map(recipient => [contactEmailKey(recipient.email), recipient]));
  const candidates = new Map<string, HistoryOrder>();
  for (const order of orders) {
    const email = contactEmailKey(order.customerEmail);
    if (!order.id || !/^\d{4}$/.test(order.year || "") || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) continue;
    // Incomplete addresses stay on the order for correction; never guess them.
    if (!candidates.has(email)) candidates.set(email, order);
  }
  if (!candidates.size) return;
  const updatedAt = new Date().toISOString();
  const rows = [...candidates].map(([email, order]) => {
    const existing = known.get(email);
    const value: PersistentContact = {
      company: order.customerName?.trim() || order.contactName?.trim() || email,
      notes: "",
      recipient: existing ? { ...existing, sent: [] } : {
        id: `b2b-${createHash("sha256").update(email).digest("hex").slice(0, 24)}`,
        contactName: order.contactName?.trim() || "", email,
        // Manual B2B contacts join the requested customer mailing list. A
        // website inquiry with no subscription keeps its existing restriction.
        doNotEmail: Boolean(order.folderQuote && !order.folderQuote.snapshot?.consent) || Boolean(order.cancelled) || order.status === "afgewezen", sent: [], interests: [],
      },
      updatedAt,
    };
    return { key: key(email), value: value as unknown as Json, updated_at: updatedAt };
  });
  const { error } = await createAdminClient().from("app_settings").upsert(rows, { onConflict: "key", ignoreDuplicates: true });
  if (error) throw new Error("B2B-contacten bewaren voor volgende campagnes is mislukt.");
}
