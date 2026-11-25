import type { MailingContact } from "./reminderEligibility";

export type OrderHistoryEntry = { year: string; season: "sint" | "kerst" };
export type HistoryOrder = {
  id?: string; year?: string; season?: string; status?: string; cancelled?: boolean;
  customerName?: string; customerEmail?: string; contactName?: string;
  folderQuote?: { snapshot?: { consent?: boolean } };
};
export const contactEmailKey = (value = "") => value.trim().toLowerCase();
const companyKey = (value = "") => value.normalize("NFKC").toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

// Only actual orders qualify. Inquiries, rejected and cancelled orders do not.
// The selected campaign year never rewrites an order's own edition/year.
export function createOrderHistoryMatcher(orders: HistoryOrder[], campaignYear: string) {
  const emails = new Map<string, Map<string, OrderHistoryEntry>>();
  const companies = new Map<string, Map<string, OrderHistoryEntry>>();
  for (const order of orders) {
    if (!/^\d{4}$/.test(order.year || "") || Number(order.year) > Number(campaignYear) || order.cancelled || (order.status || "akkoord") !== "akkoord") continue;
    const seasons = order.season === "sint-kerst" ? ["sint", "kerst"] : [order.season || "sint"];
    for (const season of seasons) {
      if (season !== "sint" && season !== "kerst") continue;
      const entry: OrderHistoryEntry = { year: order.year!, season };
      for (const [index, identity] of [[emails, contactEmailKey(order.customerEmail)], [companies, companyKey(order.customerName)]] as const) {
        if (!identity) continue;
        if (!index.has(identity)) index.set(identity, new Map());
        index.get(identity)!.set(`${entry.year}-${season}`, entry);
      }
    }
  }
  return (customer: MailingContact): OrderHistoryEntry[] => {
    const result = new Map<string, OrderHistoryEntry>();
    const matches = [companies.get(companyKey(customer.company)), ...customer.recipients.map(recipient => emails.get(contactEmailKey(recipient.email)))];
    for (const match of matches) for (const [key, entry] of match || []) result.set(key, entry);
    return [...result.values()].sort((a, b) => Number(b.year) - Number(a.year) || (a.season === b.season ? 0 : a.season === "sint" ? -1 : 1));
  };
}

export function orderedPreviousYear(history: OrderHistoryEntry[] | undefined, campaignYear: string) {
  return Boolean(history?.some(entry => Number(entry.year) === Number(campaignYear) - 1));
}
