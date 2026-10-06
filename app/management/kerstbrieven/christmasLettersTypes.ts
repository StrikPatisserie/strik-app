export type ChristmasLetterStage =
  | "Notities nodig"
  | "Notities compleet"
  | "Concept klaar"
  | "Controleren"
  | "Definitief"
  | "Geprint";

export const CHRISTMAS_LETTER_CATEGORIES = [
  "vast-winkel",
  "hulp-winkel",
  "bezorgers",
  "vast-bakkerij",
  "hulp-bakkerij",
  "overig",
] as const;

export type ChristmasLetterCategory =
  (typeof CHRISTMAS_LETTER_CATEGORIES)[number];

export type ChristmasLetterMode = "general" | "personal";

export const GENERAL_TEMPLATE_CATEGORIES: ChristmasLetterCategory[] = [
  "hulp-winkel",
  "bezorgers",
  "hulp-bakkerij",
];

export function isChristmasLetterCategory(
  value: unknown
): value is ChristmasLetterCategory {
  return CHRISTMAS_LETTER_CATEGORIES.includes(
    value as ChristmasLetterCategory
  );
}

export function canUseGeneralChristmasTemplate(
  category: ChristmasLetterCategory
) {
  return GENERAL_TEMPLATE_CATEGORIES.includes(category);
}

export function inferChristmasLetterCategory(
  role: string,
  location = ""
): ChristmasLetterCategory {
  const source = `${role} ${location}`.toLowerCase();
  const fixed = /maandloon|vaste?\b|contract|full.?time|part.?time/.test(source);

  if (/bezorg|chauff|transport|logist/.test(source)) return "bezorgers";
  if (/bakkerij|bakker\b|banket|productie|chocolat/.test(source)) {
    return fixed ? "vast-bakkerij" : "hulp-bakkerij";
  }
  if (/winkel|verkoop|patisserie|ijsloket|horeca|bediening/.test(source)) {
    return fixed ? "vast-winkel" : "hulp-winkel";
  }
  return "overig";
}

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

export type ChristmasLetterDraft = {
  text: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  printedAt: string;
  printCount: number;
};

export type ChristmasLetterPrintRecord = {
  printedAt: string;
  printCount: number;
  templateUpdatedAt: string;
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
  category: ChristmasLetterCategory;
  activeForLetters: boolean;
  createdAt: string;
};

export type ChristmasEmployeeOverride = {
  activeForLetters?: boolean;
  location?: string;
  category?: ChristmasLetterCategory;
  letterModeByYear?: Record<string, ChristmasLetterMode>;
  stageByYear?: Record<string, ChristmasLetterStage>;
};

export type ChristmasLettersState = {
  version: 1;
  knownTamigoEmployees: KnownChristmasEmployee[];
  manualEmployees: ManualChristmasEmployee[];
  employeeOverrides: Record<string, ChristmasEmployeeOverride>;
  notesByYear: Record<string, Record<string, ChristmasLetterNote[]>>;
  draftsByYear: Record<string, Record<string, ChristmasLetterDraft>>;
  categoryTemplatesByYear: Record<
    string,
    Partial<Record<ChristmasLetterCategory, ChristmasLetterDraft>>
  >;
  generalPrintsByYear: Record<
    string,
    Record<string, ChristmasLetterPrintRecord>
  >;
  updatedAt: string;
};

export type ChristmasLetterEmployee = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  location: string;
  category: ChristmasLetterCategory;
  letterMode: ChristmasLetterMode;
  templateAvailable: boolean;
  source: "tamigo" | "manual";
  currentlyActive: boolean;
  activeForLetters: boolean;
  status: ChristmasLetterStage;
  notes: ChristmasLetterNote[];
  noteCount: number;
  hasDraft: boolean;
  printedAt: string;
  printCount: number;
  previousYears: number[];
};

export function emptyChristmasLettersState(): ChristmasLettersState {
  return {
    version: 1,
    knownTamigoEmployees: [],
    manualEmployees: [],
    employeeOverrides: {},
    notesByYear: {},
    draftsByYear: {},
    categoryTemplatesByYear: {},
    generalPrintsByYear: {},
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
    "Geprint",
  ];

  return stages.find((stage) => stage === value);
}

function normalizeDraft(value: unknown): ChristmasLetterDraft | null {
  if (!isRecord(value)) return null;
  const draftText = text(value.text, 12000);
  if (!draftText) return null;

  return {
    text: draftText,
    model: text(value.model, 120),
    createdAt: text(value.createdAt, 80),
    updatedAt: text(value.updatedAt, 80),
    printedAt: text(value.printedAt, 80),
    printCount:
      typeof value.printCount === "number" && Number.isFinite(value.printCount)
        ? Math.max(0, Math.trunc(value.printCount))
        : 0,
  };
}

function normalizePrintRecord(value: unknown): ChristmasLetterPrintRecord | null {
  if (!isRecord(value)) return null;
  const printedAt = text(value.printedAt, 80);
  if (!printedAt) return null;

  return {
    printedAt,
    printCount:
      typeof value.printCount === "number" && Number.isFinite(value.printCount)
        ? Math.max(0, Math.trunc(value.printCount))
        : 1,
    templateUpdatedAt: text(value.templateUpdatedAt, 80),
  };
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
    category: isChristmasLetterCategory(value.category)
      ? value.category
      : inferChristmasLetterCategory(text(value.role, 180), text(value.location, 180)),
    activeForLetters: value.activeForLetters !== false,
    createdAt: text(value.createdAt, 80),
  };
}

function normalizeNote(value: unknown): ChristmasLetterNote | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 180);
  const noteText = text(value.text, 4000);
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
      const letterModeByYear: Record<string, ChristmasLetterMode> = {};
      if (isRecord(rawOverride.stageByYear)) {
        for (const [year, rawStage] of Object.entries(rawOverride.stageByYear)) {
          const stage = normalizeStage(rawStage);
          if (stage) stageByYear[year] = stage;
        }
      }
      if (isRecord(rawOverride.letterModeByYear)) {
        for (const [year, rawMode] of Object.entries(rawOverride.letterModeByYear)) {
          if (rawMode === "general" || rawMode === "personal") {
            letterModeByYear[year] = rawMode;
          }
        }
      }

      employeeOverrides[employeeId] = {
        activeForLetters:
          typeof rawOverride.activeForLetters === "boolean"
            ? rawOverride.activeForLetters
            : undefined,
        location: text(rawOverride.location, 180) || undefined,
        category: isChristmasLetterCategory(rawOverride.category)
          ? rawOverride.category
          : undefined,
        letterModeByYear,
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

  const draftsByYear: ChristmasLettersState["draftsByYear"] = {};
  if (isRecord(value.draftsByYear)) {
    for (const [year, employeeDrafts] of Object.entries(value.draftsByYear)) {
      if (!isRecord(employeeDrafts)) continue;
      draftsByYear[year] = {};
      for (const [employeeId, rawDraft] of Object.entries(employeeDrafts)) {
        const draft = normalizeDraft(rawDraft);
        if (draft) draftsByYear[year][employeeId] = draft;
      }
    }
  }

  const categoryTemplatesByYear: ChristmasLettersState["categoryTemplatesByYear"] = {};
  if (isRecord(value.categoryTemplatesByYear)) {
    for (const [year, rawTemplates] of Object.entries(value.categoryTemplatesByYear)) {
      if (!isRecord(rawTemplates)) continue;
      categoryTemplatesByYear[year] = {};
      for (const [rawCategory, rawDraft] of Object.entries(rawTemplates)) {
        if (!isChristmasLetterCategory(rawCategory)) continue;
        const draft = normalizeDraft(rawDraft);
        if (draft) categoryTemplatesByYear[year][rawCategory] = draft;
      }
    }
  }

  const generalPrintsByYear: ChristmasLettersState["generalPrintsByYear"] = {};
  if (isRecord(value.generalPrintsByYear)) {
    for (const [year, rawPrints] of Object.entries(value.generalPrintsByYear)) {
      if (!isRecord(rawPrints)) continue;
      generalPrintsByYear[year] = {};
      for (const [employeeId, rawPrint] of Object.entries(rawPrints)) {
        const printRecord = normalizePrintRecord(rawPrint);
        if (printRecord) generalPrintsByYear[year][employeeId] = printRecord;
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
    draftsByYear,
    categoryTemplatesByYear,
    generalPrintsByYear,
    updatedAt: text(value.updatedAt, 80),
  };
}
