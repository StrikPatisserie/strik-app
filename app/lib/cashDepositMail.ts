export type CashDepositMailEntry = {
  year: number;
  week: number;
  weekLabel: string;
  shop: string;
  kind: "patisserie" | "ice";
  amount: number;
};

const euro = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
const cents = (entry: CashDepositMailEntry) => Math.round(entry.amount * 100);
const sum = (entries: CashDepositMailEntry[]) => entries.reduce((total, entry) => total + cents(entry), 0);
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const categoryTotal = (entries: CashDepositMailEntry[], kind: CashDepositMailEntry["kind"]) => {
  const selected = entries.filter(entry => entry.kind === kind);
  return selected.length ? euro(sum(selected)) : "Niet in deze melding";
};

export function createCashDepositMail(entries: CashDepositMailEntry[], reportedAt: Date) {
  const reported = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", day: "numeric", month: "long", year: "numeric" }).format(reportedAt);
  const weeks = new Map<string, CashDepositMailEntry[]>();
  for (const entry of entries) {
    const key = `${entry.year}-W${String(entry.week).padStart(2, "0")}`;
    weeks.set(key, [...(weeks.get(key) || []), entry]);
  }
  const total = euro(sum(entries));
  const plain = [`Storting gemeld op ${reported}`, "", `TOTAAL GESTORT: ${total}`, `Patisserie: ${categoryTotal(entries, "patisserie")}`, `IJs: ${categoryTotal(entries, "ice")}`, ""];
  const splitCells = (selected: CashDepositMailEntry[]) => (["patisserie", "ice"] as const).map(kind => `<td width="50%" valign="top" style="padding:10px 8px 0 0;font-size:13px;line-height:1.6;color:#647267"><span>${kind === "ice" ? "IJs" : "Patisserie"}</span><br><strong style="font-weight:600;color:#2c4435">${escape(categoryTotal(selected, kind))}</strong></td>`).join("");
  const weekCards: string[] = [];
  for (const selected of weeks.values()) {
    const first = selected[0];
    plain.push(`WEEK ${first.week} ${first.year} · ${first.weekLabel}`);
    const shops = new Map<string, CashDepositMailEntry[]>();
    for (const entry of selected) shops.set(entry.shop, [...(shops.get(entry.shop) || []), entry]);
    const shopRows: string[] = [];
    for (const [shop, shopEntries] of shops) {
      const shopTotal = euro(sum(shopEntries));
      plain.push(`${shop}: ${shopTotal} totaal gestort`, `  Patisserie: ${categoryTotal(shopEntries, "patisserie")}`, `  IJs: ${categoryTotal(shopEntries, "ice")}`);
      shopRows.push(`<tr><td style="padding:18px 20px;border-bottom:1px solid #e3e7dd"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:16px;line-height:1.5;font-weight:700;color:#294634">${escape(shop)}</td><td align="right" style="padding-left:12px;font-size:18px;line-height:1.5;font-weight:700;color:#294634">${escape(shopTotal)}</td></tr><tr><td colspan="2"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${splitCells(shopEntries)}</tr></table></td></tr></table></td></tr>`);
    }
    plain.push(`Totaal week ${first.week}: ${euro(sum(selected))}`, "");
    weekCards.push(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border:1px solid #dce3d5;border-radius:14px;overflow:hidden"><tr><td style="padding:16px 20px;background:#eaf0e4;color:#294634"><strong style="font-size:16px">Week ${first.week} · ${first.year}</strong><br><span style="font-size:12px;line-height:1.8">${escape(first.weekLabel)}</span></td></tr>${shopRows.join("")}<tr><td style="padding:14px 20px;background:#f6f8f1"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:13px;font-weight:700">Totaal week ${first.week}</td><td align="right" style="font-size:16px;font-weight:700">${escape(euro(sum(selected)))}</td></tr></table></td></tr></table>`);
  }
  plain.push(`Totaal gestort: ${total}`, "", "Dit overzicht bevat de geselecteerde stortingen. Patisserie en ijs staan apart en samen vermeld.", "Automatisch gemeld vanuit Geld tellen in de Strik Team app.");
  const locations = new Set(entries.map(entry => entry.shop)).size;
  const htmlBody = `<!doctype html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#eef2e9;font:15px Arial,sans-serif;color:#294634"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2e9;font-family:Arial,sans-serif;font-size:15px;color:#294634"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fffdf8;border-radius:20px;overflow:hidden"><tr><td style="padding:30px 26px;background:#244b38;color:#fffdf8"><p style="margin:0 0 22px;font-size:12px;letter-spacing:3px;font-weight:700;color:#e4cf9f">STRIK PATISSERIE</p><h1 style="margin:0 0 12px;font:34px Georgia,serif">Storting gemeld</h1><p style="margin:0;font-size:14px;line-height:1.7">${escape(reported)} · ${locations} locatie${locations === 1 ? "" : "s"}</p></td></tr><tr><td style="padding:24px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eaf0e4;border:1px solid #d6e1cc;border-radius:14px"><tr><td style="padding:22px 20px"><p style="margin:0 0 8px;font-size:11px;letter-spacing:1.5px;font-weight:700">TOTAAL GESTORT</p><p style="margin:0 0 12px;font-size:34px;font-weight:700">${escape(total)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #cbd8c2"><tr>${splitCells(entries)}</tr></table></td></tr></table><h2 style="margin:30px 0 5px;font:24px Georgia,serif">Per week en locatie</h2><p style="margin:0;color:#6b776c;font-size:13px;line-height:1.7">Het totaal per locatie met daaronder de verdeling tussen patisserie en ijs.</p>${weekCards.join("")}<p style="margin:24px 0 0;font-size:12px;line-height:1.8;color:#6b776c">Dit overzicht bevat de geselecteerde stortingen. ‘Niet in deze melding’ betekent dat deze categorie niet was geselecteerd.</p><p style="margin:20px 0 0;padding-top:18px;border-top:1px solid #e3e7dd;font-size:12px;line-height:1.8;color:#6b776c">Automatisch gemeld vanuit <strong>Geld tellen</strong> in de Strik Team app.</p></td></tr></table></td></tr></table></body></html>`;
  return { body: plain.join("\n"), htmlBody };
}
