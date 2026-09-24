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
    <div className="mt-2 rounded-lg bg-white px-2 py-2 text-[#60190f] sm:mt-2.5 sm:rounded-xl sm:px-3 sm:py-2.5">
      <div className="flex items-center justify-between gap-1.5 text-[.56rem] font-bold sm:gap-3 sm:text-[.68rem]">
        <span>Prijs per stuk</span>
        <strong className="whitespace-nowrap text-xs sm:text-sm">{money(unitPrice)}</strong>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1.5 border-t border-[#eee0c4] pt-1 text-[.54rem] font-black sm:mt-1.5 sm:gap-3 sm:pt-1.5 sm:text-[.68rem]">
        <span>Totaalprijs · {quantity} st.</span>
        <strong className="whitespace-nowrap text-xs sm:text-sm">{money(totalPrice)}</strong>
      </div>
      <p className="mt-1 text-[.48rem] font-semibold leading-snug text-[#8c665d] sm:text-[.56rem]">
        ({pricingNote})
      </p>
    </div>
  );
}
