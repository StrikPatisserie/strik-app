import { useRef, useState } from "react";
import type { Ingredient, InvoiceImport, InvoiceLine, Recipe } from "./types";
import { Panel, SectionTitle } from "./RecepturenShared";
import { parseBekoInvoiceFile } from "./invoiceImportParser";
import PriceUpdateReview, { InvoiceSummary } from "./PriceUpdateReview";

export default function FactuurImport({
  invoice,
  ingredients,
  recipes,
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
  recipes: Recipe[];
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
  onCreateIngredientFromLine: (invoiceId: string, line: InvoiceLine) => void;
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
        `${file.name} ingeladen: ${result.invoice.lines.length} regels, ${result.invoice.lines.filter((line) => line.matchedIngredientId).length} automatisch gekoppeld. Het bestand zelf is niet opgeslagen.${warningText}`
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
    <div className="grid gap-4">
      <Panel>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-center">
          <SectionTitle
            eyebrow="Factuurimport"
            title="Upload factuur of receptbestand"
            description="Beko, Zeelandia, Sligro, Roelofsen, Fruit op Maat en Hefe van Haag worden automatisch gelezen uit CSV, Excel, tekst-PDF of OCR."
          />
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleSelectedFile(event.dataTransfer.files?.[0]);
            }}
            className="rounded-[1.15rem] border-2 border-dashed border-[#cfdcc8] bg-[#f7faf5] p-5 text-center"
          >
            <p className="text-sm font-black">Sleep factuur hierheen</p>
            <p className="mt-1 text-xs font-bold text-[#2d2a26]/45">
              CSV, Excel, PDF of afbeelding · grote PDF wordt verkleind · bestand wordt niet bewaard
            </p>
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
              className="mt-4 rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
            >
              {isImporting ? "Inladen..." : "Bestand kiezen"}
            </button>
            {uploadMessage && (
              <p className="mt-3 text-xs font-bold leading-relaxed text-[#45663b]">
                {uploadMessage}
              </p>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Analyse"
          title="Herkende factuur"
          description="Na upload wordt de leverancier herkend en worden artikelen eerst ter controle aan ingredienten gekoppeld."
        />
        <div className="mt-4">
          <InvoiceSummary invoice={invoice} />
        </div>
      </Panel>

      <PriceUpdateReview
        invoice={invoice}
        ingredients={ingredients}
        recipes={recipes}
        onApproveLine={onApproveLine}
        onIgnoreLine={onIgnoreLine}
        onIgnoreInvoice={onIgnoreInvoice}
        onRevertInvoice={onRevertInvoice}
        onDeleteInvoice={onDeleteInvoice}
        onMatchLine={onMatchLine}
        onCreateIngredientFromLine={onCreateIngredientFromLine}
      />

      <Panel>
        <SectionTitle
          eyebrow="Lerende koppelingen"
          title="Meerdere namen, één ingredient"
          description="De app bewaart aliases zodat toekomstige facturen sneller gematcht worden."
        />
        <div className="mt-4 grid gap-2 lg:grid-cols-3">
          {["Debic Slagroom 35% 10L", "Room 35%", "Slagroom Debic"].map(
            (alias) => (
              <div
                key={alias}
                className="rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3"
              >
                <p className="text-sm font-black">{alias}</p>
                <p className="mt-1 text-xs font-bold text-[#2d2a26]/45">
                  gekoppeld aan Slagroom 35%
                </p>
              </div>
            )
          )}
        </div>
      </Panel>
    </div>
  );
}
