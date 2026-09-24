function money(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function readableTierRange(label: string) {
  if (label.startsWith(">")) return `meer dan ${label.slice(1)}`;
  if (label.startsWith("<")) return `minder dan ${label.slice(1)}`;
  return label;
}

export default function B2BPriceSummary({
  unitPrice,
  quantity,
  totalPrice,
  tierLabel,
  discountPercent = 0,
  fixedOffer = false,
}: Readonly<{
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  tierLabel: string;
  discountPercent?: number;
  fixedOffer?: boolean;
}>) {
  const pricingNote = fixedOffer
    ? `Inclusief ${discountPercent}% vaste korting`
    : quantity <= 0
      ? "Kies een aantal voor de juiste staffelprijs"
      : discountPercent > 0
        ? `Inclusief ${discountPercent}% staffelkorting bij ${readableTierRange(tierLabel)} stuks`
        : `Winkelprijs bij ${readableTierRange(tierLabel)} stuks`;

  return (
    <div className="mt-2.5 rounded-xl bg-white px-3 py-2.5 text-[#60190f]">
      <div className="flex items-center justify-between gap-3 text-[.68rem] font-bold">
        <span>Prijs per stuk</span>
        <strong className="whitespace-nowrap text-sm">{money(unitPrice)}</strong>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-[#eee0c4] pt-1.5 text-[.68rem] font-black">
        <span>Totaalprijs · {quantity} st.</span>
        <strong className="whitespace-nowrap text-sm">{money(totalPrice)}</strong>
      </div>
      <p className="mt-1 text-[.56rem] font-semibold leading-snug text-[#8c665d]">
        ({pricingNote})
      </p>
    </div>
  );
}
