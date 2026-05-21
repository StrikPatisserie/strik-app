import type { Ingredient, InvoiceImport, Recipe } from "./types";
import { Panel, SectionTitle } from "./RecepturenShared";
import PriceUpdateReview, { InvoiceSummary } from "./PriceUpdateReview";

export default function FactuurImport({
  invoice,
  ingredients,
  recipes,
}: Readonly<{
  invoice: InvoiceImport;
  ingredients: Ingredient[];
  recipes: Recipe[];
}>) {
  return (
    <div className="grid gap-4">
      <Panel>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-center">
          <SectionTitle
            eyebrow="Factuurimport"
            title="Upload PDF, CSV of Excel"
            description="Hier kunnen straks facturen van Beko, Zeelandia of Sligro worden ingelezen. De analyse hieronder is mockdata."
          />
          <div className="rounded-[1.15rem] border-2 border-dashed border-[#cfdcc8] bg-[#f7faf5] p-5 text-center">
            <p className="text-sm font-black">Sleep factuur hierheen</p>
            <p className="mt-1 text-xs font-bold text-[#2d2a26]/45">
              PDF, CSV of Excel · maximaal 20 MB
            </p>
            <button
              type="button"
              className="mt-4 rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
            >
              Bestand kiezen
            </button>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Analyse"
          title="Herkende factuur"
          description="Na upload wordt de leverancier herkend en worden artikelen aan ingredienten gekoppeld."
        />
        <div className="mt-4">
          <InvoiceSummary invoice={invoice} />
        </div>
      </Panel>

      <PriceUpdateReview
        invoice={invoice}
        ingredients={ingredients}
        recipes={recipes}
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
