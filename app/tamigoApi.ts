import type { TeamAgendaEvent } from "./strik-agenda/teamAgendaApi";

const TAMIGO_API_BASE_URL =
  process.env.TAMIGO_API_BASE_URL || "https://api.tamigo.com";
const TAMIGO_MAX_EMPLOYEE_PAGES = getPositiveNumber(
  process.env.TAMIGO_MAX_EMPLOYEE_PAGES,
  50
);
const AMSTERDAM_TIME_ZONE = "Europe/Amsterdam";

let cachedTamigoSessionToken: string | null = null;
let cachedTamigoLaborSessionToken: string | null = null;

type JsonRecord = Record<string, unknown>;
type TamigoAuthScope = "default" | "labor";

type TamigoSimpleEmployee = {
  EmployeeId?: string;
  Name?: string;
  Email?: string;
  IsEnabled?: boolean;
  EndDate?: string;
};

type TamigoDetailedEmployee = {
  EmployeeId?: string;
  Name?: string;
  Email?: string;
  WageNumber?: string;
  EmployerNumber?: string;
  CurrentPaymentModel?: string;
  CurrentWageRateType?: string;
  HistoricalWages?: TamigoHistoricalWage[];
  WageRateTypes?: TamigoWageRateType[];
  StandardHours?: number;
  ContractHours?: TamigoContractHours[];
  From?: string;
  To?: string;
  Birthdate?: string;
  DeletedOn?: string;
  IsActive?: boolean;
  IsUserEnabled?: boolean;
};

type TamigoHistoricalWage = {
  StartDate?: string;
  Wage?: number;
};

type TamigoWageRateType = {
  StartDate?: string;
  EndDate?: string;
  PaymentModel?: string;
  WageRateTypeName?: string;
};

type TamigoContractHours = {
  StartDate?: string;
  EndDate?: string;
  ContractHours?: number;
  ContractHoursMonthly?: number;
};

type TamigoShift = {
  ShiftId?: string;
  EmployeeId?: string;
  EmployeeName?: string;
  DepartmentId?: string;
  DepartmentName?: string;
  DepartmentKey?: string;
  Comments?: string;
  Comments2?: string;
  StartDateTime?: string;
  EndDateTime?: string;
  Date?: string;
  StartDate?: string;
  EndDate?: string;
  ShiftActivityName?: string;
  ShiftActivityShortName?: string;
  AbsencePercentage?: number;
  IsProductive?: boolean;
  ShiftHours?: number;
  BreakCodeHours?: number;
};

type TamigoLeavePerDay = {
  Date?: string;
  WageSystemKey?: string;
  Name?: string;
  AbsenceType?: string;
};

export type ShopName = "Heyendaal" | "Lent" | "Ziekerstraat" | "Daalseweg";

type ShopDepartment = {
  shop: ShopName;
  departmentId: string;
  departmentName: string;
  departmentKey: string;
};

export type PersonnelEventType = "birthday" | "anniversary";

export type PersonnelAgendaEvent = {
  id: string;
  type: PersonnelEventType;
  employeeName: string;
  title: string;
  date: string;
  occurrenceDate: string;
  daysUntil: number;
  month: number;
  day: number;
  years?: number;
  source: "tamigo";
};

export type PersonnelAgenda = {
  generatedAt: string;
  activeEmployeeCount: number;
  birthdays: PersonnelAgendaEvent[];
  anniversaries: PersonnelAgendaEvent[];
};

export type TodayStaffShiftTime = {
  startTime: string;
  endTime: string;
  timeLabel: string;
};

export type TodayStaffPerson = {
  id: string;
  employeeName: string;
  shifts: TodayStaffShiftTime[];
};

export type StaffAbsenceType = "sick" | "vacation" | "absence";

export type TodayStaffAbsence = {
  id: string;
  employeeName: string;
  type: StaffAbsenceType;
  label: string;
};

export type TodayStaffShop = {
  shop: ShopName;
  departmentName: string;
  employees: TodayStaffPerson[];
  absences: TodayStaffAbsence[];
  iceDepartmentName?: string;
  iceEmployees?: TodayStaffPerson[];
};

export type TodayStaffSchedule = {
  generatedAt: string;
  date: string;
  shops: TodayStaffShop[];
};

export type WeekStaffDay = {
  date: string;
  weekdayLabel: string;
  dateLabel: string;
  shops: TodayStaffShop[];
};

export type WeekStaffSchedule = {
  generatedAt: string;
  from: string;
  to: string;
  weekLabel: string;
  shops: ShopName[];
  days: WeekStaffDay[];
};

type LaborCostReason = "missingEmployee" | "missingWage";

export type LaborCostTotals = {
  shifts: number;
  hours: number;
  cost: number;
  directHourlyHours: number;
  directHourlyCost: number;
  derivedMonthlyHours: number;
  derivedMonthlyCost: number;
  missingHours: number;
  missingShifts: number;
  missingEmployeeShifts: number;
  missingWageShifts: number;
};

export type LaborCostShop = LaborCostTotals & {
  shop: ShopName;
  departmentName: string;
};

export type LaborCostDay = {
  date: string;
  weekdayLabel: string;
  dateLabel: string;
  shops: LaborCostShop[];
  totals: LaborCostTotals;
};

export type LaborCostSchedule = {
  generatedAt: string;
  from: string;
  to: string;
  weekLabel: string;
  shops: ShopName[];
  days: LaborCostDay[];
  totals: LaborCostTotals;
  notes: string[];
};

const SHOP_DEPARTMENTS: ShopDepartment[] = [
  {
    shop: "Heyendaal",
    departmentId: "15fe190a-2fee-4ff6-80ac-3da8c9fe252b",
    departmentKey: "Heyendaalseweg",
    departmentName: "Winkel - Heyendaalseweg",
  },
  {
    shop: "Lent",
    departmentId: "9bd578ca-9893-46e7-a1d4-23e1b49fcdb4",
    departmentKey: "Oranje Marieplein",
    departmentName: "Winkel - Oranje Marieplein",
  },
  {
    shop: "Ziekerstraat",
    departmentId: "5fba2ecb-5e47-4f9c-82a0-0cf1b753cfff",
    departmentKey: "Ziekerstraat",
    departmentName: "Winkel - Ziekerstraat",
  },
  {
    shop: "Daalseweg",
    departmentId: "57e2c68e-bf1c-44d3-a57f-d484a1a09865",
    departmentKey: "Daalseweg",
    departmentName: "Winkel - Daalseweg",
  },
];

const ICE_LOKET_DEPARTMENT: ShopDepartment = {
  shop: "Lent",
  departmentId: "9c15db05-51a4-43e6-9c0a-4da44e62853e",
  departmentKey: "Ijsloket",
  departmentName: "Ijsloket",
};

const ICE_SHIFT_LOCATION_ALIASES: Record<ShopName, string[]> = {
  Heyendaal: ["HEY", "HEYENDAAL", "HEYENDAALSEWEG"],
  Lent: ["LENT", "ORANJE", "ORANJE MARIEPLEIN"],
  Ziekerstraat: ["ZIEKER", "ZIEKERSTRAAT"],
  Daalseweg: ["DAAL", "DAALSEWEG"],
};

class TamigoApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "TamigoApiError";
  }
}

export class TamigoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TamigoConfigurationError";
  }
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

function getTamigoApiKey(scope: TamigoAuthScope = "default") {
  const apiKey =
    scope === "labor" && process.env.TAMIGO_LOON_API_KEY
      ? process.env.TAMIGO_LOON_API_KEY
      : process.env.TAMIGO_API_KEY;

  if (!apiKey) {
    throw new TamigoConfigurationError("Tamigo API key is nog niet ingesteld.");
  }

  return apiKey;
}

function getTamigoApplicationName(scope: TamigoAuthScope = "default") {
  if (scope === "labor") {
    return (
      process.env.TAMIGO_LOON_APPLICATION_NAME ||
      process.env.TAMIGO_APPLICATION_NAME ||
      process.env.TAMIGO_API_NAME ||
      process.env.TAMIGO_APP_NAME ||
      ""
    );
  }

  return (
    process.env.TAMIGO_APPLICATION_NAME ||
    process.env.TAMIGO_API_NAME ||
    process.env.TAMIGO_APP_NAME ||
    ""
  );
}

async function getTamigoAccessToken(scope: TamigoAuthScope = "default") {
  const applicationName = getTamigoApplicationName(scope);

  if (!applicationName) {
    return getTamigoApiKey(scope);
  }

  const cachedToken =
    scope === "labor" ? cachedTamigoLaborSessionToken : cachedTamigoSessionToken;

  if (cachedToken) {
    return cachedToken;
  }

  const response = await fetch(createTamigoUrl("/v2/Login/Application"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Name: applicationName,
      Key: getTamigoApiKey(scope),
    }),
    cache: "no-store",
  });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw new TamigoApiError(
      getErrorMessage(data, "Tamigo application login is mislukt."),
      response.status
    );
  }

  if (!isRecord(data) || !textFrom(data.SessionToken)) {
    throw new TamigoApiError("Tamigo gaf geen sessietoken terug.");
  }

  const sessionToken = textFrom(data.SessionToken);

  if (scope === "labor") {
    cachedTamigoLaborSessionToken = sessionToken;
    return cachedTamigoLaborSessionToken;
  }

  cachedTamigoSessionToken = sessionToken;

  return cachedTamigoSessionToken;
}

function createTamigoUrl(path: string, params?: Record<string, string>) {
  const baseUrl = TAMIGO_API_BASE_URL.endsWith("/")
    ? TAMIGO_API_BASE_URL
    : `${TAMIGO_API_BASE_URL}/`;
  const url = new URL(path.replace(/^\//, ""), baseUrl);

  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }

  return url;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function boolFrom(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function numberFrom(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (!isRecord(data)) return fallback;

  return (
    textFrom(data.message) ||
    textFrom(data.Message) ||
    textFrom(data.error) ||
    textFrom(data.Error) ||
    fallback
  );
}

async function tamigoGet(
  path: string,
  params?: Record<string, string>,
  scope: TamigoAuthScope = "default"
) {
  const response = await fetch(createTamigoUrl(path, params), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-tamigo-token": await getTamigoAccessToken(scope),
    },
    cache: "no-store",
  });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    const authorizationMessage =
      response.status === 401 && !getTamigoApplicationName(scope)
        ? "Tamigo API authorisatie mislukt. Als dit een application key is, stel ook de bijbehorende applicatienaam in."
        : "Tamigo API-verzoek is mislukt.";

    throw new TamigoApiError(
      getErrorMessage(data, authorizationMessage),
      response.status
    );
  }

  if (!data) {
    throw new TamigoApiError("Tamigo gaf geen geldige JSON terug.");
  }

  return data;
}

function getArrayRecords(data: unknown) {
  if (Array.isArray(data)) return data.filter(isRecord);

  if (!isRecord(data)) return [];

  for (const key of ["Employees", "employees", "Data", "data", "Result", "result"]) {
    const value = data[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }

  return [];
}

function toSimpleEmployee(value: JsonRecord): TamigoSimpleEmployee {
  return {
    EmployeeId: textFrom(value.EmployeeId),
    Name: textFrom(value.Name),
    Email: textFrom(value.Email),
    IsEnabled: boolFrom(value.IsEnabled),
    EndDate: textFrom(value.EndDate),
  };
}

function toDetailedEmployee(value: JsonRecord): TamigoDetailedEmployee {
  return {
    EmployeeId: textFrom(value.EmployeeId),
    Name: textFrom(value.Name),
    Email: textFrom(value.Email),
    WageNumber: textFrom(value.WageNumber),
    EmployerNumber: textFrom(value.EmployerNumber),
    CurrentPaymentModel: textFrom(value.CurrentPaymentModel),
    CurrentWageRateType: textFrom(value.CurrentWageRateType),
    HistoricalWages: getArrayRecords(value.HistoricalWages).map(
      toTamigoHistoricalWage
    ),
    WageRateTypes: getArrayRecords(value.WageRateTypes).map(
      toTamigoWageRateType
    ),
    StandardHours: numberFrom(value.StandardHours),
    ContractHours: getArrayRecords(value.ContractHours).map(
      toTamigoContractHours
    ),
    From: textFrom(value.From),
    To: textFrom(value.To),
    Birthdate: textFrom(value.Birthdate),
    DeletedOn: textFrom(value.DeletedOn),
    IsActive: boolFrom(value.IsActive),
    IsUserEnabled: boolFrom(value.IsUserEnabled),
  };
}

function toTamigoHistoricalWage(value: JsonRecord): TamigoHistoricalWage {
  return {
    StartDate: textFrom(value.StartDate),
    Wage: numberFrom(value.Wage),
  };
}

function toTamigoWageRateType(value: JsonRecord): TamigoWageRateType {
  return {
    StartDate: textFrom(value.StartDate),
    EndDate: textFrom(value.EndDate),
    PaymentModel: textFrom(value.PaymentModel),
    WageRateTypeName: textFrom(value.WageRateTypeName),
  };
}

function toTamigoContractHours(value: JsonRecord): TamigoContractHours {
  return {
    StartDate: textFrom(value.StartDate),
    EndDate: textFrom(value.EndDate),
    ContractHours: numberFrom(value.ContractHours),
    ContractHoursMonthly: numberFrom(value.ContractHoursMonthly),
  };
}

function toTamigoShift(value: JsonRecord): TamigoShift {
  return {
    ShiftId: textFrom(value.ShiftId),
    EmployeeId: textFrom(value.EmployeeId),
    EmployeeName: textFrom(value.EmployeeName),
    DepartmentId: textFrom(value.DepartmentId),
    DepartmentName: textFrom(value.DepartmentName),
    DepartmentKey: textFrom(value.DepartmentKey),
    Comments: textFrom(value.Comments),
    Comments2: textFrom(value.Comments2),
    StartDateTime: textFrom(value.StartDateTime),
    EndDateTime: textFrom(value.EndDateTime),
    Date: textFrom(value.Date),
    StartDate: textFrom(value.StartDate),
    EndDate: textFrom(value.EndDate),
    ShiftActivityName: textFrom(value.ShiftActivityName),
    ShiftActivityShortName: textFrom(value.ShiftActivityShortName),
    AbsencePercentage: numberFrom(value.AbsencePercentage),
    IsProductive: boolFrom(value.IsProductive),
    ShiftHours: numberFrom(value.ShiftHours),
    BreakCodeHours: numberFrom(value.BreakCodeHours),
  };
}

function toTamigoLeavePerDay(value: JsonRecord): TamigoLeavePerDay {
  return {
    Date: textFrom(value.Date),
    WageSystemKey: textFrom(value.WageSystemKey),
    Name: textFrom(value.Name),
    AbsenceType: textFrom(value.AbsenceType),
  };
}

export async function fetchTamigoEmployeesPage(page = 0) {
  const data = await tamigoGet("/v2/Employees/", {
    page: String(page),
  });

  return getArrayRecords(data).map(toSimpleEmployee);
}

async function fetchTamigoEmployeeDetailsPage(page = 0) {
  const data = await tamigoGet(
    "/v2/Employees/GetEmployeeDetails/",
    {
      page: String(page),
      includedeleted: "false",
    },
    "labor"
  );

  return getArrayRecords(data).map(toDetailedEmployee);
}

export async function testTamigoEmployeeConnection() {
  const employees = await fetchTamigoEmployeesPage(1);

  return {
    ok: true,
    employeeCountOnFirstPage: employees.length,
  };
}

async function fetchTamigoEmployeeDetails() {
  const employees: TamigoDetailedEmployee[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < TAMIGO_MAX_EMPLOYEE_PAGES; page += 1) {
    const pageEmployees = await fetchTamigoEmployeeDetailsPage(page);
    let addedCount = 0;

    for (const employee of pageEmployees) {
      const key = getEmployeeIdentity(employee);
      if (seen.has(key)) continue;

      seen.add(key);
      employees.push(employee);
      addedCount += 1;
    }

    if (pageEmployees.length === 0 || addedCount === 0) break;
  }

  return employees;
}

function getEmployeeIdentity(employee: TamigoDetailedEmployee) {
  return (
    employee.EmployeeId ||
    employee.WageNumber ||
    employee.EmployerNumber ||
    employee.Email ||
    employee.Name ||
    "unknown"
  );
}

function isActiveEmployee(employee: TamigoDetailedEmployee, today: Date) {
  if (employee.DeletedOn) return false;
  if (employee.IsActive === false) return false;
  if (employee.IsUserEnabled === false) return false;

  const startDate = parseDateOnly(employee.From);
  if (startDate && startDate > today) return false;

  const endDate = parseDateOnly(employee.To);
  if (!endDate) return true;

  endDate.setHours(23, 59, 59, 999);

  return endDate >= today;
}

function parseOffsetMinutes(value: string) {
  const match = value.match(/([+-])(\d{2})(\d{2})/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;

  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function parseDateOnly(value: string | undefined) {
  const text = textFrom(value);
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  const microsoftMatch = text.match(/^\/Date\((-?\d+)([+-]\d{4})?\)\/$/);
  if (microsoftMatch) {
    const timestamp =
      Number(microsoftMatch[1]) +
      parseOffsetMinutes(microsoftMatch[2] || "") * 60 * 1000;
    const date = new Date(timestamp);

    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function getAmsterdamDate(offsetDays = 0, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AMSTERDAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const dateParts = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const date = new Date(
    Date.UTC(
      Number(dateParts.year),
      Number(dateParts.month) - 1,
      Number(dateParts.day) + offsetDays
    )
  );

  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseDateString(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function addDaysToDateString(value: string, days: number) {
  const date = parseDateString(value);
  if (!date) return value;

  date.setUTCDate(date.getUTCDate() + days);

  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function getAmsterdamWeekStartDate(weekOffset = 0, now = new Date()) {
  const today = getAmsterdamDate(0, now);
  const date = parseDateString(today) || new Date();
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return addDaysToDateString(today, mondayOffset + weekOffset * 7);
}

function getIsoWeekStartDate(year: number, week: number) {
  const clampedWeek = Math.max(1, Math.min(53, Math.trunc(week)));
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (clampedWeek - 1) * 7);

  return formatDate(
    jan4.getUTCFullYear(),
    jan4.getUTCMonth() + 1,
    jan4.getUTCDate()
  );
}

function createDateRange(from: string, to: string) {
  const dates: string[] = [];
  let current = from;

  for (let index = 0; index < 14 && current < to; index += 1) {
    dates.push(current);
    current = addDaysToDateString(current, 1);
  }

  return dates;
}

function formatDateLabel(value: string, options: Intl.DateTimeFormatOptions) {
  const date = parseDateString(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "UTC",
    ...options,
  }).format(date);
}

function getTamigoDateOnly(value: string | undefined) {
  const text = textFrom(value);
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const date = parseTamigoDateTime(text);
  if (!date) return "";

  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseTamigoDateTime(value: string | undefined) {
  const text = textFrom(value);
  if (!text) return null;

  const microsoftMatch = text.match(/^\/Date\((-?\d+)([+-]\d{4})?\)\/$/);
  if (microsoftMatch) {
    const date = new Date(Number(microsoftMatch[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatAmsterdamTime(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: AMSTERDAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getTamigoTime(value: string | undefined) {
  const text = textFrom(value);
  if (!text) return "";

  const date = parseTamigoDateTime(text);
  if (date) return formatAmsterdamTime(date);

  const isoTimeMatch = text.match(/T(\d{1,2}):(\d{2})/);
  if (isoTimeMatch) {
    return `${isoTimeMatch[1].padStart(2, "0")}:${isoTimeMatch[2]}`;
  }

  const timeMatch = text.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  }

  return "";
}

function getShiftDate(shift: TamigoShift) {
  return (
    getTamigoDateOnly(shift.StartDateTime) ||
    getTamigoDateOnly(shift.Date) ||
    getTamigoDateOnly(shift.StartDate)
  );
}

function createShiftTime(shift: TamigoShift): TodayStaffShiftTime | null {
  const startTime = getTamigoTime(shift.StartDateTime);
  const endTime = getTamigoTime(shift.EndDateTime);

  if (!startTime || !endTime) return null;

  return {
    startTime,
    endTime,
    timeLabel: `${startTime}–${endTime}`,
  };
}

function normalizeAbsenceText(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "");
}

function getAbsenceType(label: string): StaffAbsenceType {
  const normalized = normalizeAbsenceText(label);

  if (normalized.includes("ziek")) return "sick";
  if (
    normalized.includes("vakantie") ||
    normalized.includes("verlof") ||
    normalized.includes("snipper")
  ) {
    return "vacation";
  }

  return "absence";
}

function getAbsenceLabel(type: StaffAbsenceType) {
  if (type === "sick") return "Ziek";
  if (type === "vacation") return "Vakantie";

  return "Afwezig";
}

function getShiftAbsenceText(shift: TamigoShift) {
  return textFrom(shift.ShiftActivityName) || textFrom(shift.ShiftActivityShortName);
}

function isAbsenceShift(shift: TamigoShift) {
  const absenceText = getShiftAbsenceText(shift);
  if (!absenceText) return false;
  const normalized = normalizeAbsenceText(absenceText);

  return (
    getAbsenceType(absenceText) !== "absence" ||
    normalized.includes("afwezig") ||
    Boolean(shift.AbsencePercentage && shift.AbsencePercentage > 0)
  );
}

function toStaffAbsenceFromShift(
  department: ShopDepartment,
  shift: TamigoShift
): TodayStaffAbsence | null {
  const employeeName = textFrom(shift.EmployeeName);
  const absenceText = getShiftAbsenceText(shift);
  if (!employeeName || !absenceText) return null;

  const type = getAbsenceType(absenceText);

  return {
    id: `absence-${createHash(
      `${department.shop}-${toTodayStaffPersonKey(shift)}-${getShiftDate(shift)}-${type}`
    )}`,
    employeeName,
    type,
    label: getAbsenceLabel(type),
  };
}

function toStaffAbsenceFromLeave(
  department: ShopDepartment,
  leave: TamigoLeavePerDay
): TodayStaffAbsence | null {
  const employeeName = textFrom(leave.Name);
  const absenceText = textFrom(leave.AbsenceType);
  if (!employeeName || !absenceText) return null;

  const type = getAbsenceType(absenceText);

  return {
    id: `absence-${createHash(
      `${department.shop}-${leave.WageSystemKey || employeeName}-${getTamigoDateOnly(
        leave.Date
      )}-${type}`
    )}`,
    employeeName,
    type,
    label: getAbsenceLabel(type),
  };
}

function sortAbsences(absences: TodayStaffAbsence[]) {
  return [...absences].sort((a, b) => {
    const typeDiff = a.type.localeCompare(b.type);
    if (typeDiff !== 0) return typeDiff;

    return a.employeeName.localeCompare(b.employeeName);
  });
}

function dedupeAbsences(absences: TodayStaffAbsence[]) {
  const seen = new Set<string>();

  return sortAbsences(
    absences.filter((absence) => {
      const key = `${absence.employeeName.toLowerCase()}-${absence.type}`;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
  );
}

async function fetchShiftsForDepartment(
  department: ShopDepartment,
  from: string,
  to: string
) {
  const data = await tamigoGet("/v2/Shifts/", {
    from,
    to,
    departmentId: department.departmentId,
    shiftStatus: "planned",
  });

  return getArrayRecords(data)
    .map(toTamigoShift)
    .filter((shift) => shift.DepartmentId === department.departmentId);
}

async function fetchLeaveForDepartment(
  department: ShopDepartment,
  from: string,
  to: string
) {
  const data = await tamigoGet("/v2/Leave/ByDate/", {
    departmentId: department.departmentId,
    startDate: from,
    endDate: to,
  });

  return getArrayRecords(data).map(toTamigoLeavePerDay);
}

function toTodayStaffPersonKey(shift: TamigoShift) {
  return textFrom(shift.EmployeeId) || textFrom(shift.EmployeeName);
}

function toTodayStaffShop(
  department: ShopDepartment,
  shifts: TamigoShift[],
  absences: TodayStaffAbsence[] = []
): TodayStaffShop {
  const people = new Map<string, TodayStaffPerson>();

  for (const shift of shifts) {
    const employeeName = textFrom(shift.EmployeeName);
    const shiftTime = createShiftTime(shift);

    if (!employeeName || !shiftTime) continue;

    const key = toTodayStaffPersonKey(shift);
    const existing = people.get(key);

    if (existing) {
      existing.shifts.push(shiftTime);
      continue;
    }

    people.set(key, {
      id: `staff-${createHash(`${department.shop}-${key}`)}`,
      employeeName,
      shifts: [shiftTime],
    });
  }

  const employees = [...people.values()]
    .map((person) => ({
      ...person,
      shifts: [...person.shifts].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    }))
    .sort((a, b) => {
      const timeDiff = (a.shifts[0]?.startTime || "").localeCompare(
        b.shifts[0]?.startTime || ""
      );
      if (timeDiff !== 0) return timeDiff;

      return a.employeeName.localeCompare(b.employeeName);
    });

  return {
    shop: department.shop,
    departmentName: department.departmentName,
    employees,
    absences: dedupeAbsences(absences),
  };
}

function normalizeIceLocationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function getIceShiftShop(shift: TamigoShift): ShopName | null {
  const locationText = normalizeIceLocationText(
    [shift.Comments, shift.Comments2].filter(Boolean).join(" ")
  );

  if (!locationText) return null;

  for (const [shop, aliases] of Object.entries(ICE_SHIFT_LOCATION_ALIASES)) {
    if (
      aliases.some((alias) =>
        locationText.includes(normalizeIceLocationText(alias))
      )
    ) {
      return shop as ShopName;
    }
  }

  return null;
}

function toIceEmployeesByShop(date: string, shifts: TamigoShift[]) {
  const shiftsByShop = new Map<ShopName, TamigoShift[]>(
    SHOP_DEPARTMENTS.map((department) => [department.shop, []])
  );

  shifts.forEach((shift) => {
    if (getShiftDate(shift) !== date || isAbsenceShift(shift)) return;

    const shop = getIceShiftShop(shift);
    if (!shop) return;

    shiftsByShop.get(shop)?.push(shift);
  });

  return Object.fromEntries(
    SHOP_DEPARTMENTS.map((department) => {
      const iceDepartment = {
        ...ICE_LOKET_DEPARTMENT,
        shop: department.shop,
      };

      return [
        department.shop,
        toTodayStaffShop(
          iceDepartment,
          shiftsByShop.get(department.shop) || []
        ).employees,
      ];
    })
  ) as Record<ShopName, TodayStaffPerson[]>;
}

function toDepartmentDaySchedule(
  department: ShopDepartment,
  date: string,
  shifts: TamigoShift[],
  leaves: TamigoLeavePerDay[]
) {
  const dayShifts = shifts.filter((shift) => getShiftDate(shift) === date);
  const workingShifts = dayShifts.filter((shift) => !isAbsenceShift(shift));
  const absenceShifts = dayShifts.flatMap((shift) => {
    if (!isAbsenceShift(shift)) return [];

    const absence = toStaffAbsenceFromShift(department, shift);
    return absence ? [absence] : [];
  });
  const leaveAbsences = leaves.flatMap((leave) => {
    if (getTamigoDateOnly(leave.Date) !== date) return [];

    const absence = toStaffAbsenceFromLeave(department, leave);
    return absence ? [absence] : [];
  });

  return toTodayStaffShop(department, workingShifts, [
    ...leaveAbsences,
    ...absenceShifts,
  ]);
}

function emptyLaborCostTotals(): LaborCostTotals {
  return {
    shifts: 0,
    hours: 0,
    cost: 0,
    directHourlyHours: 0,
    directHourlyCost: 0,
    derivedMonthlyHours: 0,
    derivedMonthlyCost: 0,
    missingHours: 0,
    missingShifts: 0,
    missingEmployeeShifts: 0,
    missingWageShifts: 0,
  };
}

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function normalizeLaborCostTotals<T extends LaborCostTotals>(totals: T): T {
  return {
    ...totals,
    hours: roundHours(totals.hours),
    cost: roundMoney(totals.cost),
    directHourlyHours: roundHours(totals.directHourlyHours),
    directHourlyCost: roundMoney(totals.directHourlyCost),
    derivedMonthlyHours: roundHours(totals.derivedMonthlyHours),
    derivedMonthlyCost: roundMoney(totals.derivedMonthlyCost),
    missingHours: roundHours(totals.missingHours),
  };
}

function addLaborCostTotals(target: LaborCostTotals, source: LaborCostTotals) {
  target.shifts += source.shifts;
  target.hours += source.hours;
  target.cost += source.cost;
  target.directHourlyHours += source.directHourlyHours;
  target.directHourlyCost += source.directHourlyCost;
  target.derivedMonthlyHours += source.derivedMonthlyHours;
  target.derivedMonthlyCost += source.derivedMonthlyCost;
  target.missingHours += source.missingHours;
  target.missingShifts += source.missingShifts;
  target.missingEmployeeShifts += source.missingEmployeeShifts;
  target.missingWageShifts += source.missingWageShifts;
}

function createEmptyLaborCostShop(department: ShopDepartment): LaborCostShop {
  return {
    shop: department.shop,
    departmentName: department.departmentName,
    ...emptyLaborCostTotals(),
  };
}

function getShiftHours(shift: TamigoShift) {
  const shiftHours = numberFrom(shift.ShiftHours);
  if (shiftHours && shiftHours > 0) return shiftHours;

  const start = parseTamigoDateTime(shift.StartDateTime);
  const end = parseTamigoDateTime(shift.EndDateTime);
  if (!start || !end) return 0;

  const rawHours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
  const breakHours = numberFrom(shift.BreakCodeHours) || 0;

  return Math.max(0, rawHours - breakHours);
}

function isDateInHistoryRange(
  startDateText: string | undefined,
  endDateText: string | undefined,
  date: Date
) {
  const startDate = parseDateOnly(startDateText);
  if (startDate && startDate > date) return false;

  const endDate = parseDateOnly(endDateText);
  if (!endDate) return true;

  endDate.setHours(23, 59, 59, 999);

  return endDate >= date;
}

function getApplicableWage(
  employee: TamigoDetailedEmployee,
  shiftDate: string
) {
  const date = parseDateOnly(shiftDate);
  if (!date) return null;

  const wages = (employee.HistoricalWages || [])
    .filter((wage) => {
      if (!Number.isFinite(wage.Wage)) return false;

      const startDate = parseDateOnly(wage.StartDate);
      return !startDate || startDate <= date;
    })
    .sort((a, b) =>
      (b.StartDate || "").localeCompare(a.StartDate || "")
    );

  return wages[0] || null;
}

function getApplicableWageRateType(
  employee: TamigoDetailedEmployee,
  shiftDate: string
) {
  const date = parseDateOnly(shiftDate);
  if (!date) return null;

  return (
    (employee.WageRateTypes || []).find((wageRateType) =>
      isDateInHistoryRange(wageRateType.StartDate, wageRateType.EndDate, date)
    ) || null
  );
}

function getApplicableWeeklyContractHours(
  employee: TamigoDetailedEmployee,
  shiftDate: string
) {
  const date = parseDateOnly(shiftDate);
  if (!date) return employee.StandardHours || 0;

  const contract = (employee.ContractHours || []).find((item) =>
    isDateInHistoryRange(item.StartDate, item.EndDate, date)
  );
  const weeklyHours = numberFrom(contract?.ContractHours);
  if (weeklyHours && weeklyHours > 0) return weeklyHours;

  const monthlyHours = numberFrom(contract?.ContractHoursMonthly);
  if (monthlyHours && monthlyHours > 0) return (monthlyHours * 12) / 52;

  return employee.StandardHours || 0;
}

function getEmployeePaymentModel(
  employee: TamigoDetailedEmployee,
  shiftDate: string
) {
  return (
    textFrom(getApplicableWageRateType(employee, shiftDate)?.PaymentModel) ||
    textFrom(employee.CurrentPaymentModel)
  );
}

function getShiftHourlyRate(
  employee: TamigoDetailedEmployee,
  shiftDate: string
):
  | {
      hourlyRate: number;
      basis: "hourly" | "monthlyDerived";
    }
  | null {
  const wage = getApplicableWage(employee, shiftDate);
  const wageValue = wage?.Wage;

  if (!Number.isFinite(wageValue) || !wageValue || wageValue <= 0) {
    return null;
  }

  const paymentModel = getEmployeePaymentModel(employee, shiftDate).toLowerCase();
  const monthlyModel = paymentModel.includes("month");

  if (!monthlyModel) {
    return {
      hourlyRate: wageValue,
      basis: "hourly",
    };
  }

  if (wageValue <= 100) {
    return {
      hourlyRate: wageValue,
      basis: "hourly",
    };
  }

  const weeklyContractHours = getApplicableWeeklyContractHours(employee, shiftDate);
  if (!weeklyContractHours || weeklyContractHours <= 0) return null;

  return {
    hourlyRate: wageValue / ((weeklyContractHours * 52) / 12),
    basis: "monthlyDerived",
  };
}

function addShiftToLaborCostTotals(
  totals: LaborCostTotals,
  shift: TamigoShift,
  employeeById: Map<string, TamigoDetailedEmployee>
) {
  const hours = getShiftHours(shift);
  if (hours <= 0) return;

  totals.shifts += 1;
  totals.hours += hours;

  const employee = employeeById.get(textFrom(shift.EmployeeId));
  if (!employee) {
    addMissingLaborCost(totals, hours, "missingEmployee");
    return;
  }

  const shiftDate = getShiftDate(shift);
  const rate = getShiftHourlyRate(employee, shiftDate);
  if (!rate) {
    addMissingLaborCost(totals, hours, "missingWage");
    return;
  }

  const cost = hours * rate.hourlyRate;
  totals.cost += cost;

  if (rate.basis === "monthlyDerived") {
    totals.derivedMonthlyHours += hours;
    totals.derivedMonthlyCost += cost;
    return;
  }

  totals.directHourlyHours += hours;
  totals.directHourlyCost += cost;
}

function addMissingLaborCost(
  totals: LaborCostTotals,
  hours: number,
  reason: LaborCostReason
) {
  totals.missingHours += hours;
  totals.missingShifts += 1;

  if (reason === "missingEmployee") {
    totals.missingEmployeeShifts += 1;
    return;
  }

  totals.missingWageShifts += 1;
}

async function fetchDepartmentSchedule(
  department: ShopDepartment,
  from: string,
  to: string
) {
  const [shifts, leaves] = await Promise.all([
    fetchShiftsForDepartment(department, from, to),
    fetchLeaveForDepartment(department, from, to),
  ]);

  return { department, shifts, leaves };
}

function getMonthDay(date: Date) {
  return {
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function createOccurrenceDate(year: number, month: number, day: number) {
  if (month === 2 && day === 29) {
    const leapDate = new Date(year, 1, 29);
    if (leapDate.getMonth() === 1) return leapDate;

    return new Date(year, 1, 28);
  }

  return new Date(year, month - 1, day);
}

function getNextOccurrence(month: number, day: number, today: Date) {
  let occurrence = createOccurrenceDate(today.getFullYear(), month, day);
  occurrence.setHours(0, 0, 0, 0);

  if (occurrence < today) {
    occurrence = createOccurrenceDate(today.getFullYear() + 1, month, day);
    occurrence.setHours(0, 0, 0, 0);
  }

  return occurrence;
}

function getDaysUntil(occurrence: Date, today: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((occurrence.getTime() - today.getTime()) / millisecondsPerDay);
}

function createSafeId(value: string) {
  const safeValue =
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "employee";

  return `${safeValue}-${createHash(value)}`;
}

function createHash(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function createPersonnelEvent(
  employee: TamigoDetailedEmployee,
  type: PersonnelEventType,
  sourceDate: Date,
  today: Date
): PersonnelAgendaEvent | null {
  const employeeName = employee.Name?.trim();
  if (!employeeName) return null;

  const { month, day } = getMonthDay(sourceDate);
  const occurrence = getNextOccurrence(month, day, today);
  const occurrenceYear = occurrence.getFullYear();
  const years =
    type === "anniversary" ? occurrenceYear - sourceDate.getFullYear() : undefined;

  if (type === "anniversary" && (!years || years < 1)) {
    return null;
  }

  const identity = getEmployeeIdentity(employee);
  const baseId = createSafeId(`${identity}-${type}`);

  return {
    id: `tamigo-${type}-${baseId}`,
    type,
    employeeName,
    title:
      type === "birthday"
        ? `${employeeName} is jarig`
        : `${employeeName} ${years} jaar bij Strik`,
    date: formatDate(2000, month, day),
    occurrenceDate: formatDate(occurrenceYear, month, day),
    daysUntil: getDaysUntil(occurrence, today),
    month,
    day,
    years,
    source: "tamigo",
  };
}

export async function getPersonnelAgenda(): Promise<PersonnelAgenda> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const activeEmployees = (await fetchTamigoEmployeeDetails()).filter(
    (employee) => isActiveEmployee(employee, today)
  );
  const birthdays = activeEmployees.flatMap((employee) => {
    const birthdate = parseDateOnly(employee.Birthdate);
    if (!birthdate) return [];

    const event = createPersonnelEvent(employee, "birthday", birthdate, today);

    return event ? [event] : [];
  });
  const anniversaries = activeEmployees.flatMap((employee) => {
    const startDate = parseDateOnly(employee.From);
    if (!startDate) return [];

    const event = createPersonnelEvent(
      employee,
      "anniversary",
      startDate,
      today
    );

    return event ? [event] : [];
  });

  return {
    generatedAt: now.toISOString(),
    activeEmployeeCount: activeEmployees.length,
    birthdays: sortPersonnelEvents(birthdays),
    anniversaries: sortPersonnelEvents(anniversaries),
  };
}

export async function getUpcomingEmployeeEventCount(days = 7) {
  const maxDays = Math.max(0, days);
  const agenda = await getPersonnelAgenda();

  return [...agenda.birthdays, ...agenda.anniversaries].filter(
    (event) => event.daysUntil <= maxDays
  ).length;
}

function sortPersonnelEvents(events: PersonnelAgendaEvent[]) {
  return [...events].sort((a, b) => {
    const dateDiff = a.occurrenceDate.localeCompare(b.occurrenceDate);
    if (dateDiff !== 0) return dateDiff;

    return a.employeeName.localeCompare(b.employeeName);
  });
}

export async function getTodayStaffSchedule(): Promise<TodayStaffSchedule> {
  const now = new Date();
  const from = getAmsterdamDate(0, now);
  const to = getAmsterdamDate(1, now);
  const [departmentSchedules, iceShifts] = await Promise.all([
    Promise.all(
      SHOP_DEPARTMENTS.map((department) =>
        fetchDepartmentSchedule(department, from, to)
      )
    ),
    fetchShiftsForDepartment(ICE_LOKET_DEPARTMENT, from, to),
  ]);
  const iceEmployeesByShop = toIceEmployeesByShop(from, iceShifts);

  const shops = departmentSchedules.map(({ department, shifts, leaves }) =>
    ({
      ...toDepartmentDaySchedule(department, from, shifts, leaves),
      iceDepartmentName: ICE_LOKET_DEPARTMENT.departmentName,
      iceEmployees: iceEmployeesByShop[department.shop] || [],
    })
  );

  return {
    generatedAt: now.toISOString(),
    date: from,
    shops,
  };
}

export async function getWeekStaffSchedule(
  weekOffset = 0
): Promise<WeekStaffSchedule> {
  const now = new Date();
  const from = getAmsterdamWeekStartDate(weekOffset, now);
  const to = addDaysToDateString(from, 7);
  const dates = createDateRange(from, to);
  const departmentSchedules = await Promise.all(
    SHOP_DEPARTMENTS.map((department) =>
      fetchDepartmentSchedule(department, from, to)
    )
  );
  const days = dates.map(
    (date): WeekStaffDay => ({
      date,
      weekdayLabel: formatDateLabel(date, { weekday: "long" }),
      dateLabel: formatDateLabel(date, {
        day: "numeric",
        month: "short",
      }),
      shops: departmentSchedules.map(({ department, shifts, leaves }) =>
        toDepartmentDaySchedule(department, date, shifts, leaves)
      ),
    })
  );

  return {
    generatedAt: now.toISOString(),
    from,
    to,
    weekLabel: `${formatDateLabel(from, {
      day: "numeric",
      month: "short",
    })} - ${formatDateLabel(addDaysToDateString(to, -1), {
      day: "numeric",
      month: "short",
    })}`,
    shops: SHOP_DEPARTMENTS.map((department) => department.shop),
    days,
  };
}

export async function getWeekLaborCostSchedule(
  weekOffset = 0
): Promise<LaborCostSchedule> {
  const now = new Date();
  const from = getAmsterdamWeekStartDate(weekOffset, now);

  return getLaborCostScheduleFromWeekStart(from, now);
}

export async function getWeekLaborCostScheduleForIsoWeek(
  year: number,
  week: number
): Promise<LaborCostSchedule> {
  return getLaborCostScheduleFromWeekStart(
    getIsoWeekStartDate(Math.trunc(year), week),
    new Date()
  );
}

async function getLaborCostScheduleFromWeekStart(
  from: string,
  now: Date
): Promise<LaborCostSchedule> {
  const to = addDaysToDateString(from, 7);
  const dates = createDateRange(from, to);
  const [employees, departmentSchedules, iceShifts] = await Promise.all([
    fetchTamigoEmployeeDetails(),
    Promise.all(
      SHOP_DEPARTMENTS.map((department) =>
        fetchDepartmentSchedule(department, from, to)
      )
    ),
    fetchShiftsForDepartment(ICE_LOKET_DEPARTMENT, from, to),
  ]);
  const employeeById = new Map(
    employees.flatMap((employee) =>
      employee.EmployeeId ? [[employee.EmployeeId, employee] as const] : []
    )
  );
  let unassignedIceShifts = 0;

  const days = dates.map((date): LaborCostDay => {
    const shopsByName = new Map<ShopName, LaborCostShop>(
      SHOP_DEPARTMENTS.map((department) => [
        department.shop,
        createEmptyLaborCostShop(department),
      ])
    );

    for (const { department, shifts } of departmentSchedules) {
      const shopTotals = shopsByName.get(department.shop);
      if (!shopTotals) continue;

      for (const shift of shifts) {
        if (getShiftDate(shift) !== date || isAbsenceShift(shift)) continue;

        addShiftToLaborCostTotals(shopTotals, shift, employeeById);
      }
    }

    for (const shift of iceShifts) {
      if (getShiftDate(shift) !== date || isAbsenceShift(shift)) continue;

      const shop = getIceShiftShop(shift);
      if (!shop) {
        unassignedIceShifts += 1;
        continue;
      }

      const shopTotals = shopsByName.get(shop);
      if (!shopTotals) continue;

      addShiftToLaborCostTotals(shopTotals, shift, employeeById);
    }

    const shops = SHOP_DEPARTMENTS.map((department) =>
      normalizeLaborCostTotals(
        shopsByName.get(department.shop) || createEmptyLaborCostShop(department)
      )
    );
    const totals = emptyLaborCostTotals();

    for (const shop of shops) {
      addLaborCostTotals(totals, shop);
    }

    return {
      date,
      weekdayLabel: formatDateLabel(date, { weekday: "long" }),
      dateLabel: formatDateLabel(date, {
        day: "numeric",
        month: "short",
      }),
      shops,
      totals: normalizeLaborCostTotals(totals),
    };
  });
  const totals = emptyLaborCostTotals();

  for (const day of days) {
    addLaborCostTotals(totals, day.totals);
  }

  const normalizedTotals = normalizeLaborCostTotals(totals);
  const notes = [
    "Individuele uurlonen worden niet naar de browser gestuurd; alleen geaggregeerde totalen.",
    "Maandloon wordt omgerekend naar een uurbedrag op basis van contracturen in Tamigo.",
  ];

  if (normalizedTotals.missingHours > 0) {
    notes.push(
      `${normalizedTotals.missingHours.toLocaleString("nl-NL")} uur mist nog een medewerker- of loonmatch in Tamigo.`
    );
  }

  if (unassignedIceShifts > 0) {
    notes.push(
      `${unassignedIceShifts} IJsloket-diensten konden niet automatisch aan een winkel gekoppeld worden.`
    );
  }

  return {
    generatedAt: now.toISOString(),
    from,
    to,
    weekLabel: `${formatDateLabel(from, {
      day: "numeric",
      month: "short",
    })} - ${formatDateLabel(addDaysToDateString(to, -1), {
      day: "numeric",
      month: "short",
    })}`,
    shops: SHOP_DEPARTMENTS.map((department) => department.shop),
    days,
    totals: normalizedTotals,
    notes,
  };
}

export function toTeamAgendaEvents(events: PersonnelAgendaEvent[]) {
  const now = new Date().toISOString();

  return events.map(
    (event): TeamAgendaEvent => ({
      id: event.id,
      title: event.title,
      date: event.date,
      type: event.type,
      audience: "alle",
      description:
        event.type === "anniversary" && event.years
          ? `${event.years} jaar bij Strik`
          : "",
      recurringYearly: true,
      source: "tamigo",
      createdAt: now,
      updatedAt: now,
    })
  );
}

export function getTamigoStatusCode(error: unknown) {
  if (error instanceof TamigoConfigurationError) return 503;
  if (error instanceof TamigoApiError) return error.status || 502;

  return 502;
}
