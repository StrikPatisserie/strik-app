import type { TeamAgendaEvent } from "../../strik-agenda/teamAgendaApi";
import {
  formatJubileeYears,
  isStoreAgendaJubileeEvent,
} from "../../strik-agenda/personnelJubilees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaultSpreadsheetId = "1LFNpYBV7EL1f1QR5ZVS1qgM0ftcMPvScGjqXq-S9pMk";

type PersonnelRow = {
  name: string;
  department: string;
  birthday?: Date;
  startDate?: Date;
  note: string;
};

function getCsvUrl() {
  if (process.env.PERSONNEL_SHEET_CSV_URL) {
    return process.env.PERSONNEL_SHEET_CSV_URL;
  }

  const spreadsheetId =
    process.env.PERSONNEL_SHEET_ID || defaultSpreadsheetId;
  const gid = process.env.PERSONNEL_SHEET_GID || "0";

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  return rows;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getColumnIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function parseDutchDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return createDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
  }

  const dutchMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dutchMatch) {
    const year = Number(dutchMatch[3]);

    return createDate(
      year < 100 ? 2000 + year : year,
      Number(dutchMatch[2]),
      Number(dutchMatch[1])
    );
  }

  return undefined;
}

function createDate(year: number, month: number, day: number) {
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function formatDateFromDate(date: Date) {
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function formatDateNl(date: Date) {
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function nextOccurrence(month: number, day: number, today: Date) {
  let occurrence = createDate(today.getFullYear(), month, day) || today;
  if (occurrence < today) {
    occurrence = createDate(today.getFullYear() + 1, month, day) || occurrence;
  }

  return occurrence;
}

function addYearsAndMonths(date: Date, years: number, months: number) {
  const targetYear = date.getFullYear() + years;
  const targetMonthIndex = date.getMonth() + months;
  const lastDayInTargetMonth = new Date(
    targetYear,
    targetMonthIndex + 1,
    0
  ).getDate();
  const day = Math.min(date.getDate(), lastDayInTargetMonth);
  const result = new Date(targetYear, targetMonthIndex, day);
  result.setHours(0, 0, 0, 0);

  return result;
}

function isWithinHorizon(date: Date, today: Date) {
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 370);

  return date >= today && date <= horizon;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isActive(value: string) {
  const normalized = normalizeHeader(value);

  return !["nee", "no", "false", "inactief", "0"].includes(normalized);
}

function parsePersonnelRows(csv: string) {
  const rows = parseCsv(csv);
  const [rawHeaders, ...records] = rows;
  const headers = (rawHeaders || []).map(normalizeHeader);

  const nameIndex = getColumnIndex(headers, [
    "werknemer",
    "naam",
    "medewerker",
    "employee",
  ]);
  const birthdayIndex = getColumnIndex(headers, [
    "geboortedatum",
    "verjaardag",
    "birthdate",
    "birthday",
  ]);
  const startDateIndex = getColumnIndex(headers, [
    "datumindienst",
    "indienst",
    "indienstsinds",
    "startdatum",
    "from",
  ]);
  const departmentIndex = getColumnIndex(headers, ["afdeling", "team"]);
  const activeIndex = getColumnIndex(headers, ["actief", "active"]);
  const noteIndex = getColumnIndex(headers, ["notitie", "opmerking", "note"]);

  if (nameIndex < 0) {
    throw new Error("Kolom 'Werknemer' of 'Naam' ontbreekt in de sheet.");
  }

  return records.flatMap((record): PersonnelRow[] => {
    const name = (record[nameIndex] || "").trim();
    if (!name) return [];

    if (activeIndex >= 0 && !isActive(record[activeIndex] || "")) {
      return [];
    }

    return [
      {
        name,
        department:
          departmentIndex >= 0 ? (record[departmentIndex] || "").trim() : "",
        birthday:
          birthdayIndex >= 0
            ? parseDutchDate(record[birthdayIndex] || "")
            : undefined,
        startDate:
          startDateIndex >= 0
            ? parseDutchDate(record[startDateIndex] || "")
            : undefined,
        note: noteIndex >= 0 ? (record[noteIndex] || "").trim() : "",
      },
    ];
  });
}

function toEvents(rows: PersonnelRow[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date().toISOString();

  return rows.flatMap((row): TeamAgendaEvent[] => {
    const events: TeamAgendaEvent[] = [];
    const baseDescriptionParts = [
      row.department ? `Afdeling: ${row.department}` : "",
      row.note,
      "Bron: personeelslijst Drive",
    ].filter(Boolean);

    if (row.birthday) {
      const month = row.birthday.getMonth() + 1;
      const day = row.birthday.getDate();

      events.push({
        id: `sheet-birthday-${slug(row.name)}-${month}-${day}`,
        title: `${row.name} is jarig`,
        date: formatDate(2000, month, day),
        type: "birthday",
        audience: "alle",
        description: baseDescriptionParts.join(" · "),
        recurringYearly: true,
        source: "sheet",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (row.startDate) {
      const month = row.startDate.getMonth() + 1;
      const day = row.startDate.getDate();
      const occurrence = nextOccurrence(month, day, today);
      const years = occurrence.getFullYear() - row.startDate.getFullYear();

      if (years >= 1) {
        events.push({
          id: `sheet-anniversary-${slug(row.name)}-${month}-${day}`,
          title: `${row.name} ${years} jaar bij Strik`,
          date: formatDate(2000, month, day),
          type: "anniversary",
          audience: "alle",
          description: [
            `In dienst sinds ${formatDateNl(row.startDate)}`,
            `${formatJubileeYears(years)} jaar bij Strik`,
            ...baseDescriptionParts,
          ].join(" · "),
          recurringYearly: true,
          source: "sheet",
          createdAt: now,
          updatedAt: now,
          employeeName: row.name,
          startDate: formatDateFromDate(row.startDate),
          occurrenceDate: formatDateFromDate(occurrence),
          anniversaryYears: years,
        });
      }

      const halfYearOccurrence = addYearsAndMonths(row.startDate, 12, 6);
      if (isWithinHorizon(halfYearOccurrence, today)) {
        events.push({
          id: `sheet-anniversary-half-${slug(row.name)}`,
          title: `${row.name} 12,5 jaar bij Strik`,
          date: formatDateFromDate(halfYearOccurrence),
          type: "anniversary",
          audience: "alle",
          description: [
            `In dienst sinds ${formatDateNl(row.startDate)}`,
            "12,5 jaar bij Strik",
            ...baseDescriptionParts,
          ].join(" · "),
          recurringYearly: false,
          source: "sheet",
          createdAt: now,
          updatedAt: now,
          employeeName: row.name,
          startDate: formatDateFromDate(row.startDate),
          occurrenceDate: formatDateFromDate(halfYearOccurrence),
          anniversaryYears: 12.5,
        });
      }
    }

    return events;
  });
}

function getView(request: Request) {
  return new URL(request.url).searchParams.get("view") === "shop"
    ? "shop"
    : "management";
}

export async function GET(request: Request) {
  try {
    const response = await fetch(getCsvUrl(), { cache: "no-store" });

    if (!response.ok) {
      return Response.json(
        { message: "Personeelslijst in Drive is niet bereikbaar." },
        { status: 502 }
      );
    }

    const csv = await response.text();
    const rows = parsePersonnelRows(csv);
    const events = toEvents(rows);
    const visibleEvents =
      getView(request) === "shop"
        ? events.filter(
            (event) =>
              event.type !== "anniversary" || isStoreAgendaJubileeEvent(event)
          )
        : events;

    return Response.json({
      source: "google-sheet",
      rowCount: rows.length,
      events: visibleEvents,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Personeelslijst in Drive verwerken is mislukt.",
      },
      { status: 500 }
    );
  }
}
