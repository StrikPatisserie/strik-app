import {
  type TemperaturePayload,
  type TemperatureRecord,
} from "./temperatureRegistrationShared";

const APP_TEMPERATURE_REGISTRATION_URL = "/api/temperature-registration";

type TemperatureApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function getErrorMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim()
  ) {
    return data.message;
  }

  return fallback;
}

async function fetchTemperatureRegistrationsFrom(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  const data = await readJson(response);

  if (response.ok && Array.isArray(data)) {
    return { ok: true as const, data: data as TemperatureRecord[] };
  }

  return {
    ok: false as const,
    message: getErrorMessage(
      data,
      "Temperatuurregistraties konden niet geladen worden."
    ),
  };
}

export async function fetchTemperatureRegistrations(): Promise<
  TemperatureApiResult<TemperatureRecord[]>
> {
  try {
    return await fetchTemperatureRegistrationsFrom(
      APP_TEMPERATURE_REGISTRATION_URL
    );
  } catch {
    return {
      ok: false,
      message: "Kan geen verbinding maken met WordPress temperatuuropslag.",
    };
  }
}

async function saveTemperatureRegistrationTo(
  url: string,
  payload: TemperaturePayload
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);

  if (response.ok) {
    return { ok: true as const, data: data as TemperatureRecord };
  }

  return {
    ok: false as const,
    message: getErrorMessage(
      data,
      "WordPress temperatuurroute is nog niet beschikbaar."
    ),
  };
}

export async function saveTemperatureRegistration(
  payload: TemperaturePayload
): Promise<TemperatureApiResult<TemperatureRecord>> {
  try {
    return await saveTemperatureRegistrationTo(
      APP_TEMPERATURE_REGISTRATION_URL,
      payload
    );
  } catch {
    return {
      ok: false,
      message: "Kan geen verbinding maken met WordPress temperatuuropslag.",
    };
  }
}
