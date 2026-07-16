import {
  getPersonnelAgenda,
  getTamigoStatusCode,
  getUpcomingEmployeeEventCount,
  isImportantPersonnelJubilee,
  testTamigoEmployeeConnection,
  toTeamAgendaEvents,
} from "../../tamigoApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PersonnelAgendaView = "shop" | "management";

function getView(request: Request): PersonnelAgendaView {
  const url = new URL(request.url);

  return url.searchParams.get("view") === "management" ? "management" : "shop";
}

function getMode(request: Request) {
  return new URL(request.url).searchParams.get("mode") || "";
}

function getDays(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("days") || "7");

  if (!Number.isFinite(value)) return 7;

  return Math.max(0, Math.min(31, Math.round(value)));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Tamigo medewerkers ophalen is mislukt.";
}

export async function GET(request: Request) {
  try {
    if (getMode(request) === "connection") {
      return Response.json(await testTamigoEmployeeConnection());
    }

    if (getMode(request) === "upcoming-count") {
      const days = getDays(request);

      return Response.json({
        days,
        count: await getUpcomingEmployeeEventCount(days),
      });
    }

    const view = getView(request);
    const agenda = await getPersonnelAgenda();
    const shopAnniversaries = agenda.anniversaries.filter(
      isImportantPersonnelJubilee
    );
    const events =
      view === "management"
        ? [...agenda.birthdays, ...agenda.anniversaries]
        : [...agenda.birthdays, ...shopAnniversaries];
    const upcomingWithinWeek = events.filter((event) => event.daysUntil <= 7);

    return Response.json({
      view,
      generatedAt: agenda.generatedAt,
      activeEmployeeCount: agenda.activeEmployeeCount,
      events: toTeamAgendaEvents(events),
      personnelEvents: events,
      birthdays: agenda.birthdays,
      anniversaries: view === "management" ? agenda.anniversaries : [],
      upcomingWithinWeek: view === "management" ? upcomingWithinWeek : [],
      stats: {
        birthdays: agenda.birthdays.length,
        anniversaries:
          view === "management" ? agenda.anniversaries.length : 0,
        upcomingWithinWeek:
          view === "management" ? upcomingWithinWeek.length : 0,
      },
    });
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getTamigoStatusCode(error) }
    );
  }
}
