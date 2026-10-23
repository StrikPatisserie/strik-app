import { getTemperatureDeviceName, type TemperatureDeviceConfig } from "./temperatureRegistrationShared";

export type InventoryChange = {
  deviceId: string;
  effectiveFrom: string;
  device: Exclude<TemperatureDeviceConfig, string> | null;
};

export function configuredDeviceId(location: string, device: TemperatureDeviceConfig, index: number) {
  return typeof device !== "string" && device.id ? device.id : `${location.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${index + 1}`;
}

export function configuredDevicesForDate(devices: TemperatureDeviceConfig[], date: string, location: string) {
  return devices.map((device, index) => ({
    ...(typeof device === "string" ? { name: device } : device),
    id: configuredDeviceId(location, device, index),
  })).filter((device) => (!device.activeFrom || device.activeFrom <= date) && (!device.activeUntil || date < device.activeUntil));
}

export function inventoryForDate(defaults: TemperatureDeviceConfig[], changes: InventoryChange[], date: string, location: string) {
  const devices = new Map(configuredDevicesForDate(defaults, date, location).map((device) => [device.id, device]));
  for (const change of [...changes].filter((item) => item.effectiveFrom <= date).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))) {
    if (change.device) devices.set(change.deviceId, { ...change.device, id: change.deviceId });
    else devices.delete(change.deviceId);
  }
  return [...devices.values()];
}

export function isConfiguredDevice(item: { id: string; naam: string }, devices: TemperatureDeviceConfig[], location: string) {
  return devices.some((device, index) => configuredDeviceId(location, device, index) === item.id || getTemperatureDeviceName(device).trim().toLowerCase() === item.naam.trim().toLowerCase());
}
