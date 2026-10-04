import type { LogisticsReceipt, LogisticsReceiptLine } from "./logisticsTypes";

export const specialSchoolDeliveryDate = "2026-10-05";
export const specialSchoolDeliveryRouteId = "school-route-2026-10-05-v2";
export const specialSchoolDeliveryVehicle = "Scholenroute";
export type SpecialDeliveryVehicle = "Bus A" | "Bus B" | "Scholenroute";

export type SpecialSchoolDeliveryStop = {
  id: string;
  name: string;
  address: string;
  postalCity: string;
  cakes: string[];
};

const listedSpecialSchoolDeliveryStops: SpecialSchoolDeliveryStop[] = [
  {
    id: "de-akker",
    name: "De Akker",
    address: "Akkerlaan 40/42",
    postalCity: "6533 BL Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Lemon pie",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "brakkenstein",
    name: "Brakkenstein",
    address: "Heyendaalseweg 235",
    postalCity: "6525 SG Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "het-kleurrijk",
    name: "Het Kleurrijk",
    address: "Thijmstraat 40C",
    postalCity: "6531 CS Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "de-hazesprong",
    name: "De Hazesprong",
    address: "Bisonstraat 3",
    postalCity: "6531 PT Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Lemon pie",
      "Appelfleurtje",
    ],
  },
  {
    id: "klein-heyendaal",
    name: "Klein Heyendaal",
    address: "Prof. Huyberstraat 1/3",
    postalCity: "6524 NP Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Lemon pie",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "de-kleine-wereld",
    name: "De Kleine Wereld",
    address: "Newtonstraat 50",
    postalCity: "6533 KG Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "montessori-nijmegen-oost",
    name: "Montessori Nijmegen-Oost",
    address: "Heyendaalseweg 6",
    postalCity: "6524 SL Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "kind-centrum-toon",
    name: "Kind Centrum TOON",
    address: "Symfoniestraat 210",
    postalCity: "6544 TN Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "petrus-canisius",
    name: "Petrus Canisius",
    address: "St. Stevenskerkhof 37/38",
    postalCity: "6511 VZ Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "sint-nicolaas",
    name: "Sint Nicolaas",
    address: "A. van Pinxterenlaan 4",
    postalCity: "6532 CW Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Lemon pie",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "de-sterredans",
    name: "De Sterredans",
    address: "Ubbergseveldweg 97/99",
    postalCity: "6522 HE Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Lemon pie",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "de-wieken",
    name: "De Wieken",
    address: "Floraweg 69",
    postalCity: "6542 KB Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "de-boomgaard",
    name: "De Boomgaard",
    address: "Titaanstraat 100",
    postalCity: "6663 PN Lent",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Aardbeivlaai",
      "Lemon pie",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "jenaplanschool-de-noorderstroom",
    name: "Jenaplanschool de Noorderstroom",
    address: "Griftdijk 93",
    postalCity: "6515 AE Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
  {
    id: "stichting-sint-josephscholen",
    name: "Stichting Sint Josephscholen · Bestuursbureau",
    address: "Kelfkensbos 38",
    postalCity: "6511 TB Nijmegen",
    cakes: [
      "Nijmeegse seizoensvlaai",
      "Hazelnoot schuim",
      "Appelfleurtje",
    ],
  },
];

const specialSchoolDeliveryRouteIds = [
  "jenaplanschool-de-noorderstroom",
  "de-boomgaard",
  "stichting-sint-josephscholen",
  "de-sterredans",
  "montessori-nijmegen-oost",
  "klein-heyendaal",
  "brakkenstein",
  "de-kleine-wereld",
  "sint-nicolaas",
  "de-akker",
  "de-hazesprong",
  "het-kleurrijk",
  "petrus-canisius",
  "de-wieken",
  "kind-centrum-toon",
] as const;

const specialSchoolDeliveryVehicleById: Record<
  (typeof specialSchoolDeliveryRouteIds)[number],
  SpecialDeliveryVehicle
> = {
  "jenaplanschool-de-noorderstroom": "Bus B",
  "de-boomgaard": "Bus B",
  "stichting-sint-josephscholen": "Scholenroute",
  "de-sterredans": "Scholenroute",
  "montessori-nijmegen-oost": "Bus A",
  "klein-heyendaal": "Bus A",
  brakkenstein: "Bus A",
  "de-kleine-wereld": "Scholenroute",
  "sint-nicolaas": "Scholenroute",
  "de-akker": "Scholenroute",
  "de-hazesprong": "Scholenroute",
  "het-kleurrijk": "Scholenroute",
  "petrus-canisius": "Scholenroute",
  "de-wieken": "Scholenroute",
  "kind-centrum-toon": "Scholenroute",
};

const specialSchoolDeliveryRouteIdsByVehicle: Record<
  SpecialDeliveryVehicle,
  readonly (typeof specialSchoolDeliveryRouteIds)[number][]
> = {
  "Bus A": [
    "brakkenstein",
    "klein-heyendaal",
    "montessori-nijmegen-oost",
  ],
  "Bus B": [
    "jenaplanschool-de-noorderstroom",
    "de-boomgaard",
  ],
  Scholenroute: [
    "de-wieken",
    "de-sterredans",
    "stichting-sint-josephscholen",
    "petrus-canisius",
    "het-kleurrijk",
    "de-hazesprong",
    "de-akker",
    "de-kleine-wereld",
    "sint-nicolaas",
    "kind-centrum-toon",
  ],
};

export const specialSchoolDeliveryStops = specialSchoolDeliveryRouteIds.map(
  (id) => {
    const stop = listedSpecialSchoolDeliveryStops.find((item) => item.id === id);
    if (!stop) throw new Error(`Schoolafleveradres ontbreekt: ${id}`);

    return {
      ...stop,
      vehicle: specialSchoolDeliveryVehicleById[id],
    };
  }
);

function normalizedCustomerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSpecialSchoolSourceReceipt(receipt: LogisticsReceipt) {
  if (receipt.tags.includes("st-josephschool-deelbon")) return false;

  const customer = normalizedCustomerName(receipt.customer);

  return (
    customer.includes("josephschool") ||
    customer.includes("josephscholen") ||
    (customer.includes("joseph") && customer.includes("school"))
  );
}

export function isSpecialSchoolChildReceipt(receipt: LogisticsReceipt) {
  return receipt.tags.includes("st-josephschool-deelbon");
}

export function specialSchoolDeliveryRouteIndex(receipt: LogisticsReceipt) {
  if (!isSpecialSchoolChildReceipt(receipt)) return -1;

  const stopId = receipt.id.replace(/^st-josephschool-/, "");
  return specialSchoolDeliveryRouteIds.indexOf(
    stopId as (typeof specialSchoolDeliveryRouteIds)[number]
  );
}

export function specialSchoolDeliveryVehicleForReceipt(
  receipt: LogisticsReceipt
): SpecialDeliveryVehicle | "" {
  if (!isSpecialSchoolChildReceipt(receipt)) return "";

  const stopId = receipt.id.replace(/^st-josephschool-/, "");
  return (
    specialSchoolDeliveryVehicleById[
      stopId as (typeof specialSchoolDeliveryRouteIds)[number]
    ] || ""
  );
}

export function specialSchoolDeliveryVehicleRouteIndex(
  receipt: LogisticsReceipt
) {
  if (!isSpecialSchoolChildReceipt(receipt)) return -1;

  const stopId = receipt.id.replace(/^st-josephschool-/, "") as (
    typeof specialSchoolDeliveryRouteIds
  )[number];
  const vehicle = specialSchoolDeliveryVehicleById[stopId];
  return vehicle
    ? specialSchoolDeliveryRouteIdsByVehicle[vehicle].indexOf(stopId)
    : -1;
}

function stopLines(
  stop: SpecialSchoolDeliveryStop,
  sourceReceipt?: LogisticsReceipt
): LogisticsReceiptLine[] {
  const sourceCardLine = sourceReceipt?.lines.find((line) =>
    /kaart|tekst|logo/i.test(`${line.description} ${line.note || ""}`)
  );

  return [
    ...stop.cakes.map((cake) => ({
      quantity: "1",
      description: cake,
    })),
    {
      articleNumber: sourceCardLine?.articleNumber,
      catalogArticleNumber: sourceCardLine?.catalogArticleNumber,
      quantity: "1",
      description:
        sourceCardLine?.description || "Kaart volgens hoofd-bon St Josephschool",
      note:
        sourceCardLine?.note || "Kaart bij deze schoollevering meenemen.",
    },
  ];
}

export function applySpecialSchoolDeliverySplit(
  receipts: LogisticsReceipt[],
  date: string
) {
  if (date !== specialSchoolDeliveryDate) return receipts;

  const sourceReceipt = receipts.find(isSpecialSchoolSourceReceipt);
  const receiptsWithoutSource = receipts.filter(
    (receipt) => !isSpecialSchoolSourceReceipt(receipt)
  );

  const childReceipts = specialSchoolDeliveryStops.map((stop, index) => {
    const childNumber = String(index + 1).padStart(2, "0");
    const deliveryAddress = `${stop.address}, ${stop.postalCity}`;
    const sourceReceiptNumber =
      sourceReceipt?.receiptNumber || sourceReceipt?.id || "ST-JOSEPH";

    return {
      id: `st-josephschool-${stop.id}`,
      receiptNumber: `${sourceReceiptNumber}-${childNumber}`,
      time: sourceReceipt?.time || "",
      customer: stop.name,
      address: deliveryAddress,
      deliveryAddress,
      fulfillment: "bezorgen" as const,
      route: stop.vehicle,
      tags: ["bezorgen", "st-josephschool-deelbon"],
      note: "Eenmalige schoollevering · gekoppeld aan hoofd-bon St Josephschool.",
      customerNote: [
        "Kaart van de hoofd-bon bij deze schoollevering meenemen.",
        sourceReceipt?.customerNote || "",
      ]
        .filter(Boolean)
        .join(" "),
      internalNote: [
        "Logistieke deelbon; niet opnieuw meetellen in omzet of productie.",
        sourceReceipt?.internalNote || "",
      ]
        .filter(Boolean)
        .join(" "),
      lines: stopLines(stop, sourceReceipt),
    } satisfies LogisticsReceipt;
  });

  return [...receiptsWithoutSource, ...childReceipts];
}

export function specialSchoolDeliveryCakeCount() {
  return specialSchoolDeliveryStops.reduce(
    (total, stop) => total + stop.cakes.length,
    0
  );
}
