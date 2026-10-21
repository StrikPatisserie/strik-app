import type { ProductionSource } from "./productionSources";

export default function ProductionSourceIcon({ source }: { source: ProductionSource }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {source === "winkel" ? <><path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M3 10c0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0M9 20v-6h6v6"/></>
    : source === "online" ? <><rect x="5" y="4" width="14" height="12" rx="1"/><path d="M3 20h18l-2-4H5l-2 4Z"/><path d="M10 9h4m-2-2v4"/></>
    : source === "b2b" ? <><rect x="4" y="6" width="16" height="14" rx="1"/><path d="M9 6V3h6v3M8 10h1m6 0h1M8 14h1m6 0h1M10 20v-3h4v3"/></>
    : source === "voorraad" ? <><path d="M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5l9 4v4"/></>
    : <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/></>}
  </svg>;
}
