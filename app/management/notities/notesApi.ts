export const NOTES_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/notes";
export const NOTES_API_KEY = "schoonmaak-ijs-strik";

export type NoteShop = {
  slug: string;
  label: string;
};

export type NoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

export type NotesBoardData = {
  winkel: string;
  notes: NoteItem[];
  todos: TodoItem[];
  updatedAt?: string;
};

export const noteShops: NoteShop[] = [
  { slug: "lent", label: "Lent" },
  { slug: "heyendaal", label: "Heyendaal" },
  { slug: "daalseweg", label: "Daalseweg" },
  { slug: "ziekerstraat", label: "Ziekerstraat" },
];

export function getNoteShop(slug: string) {
  return noteShops.find((shop) => shop.slug === slug);
}

export function getNotesUrl(winkel: string) {
  const url = new URL(NOTES_API_URL);
  url.searchParams.set("key", NOTES_API_KEY);
  url.searchParams.set("winkel", winkel);

  return url;
}

export function getEmptyNotesBoard(winkel: string): NotesBoardData {
  return {
    winkel,
    notes: [],
    todos: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNoteItem(value: unknown): NoteItem | null {
  if (!isRecord(value)) return null;

  const text = textFrom(value.text).trim();
  if (!text) return null;

  return {
    id: textFrom(value.id) || createId("note"),
    text,
    createdAt: textFrom(value.createdAt) || new Date().toISOString(),
  };
}

function normalizeTodoItem(value: unknown): TodoItem | null {
  if (!isRecord(value)) return null;

  const text = textFrom(value.text).trim();
  if (!text) return null;

  return {
    id: textFrom(value.id) || createId("todo"),
    text,
    done: Boolean(value.done),
    createdAt: textFrom(value.createdAt) || new Date().toISOString(),
  };
}

export function normalizeNotesBoard(
  value: unknown,
  winkel: string
): NotesBoardData {
  if (!isRecord(value)) return getEmptyNotesBoard(winkel);

  const notes = Array.isArray(value.notes)
    ? value.notes.flatMap((item) => {
        const note = normalizeNoteItem(item);
        return note ? [note] : [];
      })
    : [];

  const todos = Array.isArray(value.todos)
    ? value.todos.flatMap((item) => {
        const todo = normalizeTodoItem(item);
        return todo ? [todo] : [];
      })
    : [];

  return {
    winkel,
    notes,
    todos,
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
