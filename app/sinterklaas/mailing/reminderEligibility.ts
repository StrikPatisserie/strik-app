import type { FolderSelection } from "../../lib/businessSeasons";

export type ReminderExclusion = { status: "ordered" | "quote"; matchedBy: "email" | "company" };
export type MailingContact = {
  company: string;
  recipients: { email: string }[];
  ordered?: boolean;
  reminderExclusion?: ReminderExclusion | null;
};
type OrderContact = {
  year?: string; season?: string; status?: string; cancelled?: boolean;
  customerName?: string; customerEmail?: string;
};
const emailKey = (value = "") => value.trim().toLowerCase();
// Exact names after punctuation/spacing normalisation; never match a whole
// mail domain or guess from similar names (e.g. two different departments).
const companyKey = (value = "") => value.normalize("NFKC").toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

export function createReminderMatcher(orders: OrderContact[], year: string, selection: FolderSelection) {
  const emails = new Map<string, ReminderExclusion["status"]>();
  const companies = new Map<string, ReminderExclusion["status"]>();
  for (const order of orders) {
    const season = order.season || "sint";
    // Older imported orders have no status; the B2B list treats these as final.
    const stage = order.status || "akkoord";
    if (order.year !== year || order.cancelled || !["aanvraag", "offerte", "akkoord"].includes(stage)) continue;
    if (selection !== "sint-kerst" && season !== selection && season !== "sint-kerst") continue;
    if (!["sint", "kerst", "sint-kerst"].includes(season)) continue;
    const status = stage === "akkoord" ? "ordered" : "quote";
    for (const [map, key] of [[emails, emailKey(order.customerEmail)], [companies, companyKey(order.customerName)]] as const) {
      if (key && (status === "ordered" || !map.has(key))) map.set(key, status);
    }
  }
  return (customer: MailingContact): ReminderExclusion | null => {
    const matches = customer.recipients.map(recipient => emails.get(emailKey(recipient.email)));
    const company = companies.get(companyKey(customer.company));
    // An order takes precedence when both a quote and a final order exist.
    if (matches.includes("ordered")) return { status: "ordered", matchedBy: "email" };
    if (company === "ordered") return { status: "ordered", matchedBy: "company" };
    if (matches.includes("quote")) return { status: "quote", matchedBy: "email" };
    return company ? { status: company, matchedBy: "company" } : null;
  };
}

export function reminderExcluded(customer: MailingContact) {
  return Boolean(customer.ordered || customer.reminderExclusion);
}

export type ContactFilter = "open" | "all" | "responded";
export function contactMatchesFilter(customer: MailingContact, filter: ContactFilter) {
  return filter === "all" || (filter === "responded" ? reminderExcluded(customer) : !reminderExcluded(customer));
}
