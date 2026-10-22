// Only the public Sint folder may initialise this browser pixel.
export const B2B_PIXEL_ID = "414315228936451";
export const B2B_QUOTE_EVENT = "B2BSintQuoteSubmitted";
export const B2B_CONSENT_KEY = "strik-b2b-marketing-v1";
const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: Pixel;
  loaded?: boolean;
  version?: string;
};
type PixelWindow = Window & { fbq?: Pixel; _fbq?: Pixel };
let allowed = false;
let initialised = false;
const sent = new Set<string>();

export function readB2BConsent(): "granted" | "denied" | null {
  try {
    const value = JSON.parse(localStorage.getItem(B2B_CONSENT_KEY) || "null");
    if (!value || !["granted", "denied"].includes(value.choice) || typeof value.at !== "number" || value.at > Date.now() || Date.now() - value.at > CONSENT_MAX_AGE) return null;
    return value.choice;
  } catch { return null; }
}

export function setB2BConsent(choice: "granted" | "denied") {
  try { localStorage.setItem(B2B_CONSENT_KEY, JSON.stringify({ choice, at: Date.now() })); } catch { /* Choice still works for this page when storage is unavailable. */ }
  applyB2BConsent(choice === "granted");
}

export function applyB2BConsent(grant: boolean) {
  if (typeof window === "undefined") return;
  const target = window as PixelWindow;
  allowed = grant && window.location.pathname === "/sint-voor-bedrijven";
  if (!allowed) {
    // A withdrawal before the library loads must also discard queued events.
    if (target.fbq) {
      target.fbq.queue = target.fbq.queue.filter(args => !String(args[0]).startsWith("track"));
      target.fbq("consent", "revoke");
    }
    return;
  }
  if (!target.fbq) {
    const pixel: Pixel = Object.assign(function (...args: unknown[]) {
      if (pixel.callMethod) pixel.callMethod(...args);
      else pixel.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
    pixel.push = pixel;
    target.fbq = pixel;
    target._fbq = pixel;
  }
  const pixel = target.fbq;
  pixel("consent", "grant");
  if (!initialised) {
    // No automatic form/button events or advanced matching of contact details.
    pixel("set", "autoConfig", false, B2B_PIXEL_ID);
    pixel("init", B2B_PIXEL_ID);
    initialised = true;
    const script = document.createElement("script");
    script.id = "strik-b2b-meta-pixel";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
}

export function trackB2BQuoteSubmitted(requestId: string) {
  try {
    if (!allowed || typeof window === "undefined" || window.location.pathname !== "/sint-voor-bedrijven" || !/^[a-f0-9-]{36}$/i.test(requestId)) return;
    const key = `strik-b2b-meta-sent:${requestId}`;
    if (sent.has(requestId)) return;
    try { if (sessionStorage.getItem(key)) return; } catch { /* In-memory deduplication remains available. */ }
    const pixel = (window as PixelWindow).fbq;
    if (!pixel) return;
    pixel("trackSingleCustom", B2B_PIXEL_ID, B2B_QUOTE_EVENT, { folder: "sint", audience: "business" }, { eventID: requestId });
    sent.add(requestId);
    try { sessionStorage.setItem(key, "1"); } catch { /* Tracking never blocks a successful quote. */ }
  } catch { /* A blocked or failing marketing script must not change the quote result. */ }
}
