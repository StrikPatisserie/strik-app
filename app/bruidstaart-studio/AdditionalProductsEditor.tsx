"use client";

import { formatEuro } from "./pricing";
import type { DecorationSurcharge } from "./types";
import WeddingCakeMoneyInput, { parseWeddingCakeAmount } from "./WeddingCakeMoneyInput";

type Props = {
  value: DecorationSurcharge[];
  onChange: (products: DecorationSurcharge[]) => void;
};

export default function AdditionalProductsEditor({ value, onChange }: Props) {
  function update(id: string, changes: Partial<DecorationSurcharge>) {
    onChange(value.map((product) => product.id === id ? { ...product, ...changes } : product));
  }

  return (
    <section aria-labelledby="additional-products-title" className="rounded-2xl border border-[#d8e2d1] bg-[#f8faf6] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="additional-products-title" style={{ fontSize: "0.875rem" }} className="font-black text-[#304d2a]">Overige producten & toevoegingen</h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-[#2d2a26]/65">
            Losse producten of extra afspraken naast de bruidstaart. Vul per regel het totale bedrag in; dit telt mee op de bon en het betaalverzoek.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, { id: crypto.randomUUID(), description: "", amount: 0 }])}
          className="rounded-full border border-[#ccd9c4] bg-white px-3 py-2 text-xs font-black text-[#304d2a] shadow-sm"
        >
          + Product of toevoeging
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-3 space-y-3">
          {value.map((product, index) => (
            <div key={product.id} className="grid min-w-0 gap-2 rounded-xl border border-[#e7e0d8] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
              <label className="grid min-w-0 gap-1 text-xs font-bold text-[#2d2a26]/70">
                Omschrijving
                <input
                  aria-label={`Omschrijving extra product ${index + 1}`}
                  value={product.description}
                  onChange={(event) => update(product.id, { description: event.target.value })}
                  placeholder="Bijv. brownietaartje + red velvet taartje"
                  style={{ fontSize: "1rem" }}
                  className="min-w-0 rounded-xl border border-[#e7e0d8] p-2.5 text-sm font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-[#2d2a26]/70">
                Bedrag totaal
                <span className="relative block">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">€</span>
                  <WeddingCakeMoneyInput
                    aria-label={`Bedrag extra product ${index + 1}`}
                    value={product.amount}
                    onValueChange={(text) => update(product.id, { amount: parseWeddingCakeAmount(text) })}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-[#e7e0d8] p-2.5 pl-7 text-sm font-semibold text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  />
                </span>
              </label>
              <button
                type="button"
                aria-label={`Verwijder extra product ${index + 1}`}
                onClick={() => onChange(value.filter((item) => item.id !== product.id))}
                className="justify-self-end rounded-xl px-2 py-2.5 text-xs font-bold text-[#86504a] hover:bg-[#fbefec]"
              >Verwijderen</button>
            </div>
          ))}
          <p className="text-right text-xs font-bold text-[#304d2a]">
            Totaal toevoegingen: {formatEuro(value.reduce((total, product) => total + product.amount, 0))}
          </p>
        </div>
      )}
    </section>
  );
}
