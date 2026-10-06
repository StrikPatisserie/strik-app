import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  getChristmasLetterTamigoEmployees,
  type ChristmasLetterTamigoEmployee,
} from "../../tamigoApi";
import {
  readChristmasLettersState,
  writeChristmasLettersState,
} from "../../lib/christmasLettersStorage";
import {
  emptyChristmasLettersState,
  type ChristmasLetterEmployee,
  type ChristmasLetterNote,
  type ChristmasLettersState,
} from "../../management/kerstbrieven/christmasLettersTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  noteCount: number
) {
  return (
    state.employeeOverrides[employeeId]?.stageByYear?.[String(year)] ||
    (noteCount > 0 ? "Notities compleet" : "Notities nodig")
  );
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

  const tamigoRows = tamigoPool.map((employee) => {
    const override = state.employeeOverrides[employee.id];
    const notes = yearNotes[employee.id] || [];
    const activeForLetters =
      override?.activeForLetters ?? employee.currentlyActive;

    return {
      id: employee.id,
      name: employee.name,
      initials: initials(employee.name),
      email: employee.email,
      role: employee.role || "Medewerker",
      location: override?.location || "",
      source: "tamigo" as const,
      currentlyActive: employee.currentlyActive,
      activeForLetters,
      status: stageForEmployee(state, employee.id, year, notes.length),
      notes,
      noteCount: notes.length,
      previousYears: [],
    };
  });

  const manualRows = state.manualEmployees.map((employee) => {
    const notes = yearNotes[employee.id] || [];
    return {
      id: employee.id,
      name: employee.name,
      initials: initials(employee.name),
      email: employee.email,
      role: employee.role,
      location: employee.location,
      source: "manual" as const,
      currentlyActive: employee.activeForLetters,
      activeForLetters: employee.activeForLetters,
      status: stageForEmployee(state, employee.id, year, notes.length),
      notes,
      noteCount: notes.length,
      previousYears: [],
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
    loadTamigoEmployees(),
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

  return NextResponse.json(
    {
      year,
      employees,
      stats: {
        total: employees.length,
        active: employees.filter((employee) => employee.activeForLetters).length,
        inactive: employees.filter((employee) => !employee.activeForLetters).length,
        withNotes: employees.filter((employee) => employee.noteCount > 0).length,
        definitive: employees.filter((employee) => employee.status === "Definitief").length,
      },
      storageAvailable: stored.storageAvailable,
      tamigoAvailable: tamigo.tamigoAvailable,
      tamigoMessage: tamigo.tamigoMessage,
      updatedAt: state.updatedAt,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: Request) {
  return createResponse(request);
}

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
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
  } else if (action === "set-stage") {
    const employeeId = cleanText(body.employeeId, 180);
    const year = Number(body.year);
    const stages = [
      "Notities nodig",
      "Notities compleet",
      "Concept klaar",
      "Controleren",
      "Definitief",
    ] as const;
    const stage = stages.find((item) => item === body.stage);
    if (!employeeId || !Number.isInteger(year) || !stage) {
      return NextResponse.json({ message: "Briefstatus is niet compleet." }, { status: 400 });
    }

    nextState = {
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
