import { useRef, useState } from "react";
import type { Ingredient, InvoiceImport, InvoiceLine } from "./types";
import { parseBekoInvoiceFile } from "./invoiceImportParser";
import PriceUpdateReview, { InvoiceSummary } from "./PriceUpdateReview";

export default function FactuurImport({
  invoice,
  ingredients,
  onApproveLine,
  onIgnoreLine,
  onIgnoreInvoice,
  onRevertInvoice,
  onDeleteInvoice,
  onMatchLine,
  onCreateIngredientFromLine,
  onImportInvoice,
}: Readonly<{
  invoice: InvoiceImport;
  ingredients: Ingredient[];
  onImportInvoice: (invoice: InvoiceImport) => void;
  onApproveLine: (invoiceId: string, line: InvoiceLine) => void;
  onIgnoreLine: (invoiceId: string, line: InvoiceLine) => void;
  onIgnoreInvoice: (invoiceId: string) => void;
  onRevertInvoice: (invoiceId: string) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onMatchLine: (
    invoiceId: string,
    line: InvoiceLine,
    ingredientId: string
  ) => void;
  onCreateIngredientFromLine: (
    invoiceId: string,
    line: InvoiceLine,
    options?: { forceNew?: boolean }
  ) => void;
}>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function handleSelectedFile(file?: File) {
    if (!file) return;

    setIsImporting(true);
    setUploadMessage(`${file.name} wordt geanalyseerd...`);
    const slowAnalysisTimer = window.setTimeout(() => {
      setUploadMessage(
        `${file.name} wordt nog gelezen met OCR. Gescande facturen kunnen 30-60 seconden duren.`
      );
    }, 8000);

    try {
      const result = await parseBekoInvoiceFile(file, ingredients);

      if (!result.ok) {
        setUploadMessage(result.message);
        return;
      }

      onImportInvoice(result.invoice);
      const warningText = result.warnings.length
        ? ` Let op: ${result.warnings.join(" ")}`
        : "";
      setUploadMessage(
        `${file.name} ingeladen: ${result.invoice.lines.length} regels, ${result.invoice.lines.filter((line) => line.matchedIngredientId).length} gekoppeld.${warningText}`
      );
    } catch {
      setUploadMessage("Factuur kon niet gelezen worden.");
    } finally {
      window.clearTimeout(slowAnalysisTimer);
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div>
          <p className="text-[0.7rem] font-black uppercase tracking-[0.14em] text-[#ef4b34]">
            Factuurimport
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-[#2d2a26]">
            Factuur inladen
          </h2>
          <p className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-[#2d2a26]/50">
            Upload Beko, Zeelandia, Sligro, Roelofsen, Fruit op Maat of Hefe.
            Alleen echte prijsverschillen blijven als actie open staan.
          </p>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleSelectedFile(event.dataTransfer.files?.[0]);
          }}
          className="rounded-xl border border-dashed border-[#cfdcc8] bg-[#f7faf5] px-3 py-2 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-black text-[#2d2a26]">
                Upload bestand
              </p>
              <p className="truncate text-[0.65rem] font-bold text-[#2d2a26]/45">
                PDF, Excel, CSV of foto
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.tif,.tiff"
              className="sr-only"
              onChange={(event) =>
                void handleSelectedFile(event.target.files?.[0])
              }
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="shrink-0 rounded-full bg-[#c3d3bc] px-3 py-1.5 text-xs font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? "Lezen..." : "Kies"}
            </button>
          </div>
        </div>
      </div>

      {uploadMessage && (
        <p className="rounded-xl border border-[#d7e4d3] bg-[#f7faf5] px-3 py-2 text-xs font-bold leading-relaxed text-[#45663b]">
          {uploadMessage}
        </p>
      )}

      <section className="sticky top-2 z-20 rounded-xl border border-[#ead7a6] bg-[#fff8e3] px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#7a5a18]/65">
              Herkende factuur
            </p>
            <p className="truncate text-xs font-black text-[#2d2a26]">
              {invoice.supplier} · {invoice.invoiceNumber || "zonder nummer"} ·{" "}
              {formatInvoiceDate(invoice.invoiceDate)}
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-2 py-1 text-[0.68rem] font-black text-[#7a5a18]">
            {invoice.lines.length} regels
          </span>
        </div>
        <div className="mt-2">
          <InvoiceSummary invoice={invoice} />
        </div>
      </section>

      <PriceUpdateReview
        invoice={invoice}
        ingredients={ingredients}
        onApproveLine={onApproveLine}
        onIgnoreLine={onIgnoreLine}
        onIgnoreInvoice={onIgnoreInvoice}
        onRevertInvoice={onRevertInvoice}
        onDeleteInvoice={onDeleteInvoice}
        onMatchLine={onMatchLine}
        onCreateIngredientFromLine={onCreateIngredientFromLine}
      />
    </div>
  );
}

function formatInvoiceDate(date: string) {
  if (!date) return "geen datum";
  return date;
}
