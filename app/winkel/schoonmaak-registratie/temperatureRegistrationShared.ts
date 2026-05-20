export const winkelOptions = [
  { id: "ziekerstraat", label: "Ziekerstraat" },
  { id: "heyendaal", label: "Heyendaal" },
  { id: "daalseweg", label: "Daalseweg" },
  { id: "lent", label: "Lent" },
] as const;

export type WinkelId = (typeof winkelOptions)[number]["id"];

export type TemperatureDeviceType = "koeling" | "vriezer";

export type TemperatureStatus =
  | "ok"
  | "attention"
  | "deviation"
  | "missing";

export type TemperatureRegistration = {
  id: string;
  naam: string;
  displayTemperatuur: string;
  handTemperatuur: string;
  temperatuur?: string;
  temperature?: string;
  deviceType?: TemperatureDeviceType;
  status?: TemperatureStatus;
  actionTaken?: string;
  note?: string;
};

export type TemperaturePayload = {
  winkel: string;
  datum: string;
  naam: string;
  opmerking: string;
  temperatuurRegistraties: TemperatureRegistration[];
  createdAt?: string;
  updatedAt?: string;
};

export type TemperatureRecord = TemperaturePayload & {
  id?: number | string;
};

export const deviceTypeOptions: {
  id: TemperatureDeviceType;
  label: string;
}[] = [
  { id: "koeling", label: "Koeling" },
  { id: "vriezer", label: "Vriezer" },
];

export const temperatureRowsByWinkel: Record<WinkelId, string[]> = {
  heyendaal: [
    "zelfbedienings vriezer winkel",
    "zelfbedieningskoeling winkel",
    "gebaksvitrine winkel",
    "vrieskast chocohok links",
    "vrieskast chocohok rechts",
    "vriezer coma kasten gang",
    "koelcel gebak achter",
  ],
  ziekerstraat: [
    "zelfbedienings vriezer winkel",
    "zelfbedieningskoeling winkel",
    "gebaksvitrine winkel",
    "koelkast keuken",
    "vriescel gang",
    "koelcel gang",
    "koelwerkbank achter",
    "vrieskast enkel achter",
    "vrieskast dubbel achter",
  ],
  daalseweg: [
    "zelfbedienings vriezer winkel",
    "zelfbedieningskoeling winkel",
    "gebaksvitrine winkel",
    "vriescel achter",
    "koelcel achter",
    "vrieskast ijs",
    "vrieskast achter",
  ],
  lent: [
    "zelfbedienings vriezer winkel",
    "zelfbedieningskoeling winkel",
    "gebaksvitrine winkel",
    "vrieskast ijs achter",
    "vriescel achter",
    "koelcen achter",
    "koelwerkbank achter",
  ],
};

export const monthOptions = [
  { value: 0, label: "Januari" },
  { value: 1, label: "Februari" },
  { value: 2, label: "Maart" },
  { value: 3, label: "April" },
  { value: 4, label: "Mei" },
  { value: 5, label: "Juni" },
  { value: 6, label: "Juli" },
  { value: 7, label: "Augustus" },
  { value: 8, label: "September" },
  { value: 9, label: "Oktober" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

export function isWinkelId(value: string): value is WinkelId {
  return winkelOptions.some((winkel) => winkel.id === value);
}

export function getWinkelLabel(winkelId: string) {
  return winkelOptions.find((winkel) => winkel.id === winkelId)?.label || winkelId;
}

export function normalizeDeviceName(value: string) {
  return value.trim().toLocaleLowerCase("nl-NL").replace(/\s+/g, " ");
}

export function inferDeviceType(name: string): TemperatureDeviceType {
  const normalized = normalizeDeviceName(name);

  if (
    normalized.includes("vries") ||
    normalized.includes("vriezer") ||
    normalized.includes("freezer")
  ) {
    return "vriezer";
  }

  return "koeling";
}

export function normalizeTemperatureDeviceType(
  deviceType: string | undefined,
  name = ""
): TemperatureDeviceType {
  return deviceType === "vriezer" || deviceType === "koeling"
    ? deviceType
    : inferDeviceType(name);
}

export function getDeviceTypeLabel(deviceType?: string) {
  return deviceType === "vriezer" ? "Vriezer" : "Koeling";
}

export function parseTemperatureValue(value?: string) {
  if (!value) return undefined;

  const normalized = value
    .trim()
    .replace("−", "-")
    .replace(",", ".")
    .replace(/[^\d.+-]/g, "");
  const number = Number.parseFloat(normalized);

  return Number.isFinite(number) ? number : undefined;
}

export function getMeasuredTemperature(
  registration: Pick<
    TemperatureRegistration,
    "handTemperatuur" | "displayTemperatuur" | "temperature" | "temperatuur"
  >
) {
  return (
    registration.handTemperatuur?.trim() ||
    registration.temperature?.trim() ||
    registration.temperatuur?.trim() ||
    registration.displayTemperatuur?.trim() ||
    ""
  );
}

export function evaluateTemperature(
  deviceType: TemperatureDeviceType,
  value?: string
): {
  status: TemperatureStatus;
  label: string;
  shortLabel: string;
  actionRequired: boolean;
  actionHint: string;
} {
  const temperature = parseTemperatureValue(value);

  if (temperature === undefined) {
    return {
      status: "missing",
      label: "Ontbrekende meting",
      shortLabel: "Ontbreekt",
      actionRequired: false,
      actionHint: "",
    };
  }

  if (deviceType === "vriezer") {
    if (temperature <= -18) {
      return okEvaluation();
    }

    if (temperature <= -15) {
      return attentionEvaluation();
    }

    return deviationEvaluation();
  }

  if (temperature <= 7) {
    return okEvaluation();
  }

  if (temperature <= 8) {
    return attentionEvaluation();
  }

  return deviationEvaluation();
}

export function isActionRequiredStatus(status: TemperatureStatus) {
  return status === "attention" || status === "deviation";
}

export function isAttentionOrDeviationStatus(status: TemperatureStatus) {
  return status === "attention" || status === "deviation";
}

function okEvaluation() {
  return {
    status: "ok" as const,
    label: "Akkoord",
    shortLabel: "Groen",
    actionRequired: false,
    actionHint: "",
  };
}

function attentionEvaluation() {
  return {
    status: "attention" as const,
    label: "Aandacht - opnieuw meten",
    shortLabel: "Oranje",
    actionRequired: true,
    actionHint:
      "Na 15-30 minuten opnieuw meten en noteren waarom de temperatuur tijdelijk afwijkt.",
  };
}

function deviationEvaluation() {
  return {
    status: "deviation" as const,
    label: "Afwijking - actie verplicht",
    shortLabel: "Rood",
    actionRequired: true,
    actionHint:
      "Producten beoordelen/verplaatsen, leidinggevende of monteur inschakelen en bij twijfel blokkeren of weggooien.",
  };
}
