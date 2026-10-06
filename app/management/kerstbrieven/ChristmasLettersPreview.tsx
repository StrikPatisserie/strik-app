"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ChristmasLetterCategory,
  ChristmasLetterDraft,
  ChristmasLetterEmployee,
  ChristmasLetterMode,
  ChristmasLetterStage,
  HistoricalChristmasLetter,
} from "./christmasLettersTypes";
import {
  CHRISTMAS_LETTER_CATEGORIES,
  GENERAL_TEMPLATE_CATEGORIES,
  canUseGeneralChristmasTemplate,
} from "./christmasLettersTypes";

type LetterTab = "notities" | "vorige" | "concept" | "controle";
type RosterFilter = "active" | "inactive" | "all";
type CategoryFilter = "all" | ChristmasLetterCategory;

const categoryLabels: Record<ChristmasLetterCategory, string> = {
  "vast-winkel": "Vast winkel",
  "hulp-winkel": "Hulp winkel",
  bezorgers: "Bezorgers",
  "vast-bakkerij": "Vast bakkerij",
  "hulp-bakkerij": "Hulp bakkerij",
  overig: "Overig",
};

type ChristmasLettersResponse = {
  year: number;
  employees: ChristmasLetterEmployee[];
  stats: {
    total: number;
    active: number;
    inactive: number;
    withNotes: number;
    todo: number;
    ready: number;
    definitive: number;
    printed: number;
  };
  storageAvailable: boolean;
  tamigoAvailable: boolean;
  tamigoMessage: string;
  aiAvailable: boolean;
  categoryTemplates: Partial<Record<ChristmasLetterCategory, ChristmasLetterDraft>>;
};

type ChristmasLettersHistoryResponse = {
  letters: HistoricalChristmasLetter[];
};

const statusStyles: Record<ChristmasLetterStage, string> = {
  "Notities nodig": "bg-[#fff3d6] text-[#8a5a00]",
  "Notities compleet": "bg-[#e7f0e3] text-[#315b39]",
  "Concept klaar": "bg-[#eee5ea] text-[#704b60]",
  Controleren: "bg-[#fbe5df] text-[#9b392d]",
  Definitief: "bg-[#dcebd8] text-[#225c31]",
  Geprint: "bg-[#245c32] text-white",
};

const emptyEmployee: ChristmasLetterEmployee = {
  id: "",
  name: "Medewerkers laden…",
  initials: "",
  email: "",
  role: "",
  location: "",
  category: "overig",
  letterMode: "personal",
  templateAvailable: false,
  source: "manual",
  currentlyActive: false,
  activeForLetters: false,
  status: "Notities nodig",
  notes: [],
  noteCount: 0,
  hasDraft: false,
  printedAt: "",
  printCount: 0,
  previousYears: [],
};

function MiniIcon({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-black shadow-sm">
      {children}
    </span>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function personalizeTemplate(value: string, name: string) {
  const firstName = name.trim().split(/\s+/)[0] || name;
  return value.replace(/\[voornaam\]|\{\{voornaam\}\}/gi, firstName);
}

export default function ChristmasLettersPreview() {
  const [employees, setEmployees] = useState<ChristmasLetterEmployee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<LetterTab>("notities");
  const [query, setQuery] = useState("");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
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
    category: "overig" as ChristmasLetterCategory,
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    withNotes: 0,
    todo: 0,
    ready: 0,
    definitive: 0,
    printed: 0,
  });
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [historyLetters, setHistoryLetters] = useState<HistoricalChristmasLetter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openHistoryId, setOpenHistoryId] = useState("");
  const [draft, setDraft] = useState<ChristmasLetterDraft | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openNoteMenuId, setOpenNoteMenuId] = useState("");
  const [showPrintConfirmation, setShowPrintConfirmation] = useState(false);
  const [categoryTemplates, setCategoryTemplates] = useState<
    Partial<Record<ChristmasLetterCategory, ChristmasLetterDraft>>
  >({});
  const [editingTemplateCategory, setEditingTemplateCategory] =
    useState<ChristmasLetterCategory | null>(null);
  const [categoryTemplateText, setCategoryTemplateText] = useState("");

  function applyResponse(data: ChristmasLettersResponse) {
    setEmployees(data.employees);
    setStats(data.stats);
    setStorageAvailable(data.storageAvailable);
    setAiAvailable(data.aiAvailable);
    setCategoryTemplates(data.categoryTemplates || {});
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
    setEditingTemplateCategory(null);
    setCategoryTemplateText("");

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
  const selectedTemplateUpdatedAt =
    categoryTemplates[selectedEmployee.category]?.updatedAt || "";
  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (rosterFilter === "active" && !employee.activeForLetters) return false;
      if (rosterFilter === "inactive" && employee.activeForLetters) return false;
      if (categoryFilter !== "all" && employee.category !== categoryFilter) return false;
      if (!normalizedQuery) return true;

      return `${employee.name} ${employee.role} ${employee.location} ${categoryLabels[employee.category]}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [categoryFilter, employees, query, rosterFilter]);

  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        CHRISTMAS_LETTER_CATEGORIES.map((category) => [
          category,
          employees.filter(
            (employee) => employee.activeForLetters && employee.category === category
          ).length,
        ])
      ) as Record<ChristmasLetterCategory, number>,
    [employees]
  );

  const tabLabels: Array<{ id: LetterTab; label: string; count?: number }> = [
    { id: "notities", label: `Notities ${year}`, count: selectedEmployee.noteCount },
    { id: "vorige", label: "Vorige brieven", count: selectedEmployee.previousYears.length },
    { id: "concept", label: "Brief", count: selectedEmployee.hasDraft ? 1 : undefined },
    { id: "controle", label: "Afronden" },
  ];

  useEffect(() => {
    if (activeTab !== "vorige" || !selectedEmployee.id) return;

    let cancelled = false;
    setHistoryLoading(true);
    setOpenHistoryId("");

    fetch(
      `/api/christmas-letters?year=${year}&historyFor=${encodeURIComponent(selectedEmployee.name)}&employeeId=${encodeURIComponent(selectedEmployee.id)}`,
      { cache: "force-cache" }
    )
      .then(async (response) => {
        const data = (await response.json()) as ChristmasLettersHistoryResponse & {
          message?: string;
        };
        if (!response.ok) throw new Error(data.message || "Oude brieven ophalen is mislukt.");
        if (!cancelled) setHistoryLetters(data.letters);
      })
      .catch((error) => {
        if (!cancelled) {
          setHistoryLetters([]);
          setMessage(error instanceof Error ? error.message : "Oude brieven ophalen is mislukt.");
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedEmployee.id, selectedEmployee.name, year]);

  useEffect(() => {
    if (!selectedEmployee.id) return;

    let cancelled = false;
    setDraftLoading(true);
    setDraft(null);
    setDraftText("");
    setShowPrintConfirmation(false);

    fetch(
      `/api/christmas-letters?year=${year}&draftFor=${encodeURIComponent(selectedEmployee.id)}`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const data = (await response.json()) as {
          draft: ChristmasLetterDraft | null;
          message?: string;
        };
        if (!response.ok) throw new Error(data.message || "Concept ophalen is mislukt.");
        if (!cancelled) {
          setDraft(data.draft);
          setDraftText(data.draft?.text || "");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Concept ophalen is mislukt.");
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedEmployee.category,
    selectedEmployee.id,
    selectedEmployee.letterMode,
    year,
    selectedTemplateUpdatedAt,
  ]);

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

  async function deleteNote(noteId: string) {
    if (!selectedEmployee.id) return;
    if (!window.confirm("Deze persoonlijke notitie verwijderen?")) return;

    const saved = await performAction({
      action: "delete-note",
      employeeId: selectedEmployee.id,
      noteId,
      year,
    });
    if (saved) setOpenNoteMenuId("");
  }

  async function generateDraft() {
    if (!selectedEmployee.id || !notes.length || generating) return;
    if (selectedEmployee.letterMode === "general") {
      setMessage("Kies eerst ‘Eigen brief’ om een persoonlijke AI-brief te schrijven.");
      return;
    }
    if (!aiAvailable) {
      setMessage("De AI-schrijver is nog niet gekoppeld. Voeg OPENAI_API_KEY toe in Vercel.");
      return;
    }

    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/christmas-letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee.id, year }),
      });
      const data = (await response.json()) as {
        draft?: ChristmasLetterDraft;
        message?: string;
      };
      if (!response.ok || !data.draft) {
        throw new Error(data.message || "AI-concept maken is mislukt.");
      }

      setDraft(data.draft);
      setDraftText(data.draft.text);
      setEmployees((current) =>
        current.map((employee) =>
          employee.id === selectedEmployee.id
            ? {
                ...employee,
                hasDraft: true,
                status: "Concept klaar",
                printedAt: "",
              }
            : employee
        )
      );
      if (
        selectedEmployee.activeForLetters &&
        (selectedEmployee.status === "Definitief" || selectedEmployee.status === "Geprint")
      ) {
        setStats((current) => ({
          ...current,
          todo: current.todo + 1,
          ready: Math.max(0, current.ready - 1),
          definitive:
            selectedEmployee.status === "Definitief"
              ? Math.max(0, current.definitive - 1)
              : current.definitive,
          printed:
            selectedEmployee.status === "Geprint"
              ? Math.max(0, current.printed - 1)
              : current.printed,
        }));
      }
      setActiveTab("concept");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI-concept maken is mislukt.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft(stage: "Concept klaar" | "Definitief") {
    const text = draftText.trim();
    if (!selectedEmployee.id || !text) {
      setMessage("De brief is nog leeg.");
      return false;
    }
    if (selectedEmployee.letterMode === "general") {
      setMessage("Het algemene template wordt bovenaan bij de categorie opgeslagen.");
      return false;
    }

    const saved = await performAction({
      action: "save-draft",
      employeeId: selectedEmployee.id,
      year,
      text,
      stage,
      model: draft?.model || "handmatig",
    });
    if (saved) {
      const now = new Date().toISOString();
      setDraft((current) => ({
        text,
        model: current?.model || "handmatig",
        createdAt: current?.createdAt || now,
        updatedAt: now,
        printedAt: current?.text === text ? current.printedAt : "",
        printCount: current?.printCount || 0,
      }));
    }
    return saved;
  }

  async function printDraft() {
    const text = draftText.trim();
    if (!text || !selectedEmployee.id) return;

    const printWindow = window.open("", "_blank", "width=820,height=920");
    if (!printWindow) {
      setMessage("Sta pop-ups toe om de brief te printen.");
      return;
    }
    printWindow.document.write("<p style='font-family:sans-serif;padding:24px'>Brief voorbereiden…</p>");

    if (selectedEmployee.letterMode === "personal") {
      const saved = await saveDraft("Definitief");
      if (!saved) {
        printWindow.close();
        return;
      }
    }

    const printableText =
      selectedEmployee.letterMode === "general"
        ? personalizeTemplate(text, selectedEmployee.name)
        : text;
    const paragraphs = printableText
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="nl"><head><meta charset="utf-8"><title>Kerstbrief ${escapeHtml(selectedEmployee.name)} ${year}</title>
      <style>
        @page { size: A4; margin: 24mm 23mm; }
        body { margin: 0; color: #2f2823; font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.55; }
        p { margin: 0 0 12pt; }
      </style></head><body>${paragraphs}
      <script>window.addEventListener('load', function(){ window.focus(); window.print(); });<\/script>
      </body></html>`);
    printWindow.document.close();
    setShowPrintConfirmation(true);
  }

  async function confirmPrinted() {
    const text =
      selectedEmployee.letterMode === "general"
        ? personalizeTemplate(draftText.trim(), selectedEmployee.name)
        : draftText.trim();
    if (!selectedEmployee.id || !text) return;
    const saved = await performAction({
      action: "mark-printed",
      employeeId: selectedEmployee.id,
      year,
      text,
    });
    if (saved) {
      const now = new Date().toISOString();
      setDraft((current) => ({
        text,
        model: current?.model || "handmatig",
        createdAt: current?.createdAt || now,
        updatedAt: now,
        printedAt: now,
        printCount: (current?.printCount || 0) + 1,
      }));
      setShowPrintConfirmation(false);
    }
  }

  async function toggleSelectedEmployee() {
    if (!selectedEmployee.id) return;
    const active = !selectedEmployee.activeForLetters;
    const previousEmployees = employees;
    const previousStats = stats;
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === selectedEmployee.id
          ? { ...employee, activeForLetters: active }
          : employee
      )
    );
    setStats((current) => ({
      ...current,
      active: current.active + (active ? 1 : -1),
      inactive: current.inactive + (active ? -1 : 1),
    }));
    setRosterFilter(active ? "active" : "inactive");
    const saved = await performAction({
      action: "set-active",
      employeeId: selectedEmployee.id,
      active,
    });
    if (!saved) {
      setEmployees(previousEmployees);
      setStats(previousStats);
      setRosterFilter(selectedEmployee.activeForLetters ? "active" : "inactive");
    }
  }

  async function addEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await performAction({
      action: "add-manual",
      ...newEmployee,
    });
    if (saved) {
      setNewEmployee({ name: "", role: "", location: "", email: "", category: "overig" });
      setShowAddEmployee(false);
      setRosterFilter("active");
    }
  }

  async function setEmployeeCategory(category: ChristmasLetterCategory) {
    if (!selectedEmployee.id || category === selectedEmployee.category) return;
    await performAction({
      action: "set-category",
      employeeId: selectedEmployee.id,
      year,
      category,
    });
  }

  async function setEmployeeLetterMode(mode: ChristmasLetterMode) {
    if (!selectedEmployee.id || mode === selectedEmployee.letterMode) return;
    await performAction({
      action: "set-letter-mode",
      employeeId: selectedEmployee.id,
      year,
      mode,
    });
  }

  function openCategoryTemplate(category: ChristmasLetterCategory) {
    setEditingTemplateCategory((current) => (current === category ? null : category));
    setCategoryTemplateText(categoryTemplates[category]?.text || "Lieve [voornaam],\n\n");
  }

  async function saveCategoryTemplate() {
    if (!editingTemplateCategory || !categoryTemplateText.trim()) return;
    await performAction({
      action: "save-category-template",
      year,
      category: editingTemplateCategory,
      text: categoryTemplateText,
    });
  }

  async function assignCategoryTemplate(category: ChristmasLetterCategory) {
    if (!window.confirm(`Algemeen template toewijzen aan alle ${categoryCounts[category]} actieve medewerkers in ${categoryLabels[category]}?`)) return;
    await performAction({
      action: "assign-category-template",
      year,
      category,
    });
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
                Alleen briefstatus · Tamigo blijft gelijk
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
          <form onSubmit={addEmployee} className="mt-3 grid gap-2 border-t border-[#eee8e1] pt-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr_auto]">
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
            <select
              value={newEmployee.category}
              onChange={(event) => setNewEmployee((current) => ({
                ...current,
                category: event.target.value as ChristmasLetterCategory,
              }))}
              className="rounded-lg border border-[#ddd5cb] bg-[#faf8f5] px-3 py-2 text-xs font-bold outline-none"
              aria-label="Personeelscategorie"
            >
              {CHRISTMAS_LETTER_CATEGORIES.map((category) => (
                <option key={category} value={category}>{categoryLabels[category]}</option>
              ))}
            </select>
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
            [String(stats.active), "brieven", "#c3d3bc"],
            [String(stats.inactive), "geen brief", "#d9d2c9"],
            [String(stats.todo), "te doen", "#fed500"],
            [String(stats.definitive), "klaar", "#d8c5cf"],
            [String(stats.printed), "geprint", "#82a27b"],
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

        <div className="mt-2 flex gap-1.5 overflow-x-auto border-t border-[#eee8e1] pt-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`min-w-max rounded-full px-3 py-1.5 text-[0.65rem] font-black ${categoryFilter === "all" ? "bg-[#352720] text-white" : "bg-[#f4f0eb] text-[#756b62]"}`}
          >
            Alle categorieën · {stats.active}
          </button>
          {CHRISTMAS_LETTER_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setCategoryFilter(category);
                setRosterFilter("active");
              }}
              className={`min-w-max rounded-full px-3 py-1.5 text-[0.65rem] font-black ${categoryFilter === category ? "bg-[#a27a8e] text-white" : "bg-[#f4f0eb] text-[#756b62]"}`}
            >
              {categoryLabels[category]} · {categoryCounts[category]}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-[1.35rem] border border-white/70 bg-white/92 p-3 shadow-[0_8px_24px_rgba(72,91,66,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black text-[#352720]">Algemene brieven</h2>
          <span className="text-[0.65rem] italic text-[#81766d]">Gebruik [voornaam] voor de aanhef.</span>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {GENERAL_TEMPLATE_CATEGORIES.map((category) => {
            const template = categoryTemplates[category];
            const assigned = employees.filter(
              (employee) =>
                employee.activeForLetters &&
                employee.category === category &&
                employee.letterMode === "general"
            ).length;
            return (
              <button
                key={category}
                type="button"
                onClick={() => openCategoryTemplate(category)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${editingTemplateCategory === category ? "border-[#a27a8e] bg-[#f6eff3]" : "border-[#e4ddd5] bg-[#fbfaf8]"}`}
              >
                <span>
                  <span className="block text-xs font-black text-[#3b312b]">{categoryLabels[category]}</span>
                  <span className="block text-[0.65rem] text-[#82786f]">{assigned}/{categoryCounts[category]} algemeen</span>
                </span>
                <span className={`rounded-full px-2 py-1 text-[0.6rem] font-black ${template ? "bg-[#dcebd8] text-[#285632]" : "bg-[#fff0b2] text-[#765c14]"}`}>
                  {template ? "Geschreven" : "Nog maken"}
                </span>
              </button>
            );
          })}
        </div>
        {editingTemplateCategory && (
          <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
            <textarea
              value={categoryTemplateText}
              onChange={(event) => setCategoryTemplateText(event.target.value)}
              className="min-h-36 resize-y rounded-xl border border-[#d9d1c8] bg-[#fffdf9] p-3 text-sm leading-6 text-[#4f463f] outline-none focus:border-[#a27a8e]"
              aria-label={`Algemene brief ${categoryLabels[editingTemplateCategory]}`}
            />
            <div className="flex gap-2 lg:w-44 lg:flex-col">
              <button type="button" disabled={saving || !categoryTemplateText.trim()} onClick={() => void saveCategoryTemplate()} className="flex-1 rounded-lg bg-[#245c32] px-3 py-2 text-xs font-black text-white disabled:opacity-40">Template opslaan</button>
              <button type="button" disabled={saving || !categoryTemplates[editingTemplateCategory]} onClick={() => void assignCategoryTemplate(editingTemplateCategory)} className="flex-1 rounded-lg border border-[#a27a8e] bg-white px-3 py-2 text-xs font-black text-[#704b60] disabled:opacity-40">Aan iedereen koppelen</button>
            </div>
          </div>
        )}
      </section>

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
                ["active", `Brief ${stats.active}`],
                ["inactive", `Geen brief ${stats.inactive}`],
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
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            !employee.activeForLetters
                              ? "bg-[#a69d95]"
                              : employee.status === "Geprint"
                                ? "bg-[#245c32]"
                                : employee.status === "Definitief"
                                  ? "bg-[#a27a8e]"
                                  : "bg-[#fed500]"
                          }`}
                          title={employee.activeForLetters ? employee.status : "Geen brief"}
                        />
                      </span>
                      <span className="block truncate text-[0.68rem] text-[#857b72]">
                        {categoryLabels[employee.category]} · {employee.activeForLetters ? employee.status.toLowerCase() : "geen brief"}
                        {employee.activeForLetters && employee.letterMode === "general" ? " · algemeen" : ""}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mx-2 mb-2 border-t border-[#e3eae0] pt-2 text-[0.65rem] italic text-[#667163]">
            ‘Geen brief’ verandert niets in Tamigo.
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
                <select
                  value={selectedEmployee.category}
                  disabled={!selectedEmployee.id || saving}
                  onChange={(event) => void setEmployeeCategory(event.target.value as ChristmasLetterCategory)}
                  className="rounded-lg border border-[#ddd5cb] bg-white px-2 py-1 text-[0.68rem] font-black text-[#655c54] outline-none disabled:opacity-50"
                  aria-label="Categorie medewerker"
                >
                  {CHRISTMAS_LETTER_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{categoryLabels[category]}</option>
                  ))}
                </select>
                {canUseGeneralChristmasTemplate(selectedEmployee.category) && (
                  <span className="flex rounded-lg bg-[#f1ede8] p-0.5">
                    <button
                      type="button"
                      disabled={saving || !selectedEmployee.id}
                      onClick={() => void setEmployeeLetterMode("general")}
                      className={`rounded-md px-2 py-1 text-[0.65rem] font-black ${selectedEmployee.letterMode === "general" ? "bg-[#a27a8e] text-white shadow-sm" : "text-[#746a61]"}`}
                    >
                      Gebruik algemeen template
                    </button>
                    <button
                      type="button"
                      disabled={saving || !selectedEmployee.id}
                      onClick={() => void setEmployeeLetterMode("personal")}
                      className={`rounded-md px-2 py-1 text-[0.65rem] font-black ${selectedEmployee.letterMode === "personal" ? "bg-white text-[#352720] shadow-sm" : "text-[#746a61]"}`}
                    >
                      Schrijf eigen brief
                    </button>
                  </span>
                )}
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
                  {selectedEmployee.activeForLetters ? "Geen brief maken" : "Wel brief maken"}
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
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenNoteMenuId((current) => current === note.id ? "" : note.id)}
                              className="rounded-md px-1.5 py-0.5 text-[#9d938b] hover:bg-[#f1ede8]"
                              aria-label="Acties voor notitie"
                            >
                              •••
                            </button>
                            {openNoteMenuId === note.id && (
                              <div className="absolute right-0 z-10 mt-1 min-w-28 rounded-lg border border-[#e2d9d0] bg-white p-1 shadow-lg">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void deleteNote(note.id)}
                                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-black text-[#b04435] hover:bg-[#fff0ec] disabled:opacity-50"
                                >
                                  Verwijderen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="space-y-2">
                  <div className="rounded-xl bg-[#fff0b2] p-3 shadow-sm">
                    <h3 className="text-sm font-black text-[#3c321f]">Eerder benoemd</h3>
                    <p className="mt-1 text-xs leading-snug text-[#756431]">
                      {selectedEmployee.previousYears.length
                        ? `${selectedEmployee.previousYears.length} eerder jaar gevonden.`
                        : "Nog geen oude brieven gekoppeld."}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#eee5ea] p-3 shadow-sm">
                    <h3 className="text-sm font-black text-[#3f2f37]">Conceptopzet</h3>
                    <p className="mt-1 text-xs leading-snug text-[#67545f]">
                      {notes.length
                        ? `Maak een feitelijke eerste opzet uit ${notes.length} notitie${notes.length === 1 ? "" : "s"}.`
                        : "Voeg eerst minimaal één notitie toe."}
                    </p>
                    <button
                      type="button"
                      onClick={() => void generateDraft()}
                      disabled={!notes.length || generating || !aiAvailable || selectedEmployee.letterMode === "general"}
                      className="mt-2 w-full rounded-lg bg-[#a27a8e] px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {selectedEmployee.letterMode === "general"
                        ? "Gebruikt algemeen template"
                        : generating
                          ? "AI schrijft…"
                          : draftText
                            ? "Nieuwe AI-versie"
                            : "Schrijf met AI →"}
                    </button>
                    {!aiAvailable && (
                      <p className="mt-1 text-[0.62rem] italic text-[#7e6875]">OPENAI_API_KEY ontbreekt nog.</p>
                    )}
                  </div>
                </aside>
              </div>
            )}

            {activeTab === "vorige" && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-black text-[#2f2823]">Eerdere kerstbrieven</h2>
                </div>
                <div className="mt-3 space-y-1.5">
                  {historyLoading && (
                    <div className="rounded-xl border border-dashed border-[#d8d0c8] px-3 py-5 text-center text-xs text-[#8a8178]">
                      Oude brieven laden…
                    </div>
                  )}
                  {!historyLoading && !historyLetters.length && (
                    <div className="rounded-xl border border-dashed border-[#d8d0c8] px-3 py-5 text-center text-xs text-[#8a8178]">
                      Nog geen eerdere brieven gekoppeld.
                    </div>
                  )}
                  {historyLetters.map((letter) => {
                    const isOpen = openHistoryId === letter.id;
                    return (
                      <div key={letter.id} className="overflow-hidden rounded-xl border border-[#e3dcd4] bg-[#fbfaf8] shadow-sm">
                        <button
                          type="button"
                          onClick={() => setOpenHistoryId(isOpen ? "" : letter.id)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-[#f6f0f3]"
                        >
                          <span className="font-black text-[#3d312b]">Kerst {letter.year}</span>
                          <strong className="text-xs text-[#8b5d76]">{isOpen ? "Sluit ↑" : "Open ↓"}</strong>
                        </button>
                        {isOpen && (
                          <div className="border-t border-[#e7e0d8] bg-white px-3 py-3 text-[0.8rem] leading-relaxed text-[#5d534b]">
                            {letter.content.split(/\n{2,}/).map((paragraph, index) => (
                              <p key={`${letter.id}-${index}`} className={index ? "mt-3" : ""}>
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "concept" && (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-black text-[#2f2823]">
                      {selectedEmployee.letterMode === "general" ? "Algemene brief" : `Brief voor ${selectedEmployee.name.split(" ")[0]}`}
                    </h2>
                    <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${statusStyles[selectedEmployee.status]}`}>
                      {selectedEmployee.status}
                    </span>
                  </div>
                  {draftLoading ? (
                    <div className="mt-2 rounded-xl border border-dashed border-[#d8d0c8] px-3 py-8 text-center text-xs text-[#8a8178]">
                      Brief laden…
                    </div>
                  ) : draftText ? (
                    <textarea
                      value={draftText}
                      readOnly={selectedEmployee.letterMode === "general"}
                      onChange={(event) => {
                        setDraftText(event.target.value);
                        setShowPrintConfirmation(false);
                      }}
                      aria-label={`Kerstbrief voor ${selectedEmployee.name}`}
                      className={`mt-2 min-h-[27rem] w-full resize-y rounded-xl border border-[#ddd5cc] p-4 text-sm leading-6 text-[#4f463f] shadow-sm outline-none focus:border-[#a27a8e] focus:ring-2 focus:ring-[#a27a8e]/15 ${selectedEmployee.letterMode === "general" ? "bg-[#f5f1ed]" : "bg-[#fffdf9]"}`}
                    />
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed border-[#d8d0c8] px-3 py-6 text-center text-xs text-[#8a8178]">
                      {selectedEmployee.letterMode === "general"
                        ? `Schrijf eerst bovenaan het algemene template voor ${categoryLabels[selectedEmployee.category]}.`
                        : notes.length
                          ? "Laat de AI een eerste versie schrijven; daarna kun je alles zelf aanpassen."
                          : "Voeg eerst een of meer persoonlijke notities toe."}
                    </div>
                  )}
                </section>
                <aside className="space-y-2">
                  <div className="rounded-xl bg-[#edf3ea] p-3">
                    <h3 className="text-sm font-black text-[#315239]">
                      {selectedEmployee.letterMode === "general" ? categoryLabels[selectedEmployee.category] : "Slim geschreven"}
                    </h3>
                    <p className="mt-1 text-xs leading-snug text-[#52634f]">
                      {selectedEmployee.letterMode === "general"
                        ? "Dit template wordt bij het printen automatisch met de juiste voornaam gevuld."
                        : "Nieuwe notities leveren de feiten; oude brieven bewaken stijl en herhaling."}
                    </p>
                  </div>
                  {selectedEmployee.letterMode === "personal" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void generateDraft()}
                        disabled={!notes.length || generating || !aiAvailable}
                        className="w-full rounded-lg bg-[#a27a8e] px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        {generating ? "AI schrijft…" : draftText ? "Nieuwe AI-versie" : "Schrijf met AI"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveDraft("Concept klaar")}
                        disabled={saving || !draftText.trim()}
                        className="w-full rounded-lg border border-[#d9d1c8] bg-white px-3 py-2 text-xs font-black text-[#5f554d] disabled:opacity-40"
                      >
                        Concept opslaan
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (await saveDraft("Definitief")) setActiveTab("controle");
                        }}
                        disabled={saving || !draftText.trim()}
                        className="w-full rounded-lg bg-[#245c32] px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        Klaar voor print
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setActiveTab("controle")} disabled={!draftText.trim()} className="w-full rounded-lg bg-[#245c32] px-3 py-2 text-xs font-black text-white disabled:opacity-40">Naar print</button>
                  )}
                  {!aiAvailable && selectedEmployee.letterMode === "personal" && (
                    <p className="text-[0.62rem] italic text-[#7e6875]">AI wordt actief zodra OPENAI_API_KEY in Vercel staat.</p>
                  )}
                  {draft?.updatedAt && (
                    <p className="text-[0.62rem] italic text-[#857b72]">
                      Opgeslagen {new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(draft.updatedAt))}
                    </p>
                  )}
                </aside>
              </div>
            )}

            {activeTab === "controle" && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-black text-[#2f2823]">Afronden</h2>
                  {draft?.printedAt && (
                    <span className="rounded-full bg-[#dcebd8] px-2.5 py-1 text-[0.68rem] font-black text-[#225c31]">
                      Geprint {new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(draft.printedAt))}
                      {draft.printCount > 1 ? ` · ${draft.printCount}×` : ""}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className={`rounded-xl border p-3 ${selectedEmployee.previousYears.length ? "border-[#cee0ca] bg-[#eef6ec]" : "border-[#eadb99] bg-[#fff8d8]"}`}>
                    <div className="flex items-center gap-2.5">
                      <MiniIcon>{selectedEmployee.previousYears.length ? "✓" : "!"}</MiniIcon>
                      <div>
                        <h3 className={`text-sm font-black ${selectedEmployee.previousYears.length ? "text-[#315b39]" : "text-[#765c14]"}`}>
                          {selectedEmployee.previousYears.length ? "Historie gekoppeld" : "Geen historie gevonden"}
                        </h3>
                        <p className={`mt-0.5 text-xs leading-snug ${selectedEmployee.previousYears.length ? "text-[#5c7058]" : "text-[#7b6a3e]"}`}>
                          {selectedEmployee.previousYears.length
                            ? `${selectedEmployee.previousYears.length} oude brief${selectedEmployee.previousYears.length === 1 ? "" : "ven"} beschikbaar om herhaling te controleren.`
                            : "Voor deze naam is in 2020–2024 geen oude brief gevonden."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#cee0ca] bg-[#eef6ec] p-3">
                    <div className="flex items-center gap-2.5">
                      <MiniIcon>✓</MiniIcon>
                      <div>
                        <h3 className="text-sm font-black text-[#315b39]">
                          {selectedEmployee.letterMode === "general" ? "Algemeen template gekozen" : "Alleen bevestigde notities"}
                        </h3>
                        <p className="mt-0.5 text-xs leading-snug text-[#5c7058]">
                          {selectedEmployee.letterMode === "general"
                            ? `${categoryLabels[selectedEmployee.category]} · de voornaam wordt automatisch ingevuld.`
                            : `De opzet gebruikt ${notes.length} opgeslagen notitie${notes.length === 1 ? "" : "s"}.`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#cee0ca] bg-[#eef6ec] p-3">
                    <h3 className="text-sm font-black text-[#315b39]">✓ Jaartallen kloppen</h3>
                    <p className="mt-1 text-xs text-[#5c7058]">{year} wordt afgesloten; de wens verwijst naar {year + 1}.</p>
                  </div>
                  <div className={`rounded-xl border p-3 ${draftText.trim() ? "border-[#cee0ca] bg-[#eef6ec]" : "border-[#eadb99] bg-[#fff8d8]"}`}>
                    <h3 className={`text-sm font-black ${draftText.trim() ? "text-[#315b39]" : "text-[#765c14]"}`}>
                      {draftText.trim() ? "✓ Brief opgeslagen" : "! Nog geen brief"}
                    </h3>
                    <p className={`mt-1 text-xs ${draftText.trim() ? "text-[#5c7058]" : "text-[#7b6a3e]"}`}>
                      {draftText.trim() ? "De brief is klaar om definitief te maken en af te drukken." : "Ga eerst naar Brief en maak een concept."}
                    </p>
                  </div>
                </div>
                {showPrintConfirmation && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#eadb99] bg-[#fff8d8] px-3 py-2.5">
                    <p className="text-xs font-black text-[#765c14]">Heb je de brief echt afgedrukt?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowPrintConfirmation(false)} className="rounded-lg border border-[#ddcf91] bg-white px-3 py-1.5 text-xs font-black text-[#6e6250]">Alleen bekeken</button>
                      <button type="button" disabled={saving} onClick={() => void confirmPrinted()} className="rounded-lg bg-[#245c32] px-3 py-1.5 text-xs font-black text-white disabled:opacity-40">Ja, registreer</button>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[#e7e0d8] pt-3">
                  <button type="button" onClick={() => setActiveTab("concept")} className="rounded-lg border border-[#d9d1c8] px-3 py-2 text-xs font-black text-[#5f554d]">Brief bekijken</button>
                  {selectedEmployee.letterMode === "personal" && (
                    <button type="button" disabled={saving || !draftText.trim()} onClick={() => void saveDraft("Definitief")} className="rounded-lg border border-[#a9c1a4] bg-[#edf3ea] px-3 py-2 text-xs font-black text-[#315239] disabled:opacity-40">Definitief opslaan</button>
                  )}
                  <button type="button" disabled={saving || !draftText.trim()} onClick={() => void printDraft()} className="rounded-lg bg-[#245c32] px-4 py-2 text-xs font-black text-white disabled:opacity-40">Print brief</button>
                </div>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
