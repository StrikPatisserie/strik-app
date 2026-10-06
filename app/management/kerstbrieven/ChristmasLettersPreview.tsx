"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ChristmasLetterEmployee,
  ChristmasLetterStage,
} from "./christmasLettersTypes";

type LetterTab = "notities" | "vorige" | "concept" | "controle";
type RosterFilter = "active" | "inactive" | "all";

type ChristmasLettersResponse = {
  year: number;
  employees: ChristmasLetterEmployee[];
  stats: {
    total: number;
    active: number;
    inactive: number;
    withNotes: number;
    definitive: number;
  };
  storageAvailable: boolean;
  tamigoAvailable: boolean;
  tamigoMessage: string;
};

const statusStyles: Record<ChristmasLetterStage, string> = {
  "Notities nodig": "bg-[#fff3d6] text-[#8a5a00]",
  "Notities compleet": "bg-[#e7f0e3] text-[#315b39]",
  "Concept klaar": "bg-[#eee5ea] text-[#704b60]",
  Controleren: "bg-[#fbe5df] text-[#9b392d]",
  Definitief: "bg-[#dcebd8] text-[#225c31]",
};

const emptyEmployee: ChristmasLetterEmployee = {
  id: "",
  name: "Medewerkers laden…",
  initials: "",
  email: "",
  role: "",
  location: "",
  source: "manual",
  currentlyActive: false,
  activeForLetters: false,
  status: "Notities nodig",
  notes: [],
  noteCount: 0,
  previousYears: [],
};

function MiniIcon({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-black shadow-sm">
      {children}
    </span>
  );
}

export default function ChristmasLettersPreview() {
  const [employees, setEmployees] = useState<ChristmasLetterEmployee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<LetterTab>("notities");
  const [query, setQuery] = useState("");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("active");
  const [year, setYear] = useState(new Date().getFullYear());
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    role: "",
    location: "",
    email: "",
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    withNotes: 0,
    definitive: 0,
  });
  const [storageAvailable, setStorageAvailable] = useState(true);

  function applyResponse(data: ChristmasLettersResponse) {
    setEmployees(data.employees);
    setStats(data.stats);
    setStorageAvailable(data.storageAvailable);
    setSelectedId((current) => {
      if (current && data.employees.some((employee) => employee.id === current)) {
        return current;
      }
      return (
        data.employees.find((employee) => employee.activeForLetters)?.id ||
        data.employees[0]?.id ||
        ""
      );
    });
    if (!data.tamigoAvailable) {
      setMessage(data.tamigoMessage || "Tamigo is tijdelijk niet beschikbaar.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage("");

    fetch(`/api/christmas-letters?year=${year}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as ChristmasLettersResponse & {
          message?: string;
        };
        if (!response.ok) throw new Error(data.message || "Medewerkers ophalen is mislukt.");
        if (!cancelled) applyResponse(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Medewerkers ophalen is mislukt.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedId) ||
    employees[0] ||
    emptyEmployee;
  const notes = selectedEmployee.notes;
  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (rosterFilter === "active" && !employee.activeForLetters) return false;
      if (rosterFilter === "inactive" && employee.activeForLetters) return false;
      if (!normalizedQuery) return true;

      return `${employee.name} ${employee.role} ${employee.location}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [employees, query, rosterFilter]);

  const tabLabels: Array<{ id: LetterTab; label: string; count?: number }> = [
    { id: "notities", label: `Notities ${year}`, count: selectedEmployee.noteCount },
    { id: "vorige", label: "Vorige brieven", count: selectedEmployee.previousYears.length },
    { id: "concept", label: "Concept" },
    { id: "controle", label: "Controle", count: 2 },
  ];

  async function performAction(payload: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/christmas-letters?year=${year}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ChristmasLettersResponse & {
        message?: string;
      };
      if (!response.ok) throw new Error(data.message || "Opslaan is mislukt.");
      applyResponse(data);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opslaan is mislukt.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    const text = newNote.trim();
    if (!text || !selectedEmployee.id) return;

    const saved = await performAction({
      action: "add-note",
      employeeId: selectedEmployee.id,
      year,
      text,
      category: "Notitie",
    });
    if (saved) setNewNote("");
  }

  async function toggleSelectedEmployee() {
    if (!selectedEmployee.id) return;
    const active = !selectedEmployee.activeForLetters;
    const saved = await performAction({
      action: "set-active",
      employeeId: selectedEmployee.id,
      active,
    });
    if (saved) setRosterFilter(active ? "active" : "inactive");
  }

  async function addEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await performAction({
      action: "add-manual",
      ...newEmployee,
    });
    if (saved) {
      setNewEmployee({ name: "", role: "", location: "", email: "" });
      setShowAddEmployee(false);
      setRosterFilter("active");
    }
  }

  return (
    <section className="space-y-2.5">
      <div className="rounded-[1.35rem] border border-white/70 bg-white/92 p-3 shadow-[0_10px_28px_rgba(72,91,66,0.12)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black leading-none text-[#352720] sm:text-2xl">
                Kerstbrieven {year}
              </h1>
              <span className="rounded-full bg-[#e8f0e5] px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#486046]">
                Actief = brief maken
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-[#ddd5cb] bg-[#faf8f5] px-3 py-2 text-xs font-black text-[#746a61]">
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="bg-transparent text-sm font-black text-[#352720] outline-none"
                aria-label="Kerstbrievenjaar"
              >
                {Array.from(
                  { length: 8 },
                  (_, index) => new Date().getFullYear() + 1 - index
                ).map((optionYear) => (
                  <option key={optionYear}>{optionYear}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setShowAddEmployee((current) => !current)}
              className="rounded-xl bg-[#245c32] px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1e4f2a]"
            >
              + Medewerker
            </button>
          </div>
        </div>

        {showAddEmployee && (
          <form onSubmit={addEmployee} className="mt-3 grid gap-2 border-t border-[#eee8e1] pt-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
            <input
              required
              value={newEmployee.name}
              onChange={(event) => setNewEmployee((current) => ({ ...current, name: event.target.value }))}
              placeholder="Naam *"
              className="rounded-lg border border-[#ddd5cb] bg-[#faf8f5] px-3 py-2 text-xs outline-none"
            />
            <input
              value={newEmployee.role}
              onChange={(event) => setNewEmployee((current) => ({ ...current, role: event.target.value }))}
              placeholder="Functie"
              className="rounded-lg border border-[#ddd5cb] bg-[#faf8f5] px-3 py-2 text-xs outline-none"
            />
            <input
              value={newEmployee.location}
              onChange={(event) => setNewEmployee((current) => ({ ...current, location: event.target.value }))}
              placeholder="Locatie"
              className="rounded-lg border border-[#ddd5cb] bg-[#faf8f5] px-3 py-2 text-xs outline-none"
            />
            <input
              type="email"
              value={newEmployee.email}
              onChange={(event) => setNewEmployee((current) => ({ ...current, email: event.target.value }))}
              placeholder="E-mail (optioneel)"
              className="rounded-lg border border-[#ddd5cb] bg-[#faf8f5] px-3 py-2 text-xs outline-none"
            />
            <button disabled={saving} className="rounded-lg bg-[#fed500] px-3 py-2 text-xs font-black text-[#382e1d] disabled:opacity-50">
              Toevoegen
            </button>
          </form>
        )}

        {message && (
          <p className="mt-2 rounded-lg bg-[#fff0ec] px-3 py-2 text-xs font-bold text-[#8b4034]">
            {message}
          </p>
        )}
        {!storageAvailable && !loading && (
          <p className="mt-2 text-[0.65rem] italic text-[#8a8178]">
            Lokaal voorbeeld: wijzigingen worden pas bewaard zodra de beveiligde app-opslag beschikbaar is.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#eee8e1] pt-3">
          {[
            [String(stats.active), "actief", "#c3d3bc"],
            [String(stats.inactive), "inactief", "#d9d2c9"],
            [String(stats.withNotes), "met notities", "#fed500"],
            [String(stats.definitive), "definitief", "#d8c5cf"],
          ].map(([value, label, color]) => (
            <div key={label} className="flex items-center gap-2 rounded-full border border-[#e5ded6] bg-[#faf9f7] py-1 pl-1 pr-3">
                <span
                  className="flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-black text-[#2d241f]"
                  style={{ backgroundColor: color }}
                >
                  {value}
                </span>
                <span className="text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#756b62]">
                  {label}
                </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-h-[34rem] gap-2.5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/92 shadow-[0_8px_24px_rgba(72,91,66,0.11)]">
          <div className="border-b border-[#e7e0d8] p-2.5">
            <label className="flex items-center gap-2 rounded-xl border border-[#ddd5cb] bg-[#faf8f5] px-3 py-2">
              <span aria-hidden="true" className="text-[#8d8379]">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Zoek medewerker"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a39a91]"
              />
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-[#f1ede8] p-1">
              {([
                ["active", `Actief ${stats.active}`],
                ["inactive", `Inactief ${stats.inactive}`],
                ["all", `Alle ${stats.total}`],
              ] as Array<[RosterFilter, string]>).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setRosterFilter(filter)}
                  className={`rounded-md px-1.5 py-1.5 text-[0.62rem] font-black ${
                    rosterFilter === filter
                      ? "bg-white text-[#352720] shadow-sm"
                      : "text-[#837970]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 p-1.5">
            {loading && (
              <p className="px-3 py-4 text-center text-xs text-[#8a8178]">Medewerkers laden…</p>
            )}
            {!loading && filteredEmployees.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-[#8a8178]">Geen medewerkers gevonden.</p>
            )}
            {filteredEmployees.map((employee) => {
              const selected = employee.id === selectedId;
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(employee.id);
                    setActiveTab("notities");
                  }}
                  className={`w-full rounded-xl border p-2 text-left transition ${
                    selected
                      ? "border-[#a27a8e] bg-[#f6eff3] shadow-sm"
                      : "border-transparent bg-[#fbfaf8] hover:border-[#d9d2ca]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.65rem] font-black ${selected ? "bg-[#a27a8e] text-white" : "bg-[#dfe9db] text-[#35513a]"}`}>
                      {employee.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-black text-[#2f2823]">{employee.name}</span>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${employee.activeForLetters ? "bg-[#4f8a5b]" : "bg-[#a69d95]"}`} title={employee.activeForLetters ? "Actief" : "Inactief"} />
                      </span>
                      <span className="block truncate text-[0.68rem] text-[#857b72]">
                        {employee.location || employee.role} · {employee.noteCount} notities · {employee.activeForLetters ? "actief" : "inactief"}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mx-2 mb-2 border-t border-[#e3eae0] pt-2 text-[0.65rem] italic text-[#667163]">
            Inactief krijgt geen nieuwe kerstbrief.
          </div>
        </aside>

        <article className="min-w-0 overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/95 shadow-[0_8px_24px_rgba(72,91,66,0.11)]">
          <header className="border-b border-[#e7e0d8] p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#a27a8e] text-xs font-black text-white">
                  {selectedEmployee.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-black text-[#2f2823]">
                    {selectedEmployee.name}
                  </span>
                  <span className="block truncate text-xs text-[#82786f]">
                    {selectedEmployee.role}
                    {selectedEmployee.location ? ` · ${selectedEmployee.location}` : ""}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f1ede8] px-2.5 py-1 text-[0.68rem] font-black text-[#655c54]">
                  {selectedEmployee.source === "tamigo" ? "Tamigo" : "Handmatig"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${statusStyles[selectedEmployee.status]}`}>
                  {selectedEmployee.status}
                </span>
                <button
                  type="button"
                  disabled={!selectedEmployee.id || saving}
                  onClick={toggleSelectedEmployee}
                  className={`rounded-lg px-2.5 py-1 text-[0.68rem] font-black disabled:opacity-50 ${
                    selectedEmployee.activeForLetters
                      ? "border border-[#d9d1c8] bg-white text-[#6b625a]"
                      : "bg-[#245c32] text-white"
                  }`}
                >
                  {selectedEmployee.activeForLetters ? "Zet op inactief" : "Actief maken"}
                </button>
              </div>
            </div>

            <nav className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-[#f4f0eb] p-1" aria-label="Kerstbriefonderdelen">
              {tabLabels.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-max flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === tab.id
                      ? "bg-white text-[#2f2823] shadow-sm"
                      : "text-[#82786f] hover:text-[#2f2823]"
                  }`}
                >
                  {tab.label}
                  {tab.count ? (
                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.6rem] ${activeTab === tab.id ? "bg-[#a27a8e] text-white" : "bg-[#ded7d0]"}`}>
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </header>

          <div className="p-3 sm:p-4">
            {activeTab === "notities" && (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-black text-[#2f2823]">Notities {year}</h2>
                    <span className="rounded-full bg-[#f2ede8] px-2.5 py-1 text-[0.68rem] font-black text-[#746a61]">
                      {notes.length} notities
                    </span>
                  </div>

                  <div className="mt-2 flex gap-2 rounded-xl border border-[#e2d9d0] bg-[#fffdf9] p-1.5 shadow-sm">
                    <input
                      value={newNote}
                      onChange={(event) => setNewNote(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void addNote();
                      }}
                      placeholder="Bijvoorbeeld: pakte Koningsdag zelfstandig geweldig op…"
                      className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[#aaa198]"
                    />
                    <button
                      type="button"
                      onClick={() => void addNote()}
                      disabled={saving || !selectedEmployee.id}
                      className="rounded-lg bg-[#fed500] px-3 py-1.5 text-xs font-black text-[#382e1d] disabled:opacity-50"
                    >
                      + Notitie
                    </button>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {!notes.length && (
                      <div className="rounded-xl border border-dashed border-[#d8d0c8] px-3 py-4 text-center text-xs text-[#8a8178]">
                        Nog geen notities voor {year}.
                      </div>
                    )}
                    {notes.map((note) => (
                      <div key={note.id} className="rounded-xl border border-[#e7e0d8] bg-white p-2.5 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <MiniIcon>✎</MiniIcon>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-black text-[#3b312b]">{note.category}</span>
                              <span className="text-[0.65rem] text-[#9a9087]">
                                {note.createdAt
                                  ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(note.createdAt))
                                  : ""}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[0.8rem] leading-snug text-[#655b53]">{note.text}</p>
                          </div>
                          <button type="button" className="text-[#9d938b]" aria-label="Notitie bewerken">•••</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="space-y-2">
                  <div className="rounded-xl bg-[#fff0b2] p-3 shadow-sm">
                    <h3 className="text-sm font-black text-[#3c321f]">Eerder benoemd</h3>
                    <div className="mt-2 space-y-1.5 text-xs">
                      {[
                        ["Rust tijdens drukte", "2022 · 2024"],
                        ["Rots in de branding", "2021 · 2023"],
                        ["Verbouwing thuis", "2023"],
                      ].map(([topic, years]) => (
                        <div key={topic} className="flex items-center justify-between gap-2 rounded-lg bg-white/75 px-2.5 py-1.5">
                          <strong>{topic}</strong>
                          <span className="shrink-0 text-[#8b7950]">{years}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#eee5ea] p-3 shadow-sm">
                    <h3 className="text-sm font-black text-[#3f2f37]">AI-voorstel</h3>
                    <p className="mt-1 text-xs leading-snug text-[#67545f]">Zet haar ontwikkeling als rustige kartrekker centraal. Noem de woning alleen kort.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("concept")}
                      className="mt-2 w-full rounded-lg bg-[#a27a8e] px-3 py-2 text-xs font-black text-white"
                    >
                      Bekijk AI-concept →
                    </button>
                  </div>
                </aside>
              </div>
            )}

            {activeTab === "vorige" && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-black text-[#2f2823]">Eerdere kerstbrieven</h2>
                  <button type="button" className="rounded-lg border border-[#d9d1c8] px-3 py-1.5 text-xs font-black text-[#5f554d]">Importeren</button>
                </div>
                <div className="mt-3 space-y-1.5">
                  {!selectedEmployee.previousYears.length && (
                    <div className="rounded-xl border border-dashed border-[#d8d0c8] px-3 py-5 text-center text-xs text-[#8a8178]">
                      Nog geen eerdere brieven gekoppeld.
                    </div>
                  )}
                  {selectedEmployee.previousYears.map((year, index) => (
                    <button key={year} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e3dcd4] bg-[#fbfaf8] px-3 py-2.5 text-left shadow-sm transition hover:border-[#a27a8e]">
                      <span className="font-black text-[#3d312b]">Kerst {year}</span>
                      <span className="flex items-center gap-3 text-xs text-[#81766d]">
                        {index + 5} onderwerpen
                        <strong className="text-[#8b5d76]">Open →</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "concept" && (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-black text-[#2f2823]">Concept voor {selectedEmployee.name.split(" ")[0]}</h2>
                    <span className="rounded-full bg-[#e9f1e6] px-2.5 py-1 text-[0.68rem] font-black text-[#35603d]">5 notities gebruikt</span>
                  </div>
                  <div className="mt-2 rounded-xl border border-[#ddd5cc] bg-[#fffdf9] p-4 text-sm leading-6 text-[#4f463f] shadow-sm" contentEditable suppressContentEditableWarning>
                    <p className="font-black text-[#342a25]">Lieve {selectedEmployee.name.split(" ")[0]},</p>
                    <p className="mt-3">Wat hebben we jou dit jaar opnieuw zien groeien. Niet door het hardst te roepen, maar juist door rustig te kijken wat er nodig is en het vervolgens gewoon te regelen. Dat zagen we tijdens de Vierdaagse, maar ook in de manier waarop je een nieuwe collega onder je hoede nam.</p>
                    <p className="mt-3">Zelfs terwijl thuis de verhuisdozen en verbouwing op je wachtten, bleef je flexibel en betrokken. Die combinatie van rust, aandacht en daadkracht maakt jou een ontzettend fijne collega.</p>
                    <p className="mt-3">We hopen dat je tijdens de feestdagen heerlijk kunt landen in je nieuwe huis en kunt genieten van alles wat je dit jaar hebt opgebouwd. Dank je wel voor alles wat je voor Strik en je collega’s doet.</p>
                    <p className="mt-3">Heel veel liefs,<br />Roos &amp; Fien</p>
                  </div>
                </section>
                <aside className="space-y-2">
                  <div className="rounded-xl bg-[#edf3ea] p-3">
                    <h3 className="text-sm font-black text-[#315239]">Schrijfstijl klopt</h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-[#52634f]">
                      <li>✓ Warm en direct</li>
                      <li>✓ Concrete momenten</li>
                      <li>✓ Geen verzonnen feiten</li>
                      <li>✓ Lengte: compact</li>
                    </ul>
                  </div>
                  <button type="button" onClick={() => setActiveTab("controle")} className="w-full rounded-lg bg-[#245c32] px-3 py-2 text-xs font-black text-white">Controleer</button>
                  <button type="button" className="w-full rounded-lg border border-[#d9d1c8] px-3 py-2 text-xs font-black text-[#5f554d]">Andere versie</button>
                </aside>
              </div>
            )}

            {activeTab === "controle" && (
              <div>
                <h2 className="text-base font-black text-[#2f2823]">2 punten controleren</h2>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl border border-[#efd2c9] bg-[#fff1ec] p-3">
                    <div className="flex items-center gap-2.5">
                      <MiniIcon>!</MiniIcon>
                      <div>
                        <h3 className="text-sm font-black text-[#873d32]">Mogelijke herhaling</h3>
                        <p className="mt-0.5 text-xs leading-snug text-[#835a53]">“Rust tijdens drukte” stond ook in 2024. Maak het nu concreet met de Vierdaagse.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#eadb99] bg-[#fff8d8] p-3">
                    <div className="flex items-center gap-2.5">
                      <MiniIcon>?</MiniIcon>
                      <div>
                        <h3 className="text-sm font-black text-[#765c14]">Persoonlijk feit bevestigen</h3>
                        <p className="mt-0.5 text-xs leading-snug text-[#7b6a3e]">Bevestig dat de nieuwe woning genoemd mag worden.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#cee0ca] bg-[#eef6ec] p-3">
                    <h3 className="text-sm font-black text-[#315b39]">✓ Jaartallen kloppen</h3>
                    <p className="mt-1 text-xs text-[#5c7058]">{year} wordt afgesloten; de wens verwijst naar {year + 1}.</p>
                  </div>
                  <div className="rounded-xl border border-[#cee0ca] bg-[#eef6ec] p-3">
                    <h3 className="text-sm font-black text-[#315b39]">✓ Geen gekopieerd slot</h3>
                    <p className="mt-1 text-xs text-[#5c7058]">De afsluiting is niet identiek aan andere brieven van dit jaar.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[#e7e0d8] pt-3">
                  <button type="button" className="rounded-lg border border-[#d9d1c8] px-3 py-2 text-xs font-black text-[#5f554d]">Concept opslaan</button>
                  <button type="button" className="rounded-lg bg-[#245c32] px-3 py-2 text-xs font-black text-white">Definitief maken</button>
                </div>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
