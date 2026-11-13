import "server-only";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { christmasProducts } from "../../../kerst-voor-bedrijven/christmasProducts";
import articleCatalog from "../../../data/strik-articles-2026.json";
import type { SalesProduct } from "./forecast";
import { buildSalesAssortment } from "./assortment";
import { parseDebtorReport, replaceDebtorSales } from "./debtorImport";
import { todayInAmsterdam } from "./campaignNeed";
import { attachWeek52Sales, type WeeklySalesLine } from "./week52";

export async function christmasForecastSource(): Promise<{ products: SalesProduct[]; today: string; error?: string; week52Error?: string }> {
  const today = todayInAmsterdam();
  if (process.env.NODE_ENV !== "development") return { products: [], today, error: "Deze preview is lokaal beschikbaar." };
  try {
    const bytes = await readFile(join(homedir(), "Downloads", "KERST 2025", "kerst final goed.xlsx"));
    const workbook = XLSX.read(bytes, { type: "buffer" });
    function lines(book: XLSX.WorkBook, sheetName: string, quantityHeader: string): WeeklySalesLine[] {
      const sheet = book.Sheets[sheetName];
      if (!sheet) throw new Error("Een verwacht verkooptabblad ontbreekt.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
      const headers = rows[0]?.map(value => String(value).replace(/\s+/g, " ").trim().toLowerCase()) || [];
      const quantityColumn = headers.indexOf(quantityHeader);
      if (headers[1] !== "artikelnummer" || headers[2] !== "subcode naam" || quantityColumn < 0) throw Error("De artikel-, subcode- of aantal-kolom ontbreekt.");
      return rows.slice(2).filter(row => typeof row[0] === "string" && row[0] !== "-").map(row => ({ name: String(row[0]).trim(), code: String(row[1] ?? "").trim(), variant: String(row[2] ?? ""), quantity: typeof row[quantityColumn] === "number" && Number.isFinite(row[quantityColumn]) ? row[quantityColumn] as number : null }));
    }
    const cash = lines(workbook, "cash it week 47tm53 uitgesplits", "aantal verkocht");
    const bake = lines(workbook, "bake it debiteuren 47tm53 uitge", "netto productie aantallen verkocht 2025");
    // The previous export supplies stable IDs and historical Cash-it names.
    // Its debtor quantities are replaced below by the delivery-date report.
    let products = buildSalesAssortment(cash, bake, articleCatalog, christmasProducts);
    let week52Error: string | undefined;
    try {
      const weeklyBytes = await readFile(join(homedir(), "Downloads", "KERST 2025", "week 52 kerst.xlsx"));
      const weekly = XLSX.read(weeklyBytes, { type: "buffer" });
      products = attachWeek52Sales(products, lines(weekly, "cash it week 52 kassa 2025", "aantal verkocht"), []);
    } catch {
      week52Error = "De week-52-Excel kon niet worden gelezen. Controleer week 52 kerst.xlsx.";
    }
    const debtorBytes = await readFile(join(homedir(), "Downloads", "KERST 2025", "debiteuren 2025.xls"));
    const debtors = XLSX.read(debtorBytes, { type: "buffer" });
    const report = (name: string) => {
      const sheet = debtors.Sheets[name];
      if (!sheet) throw Error(`Debiteurentabblad ontbreekt: ${name}`);
      return parseDebtorReport(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }));
    };
    const corrected = replaceDebtorSales(products, report("Bake it debiteuren wk 47 tm 53"), report("Week van Kerst"));
    return { products: corrected.products, today, ...(week52Error ? { week52Error } : {}) };
  } catch (error) {
    return { products: [], today, error: error instanceof Error && /kolom|[Dd]ebiteur|Week.52/.test(error.message) ? error.message : "De lokale verkoop-Excel kon niet worden gelezen. Controleer de map KERST 2025 in Downloads." };
  }
}
