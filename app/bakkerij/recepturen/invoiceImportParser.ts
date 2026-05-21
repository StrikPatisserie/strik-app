import type { Ingredient, InvoiceImport } from "./types";

type ParsedInvoiceResult =
  | { ok: true; invoice: InvoiceImport; warnings: string[] }
  | { ok: false; message: string };

export async function parseBekoInvoiceFile(
  file: File,
  ingredients: Ingredient[]
): Promise<ParsedInvoiceResult> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("ingredients", JSON.stringify(ingredients));

  const response = await fetch("/api/recepturen/import", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json().catch(() => null)) as
    | {
        invoice?: InvoiceImport;
        warnings?: string[];
        message?: string;
      }
    | null;

  if (!response.ok || !data?.invoice) {
    return {
      ok: false,
      message: data?.message || "Factuur kon niet gelezen worden.",
    };
  }

  return {
    ok: true,
    invoice: data.invoice,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}
