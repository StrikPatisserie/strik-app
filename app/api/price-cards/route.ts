import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasFullAccess } from "../../lib/auth/access";
import { getCurrentProfile } from "../../lib/auth/session";
import { readPriceCardState, writePriceCardState } from "../../lib/priceCardStorage";
import {
  isAllergenKey,
  isPriceCardCategory,
  normalizePriceCard,
  normalizePriceOptions,
  themeForCategory,
  type PriceCard,
  type PriceCardPrintItem,
  type PriceCardState,
} from "../../management/prijskaartjes/priceCardTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canManagePriceCards() {
  return hasFullAccess(await getCurrentProfile());
}

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stateResponse(state: PriceCardState) {
  return NextResponse.json(
    { state },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  if (!(await canManagePriceCards())) {
    return NextResponse.json({ message: "Geen toegang tot prijskaartjes." }, { status: 403 });
  }

  try {
    return stateResponse(await readPriceCardState());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Prijskaartjes laden is mislukt." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await canManagePriceCards())) {
    return NextResponse.json({ message: "Geen toegang tot prijskaartjes." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Ongeldige invoer." }, { status: 400 });
  }

  let state: PriceCardState;
  try {
    state = await readPriceCardState();
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Prijskaartjes laden is mislukt." },
      { status: 500 }
    );
  }

  const action = cleanText(body.action, 60);
  let nextState = state;

  if (action === "upsert-card") {
    const input = body.card && typeof body.card === "object"
      ? (body.card as Record<string, unknown>)
      : null;
    const name = cleanText(input?.name, 120);
    const requestedPriceOptions = Array.isArray(input?.priceOptions) ? input.priceOptions : [];
    const priceOptions = normalizePriceOptions(requestedPriceOptions);
    if (requestedPriceOptions.length > 0 && priceOptions.length < 2) {
      return NextResponse.json(
        { message: "Vul minimaal twee complete opties met naam en prijs in." },
        { status: 400 }
      );
    }
    const priceCents = priceOptions[0]?.priceCents || Math.round(Number(input?.priceCents) || 0);
    if (!input || !name || priceCents <= 0) {
      return NextResponse.json(
        { message: "Naam en een geldige prijs zijn verplicht." },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const id = cleanText(input.id, 180) || `card-${randomUUID()}`;
    const existing = state.cards.find((card) => card.id === id);
    const category = isPriceCardCategory(input.category) ? input.category : "overig";
    const card: PriceCard = {
      id,
      name,
      legalName: cleanText(input.legalName, 100),
      description: cleanText(input.description, 320),
      priceCents,
      pricePrefix: cleanText(input.pricePrefix, 30),
      priceOptions,
      category,
      theme:
        input.theme === "sint" || input.theme === "kerst"
          ? input.theme
          : input.theme === "geen"
            ? "geen"
            : themeForCategory(category),
      allergens: Array.isArray(input.allergens)
        ? [...new Set(input.allergens.filter(isAllergenKey))]
        : [],
      sourcePath: cleanText(input.sourcePath, 500),
      sourceUrl: cleanText(input.sourceUrl, 700),
      sourceProductName: cleanText(input.sourceProductName, 160),
      sourceRecipeId: cleanText(input.sourceRecipeId, 180),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastPrintedAt: existing?.lastPrintedAt || "",
    };
    nextState = {
      ...state,
      cards: existing
        ? state.cards.map((item) => (item.id === id ? card : item))
        : [card, ...state.cards],
    };
  } else if (action === "delete-card") {
    const cardId = cleanText(body.cardId, 180);
    if (!cardId) {
      return NextResponse.json({ message: "Kaartje ontbreekt." }, { status: 400 });
    }
    nextState = { ...state, cards: state.cards.filter((card) => card.id !== cardId) };
  } else if (action === "create-session") {
    const requestedItems = Array.isArray(body.items) ? body.items : [];
    const items: PriceCardPrintItem[] = requestedItems.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const raw = value as Record<string, unknown>;
      const cardId = cleanText(raw.cardId, 180);
      const card = state.cards.find((entry) => entry.id === cardId);
      if (!card) return [];
      return [{
        cardId,
        quantity: Math.min(99, Math.max(1, Math.round(Number(raw.quantity) || 1))),
        card: normalizePriceCard(card) as PriceCard,
      }];
    });
    if (items.length === 0) {
      return NextResponse.json({ message: "Kies minimaal één kaartje." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const session = {
      id: `session-${randomUUID()}`,
      name: cleanText(body.name, 160) || `Printsessie ${new Intl.DateTimeFormat("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Amsterdam",
      }).format(new Date())}`,
      items,
      createdAt: now,
      printedAt: "",
      emailedAt: "",
      emailedTo: "",
    };
    nextState = { ...state, sessions: [session, ...state.sessions].slice(0, 100) };
  } else if (action === "mark-session-printed") {
    const sessionId = cleanText(body.sessionId, 180);
    const session = state.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      return NextResponse.json({ message: "Printsessie is niet gevonden." }, { status: 404 });
    }
    const now = new Date().toISOString();
    const printedCardIds = new Set(session.items.map((item) => item.cardId));
    nextState = {
      ...state,
      sessions: state.sessions.map((entry) =>
        entry.id === sessionId ? { ...entry, printedAt: now } : entry
      ),
      cards: state.cards.map((card) =>
        printedCardIds.has(card.id) ? { ...card, lastPrintedAt: now } : card
      ),
    };
  } else if (action === "delete-session") {
    const sessionId = cleanText(body.sessionId, 180);
    if (!sessionId) {
      return NextResponse.json({ message: "Printsessie ontbreekt." }, { status: 400 });
    }
    nextState = {
      ...state,
      sessions: state.sessions.filter((session) => session.id !== sessionId),
    };
  } else {
    return NextResponse.json({ message: "Onbekende actie." }, { status: 400 });
  }

  try {
    return stateResponse(await writePriceCardState(nextState));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Opslaan is mislukt." },
      { status: 500 }
    );
  }
}
