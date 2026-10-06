export type ChristmasLetterStage =
  | "Notities nodig"
  | "Notities compleet"
  | "Concept klaar"
  | "Controleren"
  | "Definitief";

export type ChristmasLetterNote = {
  id: string;
  text: string;
  category: string;
  createdAt: string;
};

export type HistoricalChristmasLetter = {
  id: string;
  year: number;
  recipient: string;
  content: string;
};

export type KnownChristmasEmployee = {
  id: string;
  name: string;
  email: string;
  role: string;
  startDate: string;
  endDate: string;
  currentlyActive: boolean;
  lastSeenAt: string;
};

export type ManualChristmasEmployee = {
  id: string;
  name: string;
  email: string;
  role: string;
  location: string;
  activeForLetters: boolean;
  createdAt: string;
};

export type ChristmasEmployeeOverride = {
  activeForLetters?: boolean;
  location?: string;
  stageByYear?: Record<string, ChristmasLetterStage>;
};

export type ChristmasLettersState = {
  version: 1;
  knownTamigoEmployees: KnownChristmasEmployee[];
  manualEmployees: ManualChristmasEmployee[];
  employeeOverrides: Record<string, ChristmasEmployeeOverride>;
  notesByYear: Record<string, Record<string, ChristmasLetterNote[]>>;
  updatedAt: string;
};

export type ChristmasLetterEmployee = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  location: string;
  source: "tamigo" | "manual";
  currentlyActive: boolean;
  activeForLetters: boolean;
  status: ChristmasLetterStage;
  notes: ChristmasLetterNote[];
  noteCount: number;
  previousYears: number[];
};

export function emptyChristmasLettersState(): ChristmasLettersState {
  return {
    version: 1,
    knownTamigoEmployees: [],
    manualEmployees: [],
    employeeOverrides: {},
    notesByYear: {},
    updatedAt: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeStage(value: unknown): ChristmasLetterStage | undefined {
  const stages: ChristmasLetterStage[] = [
    "Notities nodig",
    "Notities compleet",
    "Concept klaar",
    "Controleren",
    "Definitief",
  ];

  return stages.find((stage) => stage === value);
}

function normalizeKnownEmployee(value: unknown): KnownChristmasEmployee | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 180);
  const name = text(value.name, 180);
  if (!id || !name) return null;

  return {
    id,
    name,
    email: text(value.email, 240),
    role: text(value.role, 180) || "Medewerker",
    startDate: text(value.startDate, 80),
    endDate: text(value.endDate, 80),
    currentlyActive: value.currentlyActive === true,
    lastSeenAt: text(value.lastSeenAt, 80),
  };
}

function normalizeManualEmployee(value: unknown): ManualChristmasEmployee | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 180);
  const name = text(value.name, 180);
  if (!id || !name) return null;

  return {
    id,
    name,
    email: text(value.email, 240),
    role: text(value.role, 180) || "Medewerker",
    location: text(value.location, 180),
    activeForLetters: value.activeForLetters !== false,
    createdAt: text(value.createdAt, 80),
  };
}

function normalizeNote(value: unknown): ChristmasLetterNote | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 180);
  const noteText = text(value.text, 1600);
  if (!id || !noteText) return null;

  return {
    id,
    text: noteText,
    category: text(value.category, 120) || "Notitie",
    createdAt: text(value.createdAt, 80),
  };
}

export function normalizeChristmasLettersState(value: unknown): ChristmasLettersState {
  if (!isRecord(value)) return emptyChristmasLettersState();

  const employeeOverrides: Record<string, ChristmasEmployeeOverride> = {};
  if (isRecord(value.employeeOverrides)) {
    for (const [employeeId, rawOverride] of Object.entries(value.employeeOverrides)) {
      if (!isRecord(rawOverride)) continue;
      const stageByYear: Record<string, ChristmasLetterStage> = {};
      if (isRecord(rawOverride.stageByYear)) {
        for (const [year, rawStage] of Object.entries(rawOverride.stageByYear)) {
          const stage = normalizeStage(rawStage);
          if (stage) stageByYear[year] = stage;
        }
      }

      employeeOverrides[employeeId] = {
        activeForLetters:
          typeof rawOverride.activeForLetters === "boolean"
            ? rawOverride.activeForLetters
            : undefined,
        location: text(rawOverride.location, 180) || undefined,
        stageByYear,
      };
    }
  }

  const notesByYear: ChristmasLettersState["notesByYear"] = {};
  if (isRecord(value.notesByYear)) {
    for (const [year, employeeNotes] of Object.entries(value.notesByYear)) {
      if (!isRecord(employeeNotes)) continue;
      notesByYear[year] = {};
      for (const [employeeId, rawNotes] of Object.entries(employeeNotes)) {
        if (!Array.isArray(rawNotes)) continue;
        notesByYear[year][employeeId] = rawNotes
          .map(normalizeNote)
          .filter((note): note is ChristmasLetterNote => note !== null);
      }
    }
  }

  return {
    version: 1,
    knownTamigoEmployees: Array.isArray(value.knownTamigoEmployees)
      ? value.knownTamigoEmployees
          .map(normalizeKnownEmployee)
          .filter((employee): employee is KnownChristmasEmployee => employee !== null)
      : [],
    manualEmployees: Array.isArray(value.manualEmployees)
      ? value.manualEmployees
          .map(normalizeManualEmployee)
          .filter((employee): employee is ManualChristmasEmployee => employee !== null)
      : [],
    employeeOverrides,
    notesByYear,
    updatedAt: text(value.updatedAt, 80),
  };
}
