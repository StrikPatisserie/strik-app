"use client";
import { useEffect, useState, useId, useRef } from "react";
import type { AddressLocation } from "./roadRouting";
export default function AddressSearch({ label, value, onChange, initial = "" }: {
    label: string;
    value?: AddressLocation;
    onChange: (location: AddressLocation | undefined) => void;
    initial?: string;
}) {
    const listId = useId(), selection = useRef<AbortController | null>(null);
    useEffect(() => () => selection.current?.abort(), []);
    const [query, setQuery] = useState(value?.label || initial), [suggestions, setSuggestions] = useState<{
        id: string;
        label: string;
    }[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
    useEffect(() => {
        if (value || query.trim().length < 3) {
            setSuggestions([]);
            return;
        }
        const controller = new AbortController(), timer = window.setTimeout(() => { setBusy(true); setError(""); fetch(`/api/bakkerij-logistiek/adres?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok)
            throw Error(data.message); if (!controller.signal.aborted)
            setSuggestions(data.suggestions); }).catch(error => { if (!controller.signal.aborted)
            setError(error.message || "Zoeken mislukt."); }).finally(() => { if (!controller.signal.aborted)
            setBusy(false); }); }, 400);
        return () => { controller.abort(); window.clearTimeout(timer); };
    }, [query, value]);
    async function select(id: string) {
        const controller = new AbortController();
        selection.current?.abort();
        selection.current = controller;
        setBusy(true);
        setError("");
        try {
            const response = await fetch(`/api/bakkerij-logistiek/adres?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal });
            const data = await response.json();
            if (!response.ok)
                throw Error(data.message);
            if (controller.signal.aborted)
                return;
            setQuery(data.location.label);
            setSuggestions([]);
            onChange(data.location);
        }
        catch (error) {
            if (!controller.signal.aborted)
                setError(error instanceof Error ? error.message : "Adres niet gevonden.");
        }
        finally {
            if (!controller.signal.aborted)
                setBusy(false);
        }
    }
    return <div className="relative"><label className="block text-xs font-semibold">{label}<input autoComplete="off" maxLength={200} value={query} onChange={event => { selection.current?.abort(); setBusy(false); setQuery(event.target.value); setSuggestions([]); onChange(undefined); }} placeholder="Straat, huisnummer en plaats" className="mt-1 min-h-10 w-full rounded-lg border border-[#bdcdb4] bg-white px-3 text-sm" role="combobox" aria-controls={listId} onKeyDown={event => { if (event.key === "ArrowDown") {
        event.preventDefault();
        document.getElementById(listId)?.querySelector<HTMLButtonElement>("button")?.focus();
    } if (event.key === "Escape")
        setSuggestions([]); }} aria-expanded={!!suggestions.length} aria-autocomplete="list"/></label>
  {busy && <p role="status" className="mt-1 text-xs text-[#65725e]">Adres zoeken…</p>}
  {suggestions.length > 0 && <ul id={listId} role="listbox" aria-label="Gevonden adressen" className="mt-1 overflow-hidden rounded-lg border border-[#bdcdb4] bg-white shadow-sm">{suggestions.map(item => <li role="presentation" key={item.id}><button role="option" aria-selected={false} type="button" className="w-full px-3 py-2 text-left text-xs hover:bg-[#edf3e7]" onClick={() => void select(item.id)}>{item.label}</button></li>)}</ul>}
  {value && <p className="mt-1 text-xs text-[#37614a]">✓ Adres herkend</p>}
  {error && <p role="status" className="mt-1 text-xs text-[#a23e2b]">{error}</p>}
 </div>;
}
