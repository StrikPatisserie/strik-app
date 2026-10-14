// WordPress drops entirely empty rows. Keep the device inventory without inventing a reading.
const EMPTY_DEVICE_NOTE = "__strik_empty_temperature_device_v1__";

export function encodeTemperatureInventory(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.temperatuurRegistraties)) return payload;
  return { ...record, temperatuurRegistraties: record.temperatuurRegistraties.map((value) => {
    if (!value || typeof value !== "object") return value;
    const item = value as Record<string, unknown>;
    const hasContent = [item.displayTemperatuur, item.handTemperatuur, item.temperature, item.temperatuur, item.actionTaken, item.note].some((value) => typeof value === "string" && value.trim());
    return typeof item.naam === "string" && item.naam.trim() && !hasContent ? { ...item, note: EMPTY_DEVICE_NOTE } : item;
  }) };
}

export function decodeTemperatureInventory(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(decodeTemperatureInventory);
  if (!data || typeof data !== "object") return data;
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.temperatuurRegistraties)) return data;
  return { ...record, temperatuurRegistraties: record.temperatuurRegistraties.map((value) => {
    if (!value || typeof value !== "object") return value;
    const item = value as Record<string, unknown>;
    return item.note === EMPTY_DEVICE_NOTE ? { ...item, note: "" } : item;
  }) };
}
