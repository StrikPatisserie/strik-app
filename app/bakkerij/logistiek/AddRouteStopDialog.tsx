"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AddressSearch from "./AddressSearch";
import { routeFingerprint, type AddressLocation, type RoadRoute, type RoadStop, type SmartStopInsertion } from "./roadRouting";
type Stop = {
    id: string;
    label: string;
    detail: string;
    learningTarget?: string;
    location?: AddressLocation;
};
type Suggestion = {
    index: number;
    extraMinutes: number;
    lateStops: number;
    returnMinute: number;
};
const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export default function AddRouteStopDialog({ route, departureMinute, stops, onAdd, onClose }: {
    route: {
        id: string;
        title: string;
        stops: Stop[];
    };
    departureMinute: number;
    stops: RoadStop[];
    onAdd: (label: string, detail: string, insertion?: SmartStopInsertion) => boolean | void;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null), requestRef = useRef<AbortController | null>(null);
    const [label, setLabel] = useState(""), [location, setLocation] = useState<AddressLocation>(), [note, setNote] = useState(""), [service, setService] = useState(5), [deadline, setDeadline] = useState("");
    const [resolved, setResolved] = useState<Record<string, AddressLocation>>({}), [missing, setMissing] = useState<{
        id: string;
        label: string;
        query: string;
    }[]>([]), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
    const [proposal, setProposal] = useState<{
        suggestion: Suggestion;
        road: RoadRoute;
        location: AddressLocation;
        snapshot: string;
        serviceMinutes: number;
    } | null>(null);
    useEffect(() => { dialog.current?.showModal(); return () => requestRef.current?.abort(); }, []);
    const detail = location ? [deadline ? `voor ${deadline}` : "", location.label, note.trim()].filter(Boolean).join(" · ") : "";
    async function calculate() {
        if (!location || !label.trim())
            return;
        const controller = new AbortController();
        requestRef.current?.abort();
        requestRef.current = controller;
        setBusy(true);
        setStatus("Adressen controleren en rijtijden berekenen…");
        setProposal(null);
        try {
            const deadlineMinute = deadline ? Number(deadline.slice(0, 2)) * 60 + Number(deadline.slice(3)) : undefined;
            const body = { location, departureMinute, serviceMinutes: service, deadlineMinute, stops: stops.map(stop => ({ ...stop, location: resolved[stop.id] || stop.location })) };
            const response = await fetch("/api/bakkerij-logistiek/route-insertion", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok)
                throw Error(data.message);
            if (data.needsAddresses) {
                setMissing(data.needsAddresses);
                setStatus("Controleer eerst deze bestaande stopadressen. We kiezen geen adres op goed geluk.");
                return;
            }
            setMissing([]);
            setProposal({ ...data, snapshot: routeFingerprint(route.stops), serviceMinutes: service });
            setStatus("");
        }
        catch (error) {
            if (!controller.signal.aborted)
                setStatus(error instanceof Error ? error.message : "Berekenen mislukt. Er is niets gewijzigd.");
        }
        finally {
            if (!controller.signal.aborted)
                setBusy(false);
        }
    }
    function add(smart: boolean) {
        if (!location || !label.trim())
            return;
        if (smart && !proposal)
            return;
        const insertion = smart && proposal ? { index: proposal.suggestion.index, snapshot: proposal.snapshot, location: proposal.location, road: proposal.road, serviceMinutes: proposal.serviceMinutes } : { index: route.stops.length, snapshot: routeFingerprint(route.stops), location, serviceMinutes: service };
        if (onAdd(label.trim(), detail, insertion) === false) {
            setProposal(null);
            setStatus("De route is intussen gewijzigd. Bereken opnieuw.");
            return;
        }
        onClose();
    }
    const field = "min-h-10 rounded-lg border border-[#bdcdb4] bg-white px-3 text-sm";
    return createPortal(<dialog ref={dialog} onClose={onClose} aria-labelledby="new-route-stop-title" className="m-auto max-h-[90dvh] w-[min(34rem,calc(100%_-_24px))] overflow-auto rounded-2xl border border-[#bdcdb4] bg-[#fffaf4] p-5 text-[#49342d] shadow-xl backdrop:bg-black/30">
  <header className="mb-4 flex items-center justify-between gap-4"><div><h2 id="new-route-stop-title" className="text-lg font-bold">Stop toevoegen</h2><p className="text-xs text-[#65725e]">{route.title}</p></div><button type="button" aria-label="Sluiten" onClick={onClose} className="size-9 rounded-full bg-white">×</button></header>
  <fieldset disabled={busy} className="grid gap-3"><label className="grid gap-1 text-xs font-semibold">Stopnaam<input value={label} maxLength={150} onChange={event => setLabel(event.target.value)} className={field} placeholder="Bijvoorbeeld Gasterij de Arend"/></label>
  <AddressSearch label="Afleveradres" value={location} onChange={next => { setLocation(next); setProposal(null); }}/>
  <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-semibold">Tijd op locatie (min)<input type="number" min="0" max="90" value={service} onChange={event => { setService(Number(event.target.value)); setProposal(null); }} className={field}/></label><label className="grid gap-1 text-xs font-semibold">Uiterlijk aankomen · optioneel<input type="time" value={deadline} onChange={event => { setDeadline(event.target.value); setProposal(null); }} className={field}/></label></div>
  <label className="grid gap-1 text-xs font-semibold">Opmerking · optioneel<input maxLength={150} value={note} onChange={event => setNote(event.target.value)} className={field}/></label>
  {missing.map(stop => <div key={stop.id} className="rounded-xl border border-[#e0cdb4] bg-white p-3"><AddressSearch label={`Adres controleren · ${stop.label}`} initial={stop.query} value={resolved[stop.id]} onChange={next => { setResolved(current => { const updated = { ...current }; if (next)
        updated[stop.id] = next;
    else
        delete updated[stop.id]; return updated; }); setProposal(null); }}/></div>)}
  <button type="button" disabled={busy || !location || !label.trim()} onClick={() => void calculate()} className="rounded-xl bg-[#2d503c] px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{busy ? "Berekenen…" : "Bereken beste plek"}</button>
  {status && <p role="status" className="text-xs">{status}</p>}
  {proposal && <section className="rounded-xl border border-[#bdcdb4] bg-[#edf3e7] p-4 text-sm"><strong>{proposal.suggestion.index === 0 ? "Aan het begin" : `Na ${route.stops[proposal.suggestion.index - 1]?.label || "de vorige stop"}`}</strong><p className="mt-1">{proposal.suggestion.extraMinutes >= 0 ? "+" : ""}{proposal.suggestion.extraMinutes} minuten inclusief stoptijd · terug rond {clock(proposal.suggestion.returnMinute)}</p>{proposal.suggestion.lateStops > 0 && <p className="mt-2 font-semibold text-[#a23e2b]">Let op: {proposal.suggestion.lateStops} stop(s) na de opgegeven levertijd. Controleer de planning.</p>}<button type="button" onClick={() => add(true)} className="mt-3 rounded-lg bg-[#2d503c] px-4 py-2 font-bold text-white">Op deze plek toevoegen</button></section>}
  {!busy && !proposal && location && label.trim() && <button type="button" className="text-left text-xs underline text-[#65725e]" onClick={() => add(false)}>Zonder berekening achteraan toevoegen</button>}
  <p className="text-[10px] text-[#65725e]">Adressen: PDOK · Rijtijden: OSRM / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> · zonder actuele files · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer" className="underline">Kaart verbeteren</a></p>
  </fieldset>
 </dialog>, document.body);
}
