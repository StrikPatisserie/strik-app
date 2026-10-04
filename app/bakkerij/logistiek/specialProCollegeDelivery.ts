import type { LogisticsReceipt, LogisticsReceiptLine } from "./logisticsTypes";
import type { SpecialDeliveryVehicle } from "./specialSchoolDelivery";

export const specialProCollegeDeliveryDate = "2026-10-05";

export type SpecialProCollegeDeliveryStop = {
  id: string;
  name: string;
  address: string;
  postalCity: string;
  quantity: number;
  vehicle: SpecialDeliveryVehicle;
  round: 1 | 2;
};

export const specialProCollegeDeliveryStops: SpecialProCollegeDeliveryStop[] = [
  {
    id: "bemmel",
    name: "Pro College Bemmel",
    address: "Sportlaan 1k",
    postalCity: "6681 CD Bemmel",
    quantity: 26,
    vehicle: "Bus B",
    round: 1,
  },
  {
    id: "boxmeer",
    name: "Pro College Boxmeer",
    address: "Stationsweg 38b",
    postalCity: "5831 CR Boxmeer",
    quantity: 36,
    vehicle: "Bus B",
    round: 2,
  },
  {
    id: "wijchen",
    name: "Pro College Wijchen",
    address: "Acaciastraat 68",
    postalCity: "6602 EN Wijchen",
    quantity: 42,
    vehicle: "Scholenroute",
    round: 1,
  },
  {
    id: "nijmegen",
    name: "Pro College Nijmegen",
    address: "Dennenstraat 21",
    postalCity: "6543 JP Nijmegen",
    quantity: 67,
    vehicle: "Bus A",
    round: 1,
  },
];

function normalizedCustomerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSpecialProCollegeSourceReceipt(receipt: LogisticsReceipt) {
  if (receipt.tags.includes("pro-college-deelbon")) return false;
  return normalizedCustomerName(receipt.customer).includes("pro college");
}

export function isSpecialProCollegeChildReceipt(receipt: LogisticsReceipt) {
  return receipt.tags.includes("pro-college-deelbon");
}

function stopForReceipt(receipt: LogisticsReceipt) {
  if (!isSpecialProCollegeChildReceipt(receipt)) return null;
  const stopId = receipt.id.replace(/^pro-college-/, "");
  return (
    specialProCollegeDeliveryStops.find((stop) => stop.id === stopId) || null
  );
}

export function specialProCollegeVehicleForReceipt(receipt: LogisticsReceipt) {
  return stopForReceipt(receipt)?.vehicle || "";
}

export function specialProCollegeRoundForReceipt(receipt: LogisticsReceipt) {
  return stopForReceipt(receipt)?.round || 1;
}

export function specialProCollegeRouteIndex(receipt: LogisticsReceipt) {
  const stop = stopForReceipt(receipt);
  return stop ? specialProCollegeDeliveryStops.indexOf(stop) : -1;
}

function stopLines(
  stop: SpecialProCollegeDeliveryStop,
  sourceReceipt?: LogisticsReceipt
): LogisticsReceiptLine[] {
  const sourcePetitGateauLine = sourceReceipt?.lines.find((line) =>
    /petit\s*gateau|gateau\s*gebak/i.test(
      `${line.description} ${line.note || ""}`
    )
  );

  return [
    {
      articleNumber: sourcePetitGateauLine?.articleNumber,
      catalogArticleNumber: sourcePetitGateauLine?.catalogArticleNumber,
      quantity: String(stop.quantity),
      description: "Petit gateau gebakjes",
      note: `${stop.quantity} stuks voor ${stop.name}`,
    },
  ];
}

export function applySpecialProCollegeDeliverySplit(
  receipts: LogisticsReceipt[],
  date: string
) {
  if (date !== specialProCollegeDeliveryDate) return receipts;

  const sourceReceipt = receipts.find(isSpecialProCollegeSourceReceipt);
  const receiptsWithoutSource = receipts.filter(
    (receipt) => !isSpecialProCollegeSourceReceipt(receipt)
  );
  const sourceReceiptNumber =
    sourceReceipt?.receiptNumber || sourceReceipt?.id || "PRO-COLLEGE";

  const childReceipts = specialProCollegeDeliveryStops.map((stop, index) => ({
    id: `pro-college-${stop.id}`,
    receiptNumber: `${sourceReceiptNumber}-PC-${String(index + 1).padStart(2, "0")}`,
    time: "",
    customer: stop.name,
    address: `${stop.address}, ${stop.postalCity}`,
    deliveryAddress: `${stop.address}, ${stop.postalCity}`,
    fulfillment: "bezorgen" as const,
    route: stop.vehicle,
    tags: ["bezorgen", "pro-college-deelbon", "petit-gateau"],
    note: "Eenmalige Pro College-deellevering.",
    customerNote: `${stop.quantity} petit gateau gebakjes afleveren.`,
    internalNote: [
      "Logistieke deelbon; niet opnieuw meetellen in omzet of productie.",
      sourceReceipt?.internalNote || "",
    ]
      .filter(Boolean)
      .join(" "),
    lines: stopLines(stop, sourceReceipt),
  })) satisfies LogisticsReceipt[];

  return [...receiptsWithoutSource, ...childReceipts];
}

export function specialProCollegeDeliveryPieceCount() {
  return specialProCollegeDeliveryStops.reduce(
    (total, stop) => total + stop.quantity,
    0
  );
}
