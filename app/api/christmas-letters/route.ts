import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hasFullAccess } from "../../lib/auth/access";
import { getCurrentProfile } from "../../lib/auth/session";
import {
  getChristmasLetterTamigoEmployees,
  type ChristmasLetterTamigoEmployee,
} from "../../tamigoApi";
import {
  readChristmasLettersState,
  writeChristmasLettersState,
} from "../../lib/christmasLettersStorage";
import {
  historicalLettersForEmployee,
  historicalLetterYearsForEmployee,
} from "../../lib/historicalChristmasLetters";
import {
  canUseGeneralChristmasTemplate,
  emptyChristmasLettersState,
  inferChristmasLetterCategory,
  isChristmasLetterCategory,
  type ChristmasLetterCategory,
  type ChristmasLetterDraft,
  type ChristmasLetterEmployee,
  type ChristmasLetterMode,
  type ChristmasLetterNote,
  type ChristmasLetterStage,
  type ChristmasLettersState,
  type HistoricalChristmasLetter,
} from "../../management/kerstbrieven/christmasLettersTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canManageChristmasLetters() {
  return hasFullAccess(await getCurrentProfile());
}

function yearFromRequest(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("year"));
  const currentYear = new Date().getFullYear();

  return Number.isInteger(value) && value >= 2020 && value <= 2100
    ? value
    : currentYear;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function stageForEmployee(
  state: ChristmasLettersState,
  employeeId: string,
  year: number,
  noteCount: number,
  draft: ChristmasLetterDraft | undefined,
  letterMode: ChristmasLetterMode,
  template: ChristmasLetterDraft | undefined
) {
  if (letterMode === "general") {
    const printRecord = state.generalPrintsByYear[String(year)]?.[employeeId];
    if (
      printRecord?.printedAt &&
      template?.updatedAt &&
      printRecord.templateUpdatedAt === template.updatedAt
    ) {
      return "Geprint";
    }
    return template?.text ? "Concept klaar" : "Notities nodig";
  }
  if (draft?.printedAt) return "Geprint";
  return (
    state.employeeOverrides[employeeId]?.stageByYear?.[String(year)] ||
    (noteCount > 0 ? "Notities compleet" : "Notities nodig")
  );
}

function employeeCategory(
  state: ChristmasLettersState,
  employeeId: string,
  role: string,
  location = "",
  storedCategory?: ChristmasLetterCategory
) {
  return (
    state.employeeOverrides[employeeId]?.category ||
    storedCategory ||
    inferChristmasLetterCategory(role, location)
  );
}

function employeeLetterMode(
  state: ChristmasLettersState,
  employeeId: string,
  category: ChristmasLetterCategory,
  year: number
): ChristmasLetterMode {
  const requested =
    state.employeeOverrides[employeeId]?.letterModeByYear?.[String(year)] ||
    "personal";
  return requested === "general" && canUseGeneralChristmasTemplate(category)
    ? "general"
    : "personal";
}

function storedHistoryYears(
  state: ChristmasLettersState,
  employeeId: string,
  selectedYear: number,
  category: ChristmasLetterCategory
) {
  const years = new Set<number>();
  for (const [year, employeeDrafts] of Object.entries(state.draftsByYear)) {
    const numericYear = Number(year);
    const stage = state.employeeOverrides[employeeId]?.stageByYear?.[year];
    const draft = employeeDrafts[employeeId];
    if (
      numericYear < selectedYear &&
      draft?.text &&
      (stage === "Definitief" || stage === "Geprint" || draft.printedAt)
    ) {
      years.add(numericYear);
    }
  }
  for (const [year, templates] of Object.entries(state.categoryTemplatesByYear)) {
    const numericYear = Number(year);
    const mode = state.employeeOverrides[employeeId]?.letterModeByYear?.[year];
    const template = templates[category];
    const printRecord = state.generalPrintsByYear[year]?.[employeeId];
    if (
      numericYear < selectedYear &&
      mode === "general" &&
      template?.text &&
      printRecord?.templateUpdatedAt === template.updatedAt
    ) {
      years.add(numericYear);
    }
  }
  return [...years];
}

function previousYearsForEmployee(
  state: ChristmasLettersState,
  employeeId: string,
  employeeName: string,
  selectedYear: number,
  category: ChristmasLetterCategory
) {
  return [
    ...new Set([
      ...historicalLetterYearsForEmployee(employeeName).filter(
        (letterYear) => letterYear < selectedYear
      ),
      ...storedHistoryYears(state, employeeId, selectedYear, category),
    ]),
  ].sort((left, right) => right - left);
}

function mergeEmployees(
  state: ChristmasLettersState,
  tamigoEmployees: ChristmasLetterTamigoEmployee[],
  year: number
): ChristmasLetterEmployee[] {
  const liveById = new Map(tamigoEmployees.map((employee) => [employee.id, employee]));
  const tamigoPool = [
    ...tamigoEmployees,
    ...state.knownTamigoEmployees.filter((employee) => !liveById.has(employee.id)),
  ];
  const yearNotes = state.notesByYear[String(year)] || {};
  const yearDrafts = state.draftsByYear[String(year)] || {};

  const tamigoRows = tamigoPool.map((employee) => {
    const override = state.employeeOverrides[employee.id];
    const notes = yearNotes[employee.id] || [];
    const draft = yearDrafts[employee.id];
    const category = employeeCategory(
      state,
      employee.id,
      employee.role,
      override?.location || ""
    );
    const letterMode = employeeLetterMode(state, employee.id, category, year);
    const template = state.categoryTemplatesByYear[String(year)]?.[category];
    const generalPrint = state.generalPrintsByYear[String(year)]?.[employee.id];
    const validGeneralPrint =
      letterMode === "general" &&
      template?.updatedAt &&
      generalPrint?.templateUpdatedAt === template.updatedAt
        ? generalPrint
        : undefined;
    const activeForLetters =
      override?.activeForLetters ?? employee.currentlyActive;

    return {
      id: employee.id,
      name: employee.name,
      initials: initials(employee.name),
      email: employee.email,
      role: employee.role || "Medewerker",
      location: override?.location || "",
      category,
      letterMode,
      templateAvailable: Boolean(template?.text),
      source: "tamigo" as const,
      currentlyActive: employee.currentlyActive,
      activeForLetters,
      status: stageForEmployee(
        state,
        employee.id,
        year,
        notes.length,
        draft,
        letterMode,
        template
      ),
      notes,
      noteCount: notes.length,
      hasDraft: letterMode === "general" ? Boolean(template?.text) : Boolean(draft?.text),
      printedAt:
        letterMode === "general" ? validGeneralPrint?.printedAt || "" : draft?.printedAt || "",
      printCount:
        letterMode === "general" ? validGeneralPrint?.printCount || 0 : draft?.printCount || 0,
      previousYears: previousYearsForEmployee(
        state,
        employee.id,
        employee.name,
        year,
        category
      ),
    };
  });

  const manualRows = state.manualEmployees.map((employee) => {
    const notes = yearNotes[employee.id] || [];
    const draft = yearDrafts[employee.id];
    const category = employeeCategory(
      state,
      employee.id,
      employee.role,
      employee.location,
      employee.category
    );
    const letterMode = employeeLetterMode(state, employee.id, category, year);
    const template = state.categoryTemplatesByYear[String(year)]?.[category];
    const generalPrint = state.generalPrintsByYear[String(year)]?.[employee.id];
    const validGeneralPrint =
      letterMode === "general" &&
      template?.updatedAt &&
      generalPrint?.templateUpdatedAt === template.updatedAt
        ? generalPrint
        : undefined;
    return {
      id: employee.id,
      name: employee.name,
      initials: initials(employee.name),
      email: employee.email,
      role: employee.role,
      location: employee.location,
      category,
      letterMode,
      templateAvailable: Boolean(template?.text),
      source: "manual" as const,
      currentlyActive: employee.activeForLetters,
      activeForLetters: employee.activeForLetters,
      status: stageForEmployee(
        state,
        employee.id,
        year,
        notes.length,
        draft,
        letterMode,
        template
      ),
      notes,
      noteCount: notes.length,
      hasDraft: letterMode === "general" ? Boolean(template?.text) : Boolean(draft?.text),
      printedAt:
        letterMode === "general" ? validGeneralPrint?.printedAt || "" : draft?.printedAt || "",
      printCount:
        letterMode === "general" ? validGeneralPrint?.printCount || 0 : draft?.printCount || 0,
      previousYears: previousYearsForEmployee(
        state,
        employee.id,
        employee.name,
        year,
        category
      ),
    };
  });

  return [...tamigoRows, ...manualRows].sort((left, right) => {
    if (left.activeForLetters !== right.activeForLetters) {
      return left.activeForLetters ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "nl");
  });
}

function knownFromTamigo(
  state: ChristmasLettersState,
  employees: ChristmasLetterTamigoEmployee[]
) {
  const now = new Date().toISOString();
  const knownById = new Map(
    state.knownTamigoEmployees.map((employee) => [
      employee.id,
      { ...employee, currentlyActive: false },
    ])
  );

  for (const employee of employees) {
    const existing = knownById.get(employee.id);
    knownById.set(employee.id, {
      ...employee,
      lastSeenAt: existing?.lastSeenAt || now,
    });
  }

  return [...knownById.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "nl")
  );
}

function storedEmployeeDetails(state: ChristmasLettersState, employeeId: string) {
  const known = state.knownTamigoEmployees.find((employee) => employee.id === employeeId);
  if (known) {
    const location = state.employeeOverrides[employeeId]?.location || "";
    return {
      name: known.name,
      category: employeeCategory(state, employeeId, known.role, location),
    };
  }

  const manual = state.manualEmployees.find((employee) => employee.id === employeeId);
  if (!manual) return null;
  return {
    name: manual.name,
    category: employeeCategory(
      state,
      employeeId,
      manual.role,
      manual.location,
      manual.category
    ),
  };
}

async function loadStateWithAvailability() {
  try {
    return { state: await readChristmasLettersState(), storageAvailable: true };
  } catch {
    return { state: emptyChristmasLettersState(), storageAvailable: false };
  }
}

async function loadTamigoEmployees() {
  try {
    return {
      employees: await getChristmasLetterTamigoEmployees(),
      tamigoAvailable: true,
      tamigoMessage: "",
    };
  } catch (error) {
    return {
      employees: [] as ChristmasLetterTamigoEmployee[],
      tamigoAvailable: false,
      tamigoMessage:
        error instanceof Error ? error.message : "Tamigo medewerkers ophalen is mislukt.",
    };
  }
}

async function createResponse(request: Request, stateOverride?: ChristmasLettersState) {
  const year = yearFromRequest(request);
  const [stored, tamigo] = await Promise.all([
    stateOverride
      ? Promise.resolve({ state: stateOverride, storageAvailable: true })
      : loadStateWithAvailability(),
    stateOverride
      ? Promise.resolve({
          employees: [] as ChristmasLetterTamigoEmployee[],
          tamigoAvailable: true,
          tamigoMessage: "",
        })
      : loadTamigoEmployees(),
  ]);
  let state = stored.state;

  if (tamigo.employees.length) {
    const knownTamigoEmployees = knownFromTamigo(state, tamigo.employees);
    const rosterChanged =
      JSON.stringify(knownTamigoEmployees) !==
      JSON.stringify(state.knownTamigoEmployees);
    state = { ...state, knownTamigoEmployees };
    if (stored.storageAvailable && !stateOverride && rosterChanged) {
      try {
        state = await writeChristmasLettersState(state);
      } catch {
        // Reading and displaying the live Tamigo roster remains possible.
      }
    }
  }

  const employees = mergeEmployees(state, tamigo.employees, year);
  const readyEmployees = employees.filter(
    (employee) => employee.status === "Definitief" || employee.status === "Geprint"
  );

  return NextResponse.json(
    {
      year,
      employees,
      stats: {
        total: employees.length,
        active: employees.filter((employee) => employee.activeForLetters).length,
        inactive: employees.filter((employee) => !employee.activeForLetters).length,
        withNotes: employees.filter((employee) => employee.noteCount > 0).length,
        todo: employees.filter(
          (employee) =>
            employee.activeForLetters &&
            employee.status !== "Definitief" &&
            employee.status !== "Geprint"
        ).length,
        ready: readyEmployees.length,
        definitive: employees.filter((employee) => employee.status === "Definitief").length,
        printed: employees.filter((employee) => employee.status === "Geprint").length,
      },
      storageAvailable: stored.storageAvailable,
      tamigoAvailable: tamigo.tamigoAvailable,
      tamigoMessage: tamigo.tamigoMessage,
      aiAvailable: Boolean(process.env.OPENAI_API_KEY),
      categoryTemplates: state.categoryTemplatesByYear[String(year)] || {},
      updatedAt: state.updatedAt,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: Request) {
  if (!(await canManageChristmasLetters())) {
    return NextResponse.json({ message: "Geen toegang tot kerstbrieven." }, { status: 403 });
  }

  const url = new URL(request.url);
  const draftFor = cleanText(url.searchParams.get("draftFor"), 180);
  if (draftFor) {
    const year = yearFromRequest(request);
    const { state, storageAvailable } = await loadStateWithAvailability();
    if (!storageAvailable) {
      return NextResponse.json(
        { message: "De beveiligde app-opslag is nog niet beschikbaar." },
        { status: 503 }
      );
    }
    const employee = storedEmployeeDetails(state, draftFor);
    if (!employee) {
      return NextResponse.json({ message: "Medewerker is niet gevonden." }, { status: 404 });
    }
    const mode = employeeLetterMode(state, draftFor, employee.category, year);
    const personalDraft = state.draftsByYear[String(year)]?.[draftFor];
    const template = state.categoryTemplatesByYear[String(year)]?.[employee.category];
    const printRecord = state.generalPrintsByYear[String(year)]?.[draftFor];
    const generalDraft = template
      ? {
          ...template,
          printedAt:
            printRecord?.templateUpdatedAt === template.updatedAt
              ? printRecord.printedAt
              : "",
          printCount:
            printRecord?.templateUpdatedAt === template.updatedAt
              ? printRecord.printCount
              : 0,
        }
      : null;
    return NextResponse.json(
      {
        draft: mode === "general" ? generalDraft : personalDraft || null,
        mode,
        category: employee.category,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const historyFor = cleanText(url.searchParams.get("historyFor"), 180);
  if (historyFor) {
    const year = yearFromRequest(request);
    const employeeId = cleanText(url.searchParams.get("employeeId"), 180);
    const { state } = await loadStateWithAvailability();
    const storedEmployee = employeeId
      ? storedEmployeeDetails(state, employeeId)
      : null;
    const storedLetters: HistoricalChristmasLetter[] = employeeId
      ? Object.entries(state.draftsByYear).flatMap(([draftYear, employeeDrafts]) => {
          const numericYear = Number(draftYear);
          const draft = employeeDrafts[employeeId];
          const stage = state.employeeOverrides[employeeId]?.stageByYear?.[draftYear];
          const mode = state.employeeOverrides[employeeId]?.letterModeByYear?.[draftYear];
          if (
            !draft?.text ||
            numericYear >= year ||
            mode === "general" ||
            (stage !== "Definitief" && stage !== "Geprint" && !draft.printedAt)
          ) {
            return [];
          }
          return [{
            id: `saved-${draftYear}-${employeeId}`,
            year: numericYear,
            recipient: historyFor,
            content: draft.text,
          }];
        })
      : [];
    const generalLetters: HistoricalChristmasLetter[] =
      employeeId && storedEmployee
        ? Object.entries(state.categoryTemplatesByYear).flatMap(
            ([templateYear, templates]) => {
              const numericYear = Number(templateYear);
              const mode =
                state.employeeOverrides[employeeId]?.letterModeByYear?.[templateYear];
              const template = templates[storedEmployee.category];
              const printRecord = state.generalPrintsByYear[templateYear]?.[employeeId];
              if (
                numericYear >= year ||
                mode !== "general" ||
                !template?.text ||
                printRecord?.templateUpdatedAt !== template.updatedAt
              ) return [];
              return [{
                id: `general-${templateYear}-${employeeId}`,
                year: numericYear,
                recipient: historyFor,
                content: template.text.replace(
                  /\[voornaam\]|\{\{voornaam\}\}/gi,
                  historyFor.trim().split(/\s+/)[0] || historyFor
                ),
              }];
            }
          )
        : [];
    const importedLetters = historicalLettersForEmployee(historyFor).filter(
      (letter) => letter.year < year
    );
    return NextResponse.json(
      {
        letters: [...storedLetters, ...generalLetters, ...importedLetters].sort(
          (left, right) => right.year - left.year
        ),
      },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  }

  return createResponse(request);
}

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function withEmployeeStage(
  state: ChristmasLettersState,
  employeeId: string,
  year: number,
  stage: ChristmasLetterStage
) {
  return {
    ...state,
    employeeOverrides: {
      ...state.employeeOverrides,
      [employeeId]: {
        ...state.employeeOverrides[employeeId],
        stageByYear: {
          ...(state.employeeOverrides[employeeId]?.stageByYear || {}),
          [String(year)]: stage,
        },
      },
    },
  };
}

export async function POST(request: Request) {
  if (!(await canManageChristmasLetters())) {
    return NextResponse.json({ message: "Geen toegang tot kerstbrieven." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Ongeldige invoer." }, { status: 400 });
  }

  const { state, storageAvailable } = await loadStateWithAvailability();
  if (!storageAvailable) {
    return NextResponse.json(
      { message: "De beveiligde app-opslag is nog niet beschikbaar." },
      { status: 503 }
    );
  }

  const action = cleanText(body.action, 80);
  let nextState: ChristmasLettersState = state;

  if (action === "set-active") {
    const employeeId = cleanText(body.employeeId, 180);
    if (!employeeId || typeof body.active !== "boolean") {
      return NextResponse.json({ message: "Medewerker of status ontbreekt." }, { status: 400 });
    }

    const manualIndex = state.manualEmployees.findIndex((employee) => employee.id === employeeId);
    if (manualIndex >= 0) {
      const manualEmployees = [...state.manualEmployees];
      manualEmployees[manualIndex] = {
        ...manualEmployees[manualIndex],
        activeForLetters: body.active,
      };
      nextState = { ...state, manualEmployees };
    } else {
      nextState = {
        ...state,
        employeeOverrides: {
          ...state.employeeOverrides,
          [employeeId]: {
            ...state.employeeOverrides[employeeId],
            activeForLetters: body.active,
          },
        },
      };
    }
  } else if (action === "set-category") {
    const employeeId = cleanText(body.employeeId, 180);
    const category = isChristmasLetterCategory(body.category)
      ? body.category
      : null;
    const year = Number(body.year);
    if (!employeeId || !category) {
      return NextResponse.json({ message: "Medewerker of categorie ontbreekt." }, { status: 400 });
    }
    const existingOverride = state.employeeOverrides[employeeId];
    nextState = {
      ...state,
      employeeOverrides: {
        ...state.employeeOverrides,
        [employeeId]: {
          ...existingOverride,
          category,
          letterModeByYear:
            Number.isInteger(year) && !canUseGeneralChristmasTemplate(category)
              ? {
                  ...(existingOverride?.letterModeByYear || {}),
                  [String(year)]: "personal",
                }
              : existingOverride?.letterModeByYear,
        },
      },
    };
  } else if (action === "set-letter-mode") {
    const employeeId = cleanText(body.employeeId, 180);
    const year = Number(body.year);
    const mode: ChristmasLetterMode | null =
      body.mode === "general" || body.mode === "personal" ? body.mode : null;
    const employee = employeeId ? storedEmployeeDetails(state, employeeId) : null;
    if (!employeeId || !Number.isInteger(year) || !mode || !employee) {
      return NextResponse.json({ message: "Briefkeuze is niet compleet." }, { status: 400 });
    }
    if (mode === "general" && !canUseGeneralChristmasTemplate(employee.category)) {
      return NextResponse.json(
        { message: "Voor deze personeelscategorie is geen algemeen template beschikbaar." },
        { status: 400 }
      );
    }
    nextState = {
      ...state,
      employeeOverrides: {
        ...state.employeeOverrides,
        [employeeId]: {
          ...state.employeeOverrides[employeeId],
          letterModeByYear: {
            ...(state.employeeOverrides[employeeId]?.letterModeByYear || {}),
            [String(year)]: mode,
          },
        },
      },
    };
  } else if (action === "save-category-template") {
    const year = Number(body.year);
    const category = isChristmasLetterCategory(body.category)
      ? body.category
      : null;
    const templateText = cleanText(body.text, 12000);
    if (
      !Number.isInteger(year) ||
      !category ||
      !canUseGeneralChristmasTemplate(category) ||
      !templateText
    ) {
      return NextResponse.json({ message: "Algemeen template is niet compleet." }, { status: 400 });
    }
    const yearKey = String(year);
    const existingTemplate = state.categoryTemplatesByYear[yearKey]?.[category];
    const now = new Date().toISOString();
    const template: ChristmasLetterDraft = {
      text: templateText,
      model: "handmatig",
      createdAt: existingTemplate?.createdAt || now,
      updatedAt:
        existingTemplate?.text === templateText && existingTemplate.updatedAt
          ? existingTemplate.updatedAt
          : now,
      printedAt: "",
      printCount: 0,
    };
    nextState = {
      ...state,
      categoryTemplatesByYear: {
        ...state.categoryTemplatesByYear,
        [yearKey]: {
          ...(state.categoryTemplatesByYear[yearKey] || {}),
          [category]: template,
        },
      },
    };
  } else if (action === "assign-category-template") {
    const year = Number(body.year);
    const category = isChristmasLetterCategory(body.category)
      ? body.category
      : null;
    if (
      !Number.isInteger(year) ||
      !category ||
      !canUseGeneralChristmasTemplate(category) ||
      !state.categoryTemplatesByYear[String(year)]?.[category]?.text
    ) {
      return NextResponse.json(
        { message: "Sla eerst het algemene template voor deze categorie op." },
        { status: 400 }
      );
    }
    const matchingEmployees = mergeEmployees(state, [], year).filter(
      (employee) => employee.activeForLetters && employee.category === category
    );
    const employeeOverrides = { ...state.employeeOverrides };
    for (const employee of matchingEmployees) {
      employeeOverrides[employee.id] = {
        ...employeeOverrides[employee.id],
        letterModeByYear: {
          ...(employeeOverrides[employee.id]?.letterModeByYear || {}),
          [String(year)]: "general",
        },
      };
    }
    nextState = { ...state, employeeOverrides };
  } else if (action === "add-manual") {
    const name = cleanText(body.name, 180);
    if (!name) {
      return NextResponse.json({ message: "Vul een naam in." }, { status: 400 });
    }

    nextState = {
      ...state,
      manualEmployees: [
        ...state.manualEmployees,
        {
          id: `manual-${randomUUID()}`,
          name,
          email: cleanText(body.email, 240),
          role: cleanText(body.role, 180) || "Medewerker",
          location: cleanText(body.location, 180),
          category: isChristmasLetterCategory(body.category)
            ? body.category
            : "overig",
          activeForLetters: true,
          createdAt: new Date().toISOString(),
        },
      ],
    };
  } else if (action === "add-note") {
    const employeeId = cleanText(body.employeeId, 180);
    const noteText = cleanText(body.text, 1600);
    const year = Number(body.year);
    if (!employeeId || !noteText || !Number.isInteger(year)) {
      return NextResponse.json({ message: "Notitie is niet compleet." }, { status: 400 });
    }

    const yearKey = String(year);
    const note: ChristmasLetterNote = {
      id: `note-${randomUUID()}`,
      text: noteText,
      category: cleanText(body.category, 120) || "Notitie",
      createdAt: new Date().toISOString(),
    };
    nextState = {
      ...state,
      notesByYear: {
        ...state.notesByYear,
        [yearKey]: {
          ...(state.notesByYear[yearKey] || {}),
          [employeeId]: [
            note,
            ...(state.notesByYear[yearKey]?.[employeeId] || []),
          ],
        },
      },
    };
  } else if (action === "delete-note") {
    const employeeId = cleanText(body.employeeId, 180);
    const noteId = cleanText(body.noteId, 180);
    const year = Number(body.year);
    if (!employeeId || !noteId || !Number.isInteger(year)) {
      return NextResponse.json({ message: "Notitie is niet compleet." }, { status: 400 });
    }

    const yearKey = String(year);
    nextState = {
      ...state,
      notesByYear: {
        ...state.notesByYear,
        [yearKey]: {
          ...(state.notesByYear[yearKey] || {}),
          [employeeId]: (state.notesByYear[yearKey]?.[employeeId] || []).filter(
            (note) => note.id !== noteId
          ),
        },
      },
    };
  } else if (action === "save-draft" || action === "mark-printed") {
    const employeeId = cleanText(body.employeeId, 180);
    const draftText = cleanText(body.text, 12000);
    const year = Number(body.year);
    if (!employeeId || !draftText || !Number.isInteger(year)) {
      return NextResponse.json({ message: "Brief is niet compleet." }, { status: 400 });
    }

    const yearKey = String(year);
    const employee = storedEmployeeDetails(state, employeeId);
    if (!employee) {
      return NextResponse.json({ message: "Medewerker is niet gevonden." }, { status: 404 });
    }
    const letterMode = employeeLetterMode(state, employeeId, employee.category, year);
    if (letterMode === "general") {
      if (action !== "mark-printed") {
        return NextResponse.json(
          { message: "Kies ‘Eigen brief’ om deze tekst persoonlijk op te slaan." },
          { status: 400 }
        );
      }
      const template = state.categoryTemplatesByYear[yearKey]?.[employee.category];
      if (!template?.text) {
        return NextResponse.json({ message: "Het algemene template ontbreekt." }, { status: 400 });
      }
      const existingPrint = state.generalPrintsByYear[yearKey]?.[employeeId];
      const now = new Date().toISOString();
      nextState = withEmployeeStage(
        {
          ...state,
          generalPrintsByYear: {
            ...state.generalPrintsByYear,
            [yearKey]: {
              ...(state.generalPrintsByYear[yearKey] || {}),
              [employeeId]: {
                printedAt: now,
                printCount: (existingPrint?.printCount || 0) + 1,
                templateUpdatedAt: template.updatedAt,
              },
            },
          },
        },
        employeeId,
        year,
        "Geprint"
      );
    } else {
    const existingDraft = state.draftsByYear[yearKey]?.[employeeId];
    const now = new Date().toISOString();
    const textChanged = existingDraft?.text !== draftText;
    const requestedStage = body.stage === "Definitief" ? "Definitief" : "Concept klaar";
    const stage: ChristmasLetterStage = action === "mark-printed" ? "Geprint" : requestedStage;
    const draft: ChristmasLetterDraft = {
      text: draftText,
      model: existingDraft?.model || cleanText(body.model, 120),
      createdAt: existingDraft?.createdAt || now,
      updatedAt: now,
      printedAt:
        action === "mark-printed"
          ? now
          : textChanged
            ? ""
            : existingDraft?.printedAt || "",
      printCount:
        action === "mark-printed"
          ? (existingDraft?.printCount || 0) + 1
          : existingDraft?.printCount || 0,
    };
    nextState = withEmployeeStage(
      {
        ...state,
        draftsByYear: {
          ...state.draftsByYear,
          [yearKey]: {
            ...(state.draftsByYear[yearKey] || {}),
            [employeeId]: draft,
          },
        },
      },
      employeeId,
      year,
      stage
    );
    }
  } else if (action === "set-stage") {
    const employeeId = cleanText(body.employeeId, 180);
    const year = Number(body.year);
    const stages = [
      "Notities nodig",
      "Notities compleet",
      "Concept klaar",
      "Controleren",
      "Definitief",
      "Geprint",
    ] as const;
    const stage = stages.find((item) => item === body.stage);
    if (!employeeId || !Number.isInteger(year) || !stage) {
      return NextResponse.json({ message: "Briefstatus is niet compleet." }, { status: 400 });
    }

    nextState = withEmployeeStage(state, employeeId, year, stage);
  } else {
    return NextResponse.json({ message: "Onbekende actie." }, { status: 400 });
  }

  try {
    const savedState = await writeChristmasLettersState(nextState);
    return createResponse(request, savedState);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Opslaan is mislukt." },
      { status: 500 }
    );
  }
}
