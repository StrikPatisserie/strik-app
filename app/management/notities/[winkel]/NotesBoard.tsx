"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NotesBoardData,
  createId,
  getEmptyNotesBoard,
  getNotesUrl,
  normalizeNotesBoard,
} from "../notesApi";

type NotesBoardProps = {
  winkel: string;
  winkelLabel: string;
};

function formatDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotesBoard({ winkel, winkelLabel }: NotesBoardProps) {
  const [board, setBoard] = useState<NotesBoardData>(() =>
    getEmptyNotesBoard(winkel)
  );
  const [newNote, setNewNote] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const hasLoadedRef = useRef(false);

  const openTodoCount = useMemo(
    () => board.todos.filter((todo) => !todo.done).length,
    [board.todos]
  );

  const completedTodoCount = board.todos.length - openTodoCount;

  function mutateBoard(updater: (current: NotesBoardData) => NotesBoardData) {
    setBoard((current) => updater(current));

    if (hasLoadedRef.current) {
      setRevision((current) => current + 1);
    }
  }

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setStatus("Notities laden...");

    try {
      const res = await fetch(getNotesUrl(winkel), { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setStatus("WordPress-notities zijn nog niet beschikbaar.");
        setBoard(getEmptyNotesBoard(winkel));
        return;
      }

      setBoard(normalizeNotesBoard(data, winkel));
      setStatus("");
    } catch {
      setStatus("Kan geen verbinding maken met WordPress.");
      setBoard(getEmptyNotesBoard(winkel));
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [winkel]);

  const saveBoard = useCallback(async (boardToSave: NotesBoardData) => {
    setSaving(true);
    setStatus("Opslaan...");

    try {
      const res = await fetch(getNotesUrl(winkel), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(boardToSave),
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setStatus("Opslaan in WordPress lukt nog niet.");
        return;
      }

      const savedBoard = normalizeNotesBoard(data, winkel);
      setBoard((current) => ({
        ...current,
        updatedAt: savedBoard.updatedAt,
      }));
      setStatus("Opgeslagen.");
    } catch {
      setStatus("Kan geen verbinding maken met WordPress.");
    } finally {
      setSaving(false);
    }
  }, [winkel]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadBoard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBoard]);

  useEffect(() => {
    if (!hasLoadedRef.current || revision === 0) return;

    const timeoutId = window.setTimeout(() => {
      saveBoard(board);
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [board, revision, saveBoard]);

  function addNote() {
    const text = newNote.trim();
    if (!text) return;

    mutateBoard((current) => ({
      ...current,
      notes: [
        {
          id: createId("note"),
          text,
          createdAt: new Date().toISOString(),
        },
        ...current.notes,
      ],
    }));
    setNewNote("");
  }

  function addTodo() {
    const text = newTodo.trim();
    if (!text) return;

    mutateBoard((current) => ({
      ...current,
      todos: [
        {
          id: createId("todo"),
          text,
          done: false,
          createdAt: new Date().toISOString(),
        },
        ...current.todos,
      ],
    }));
    setNewTodo("");
  }

  function updateNote(id: string, text: string) {
    mutateBoard((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === id ? { ...note, text } : note
      ),
    }));
  }

  function deleteNote(id: string) {
    mutateBoard((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== id),
    }));
  }

  function updateTodoText(id: string, text: string) {
    mutateBoard((current) => ({
      ...current,
      todos: current.todos.map((todo) =>
        todo.id === id ? { ...todo, text } : todo
      ),
    }));
  }

  function toggleTodo(id: string) {
    mutateBoard((current) => ({
      ...current,
      todos: current.todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      ),
    }));
  }

  function deleteTodo(id: string) {
    mutateBoard((current) => ({
      ...current,
      todos: current.todos.filter((todo) => todo.id !== id),
    }));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[#eef3ea] p-3">
            <p className="text-2xl font-bold">{board.notes.length}</p>
            <p className="text-xs font-semibold text-[#2d2a26]/55">Notities</p>
          </div>
          <div className="rounded-2xl bg-[#dbe9ee] p-3">
            <p className="text-2xl font-bold">{openTodoCount}</p>
            <p className="text-xs font-semibold text-[#2d2a26]/55">Open</p>
          </div>
          <div className="rounded-2xl bg-[#dce8d6] p-3">
            <p className="text-2xl font-bold">{completedTodoCount}</p>
            <p className="text-xs font-semibold text-[#2d2a26]/55">Af</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-gray-500">
          <span>{loading ? "Laden..." : status || "Alles bijgewerkt."}</span>
          {board.updatedAt && <span>{formatDate(board.updatedAt)}</span>}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
        <h2 className="text-xl font-bold">Nieuwe to-do</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTodo();
            }}
            placeholder={`To-do voor ${winkelLabel}`}
            className="min-w-0 flex-1 rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />
          <button
            onClick={addTodo}
            disabled={!newTodo.trim()}
            className="rounded-2xl bg-[#c3d3bc] px-4 font-bold disabled:opacity-50"
          >
            +
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">To-do&apos;s</h2>
          {saving && <span className="text-sm font-semibold text-gray-500">Opslaan...</span>}
        </div>

        {board.todos.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white/80 p-5 text-sm text-gray-600 shadow-sm">
            Nog geen to-do&apos;s voor {winkelLabel}.
          </div>
        ) : (
          board.todos.map((todo) => (
            <article
              key={todo.id}
              className={`rounded-[1.5rem] border p-4 shadow-sm ${
                todo.done
                  ? "border-[#d6e2cf] bg-[#eef3ea]"
                  : "border-[#e7e0d8] bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                  className="mt-3 h-5 w-5"
                />
                <input
                  value={todo.text}
                  onChange={(e) => updateTodoText(todo.id, e.target.value)}
                  className={`min-w-0 flex-1 rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm ${
                    todo.done ? "text-gray-500 line-through" : "text-[#2d2a26]"
                  }`}
                />
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="mt-1 rounded-full bg-[#f8f6f3] px-3 py-2 text-xs font-bold text-gray-500"
                >
                  Wis
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
        <h2 className="text-xl font-bold">Nieuwe notitie</h2>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={`Notitie voor ${winkelLabel}`}
          className="mt-3 min-h-28 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
        />
        <button
          onClick={addNote}
          disabled={!newNote.trim()}
          className="mt-3 w-full rounded-full bg-[#c3d3bc] p-4 font-bold disabled:opacity-50"
        >
          Notitie toevoegen
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Notities</h2>

        {board.notes.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white/80 p-5 text-sm text-gray-600 shadow-sm">
            Nog geen notities voor {winkelLabel}.
          </div>
        ) : (
          board.notes.map((note) => (
            <article
              key={note.id}
              className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 shadow-sm"
            >
              <textarea
                value={note.text}
                onChange={(e) => updateNote(note.id, e.target.value)}
                className="min-h-28 w-full resize-y rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3 text-sm leading-relaxed"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-500">
                  {formatDate(note.createdAt)}
                </span>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="rounded-full bg-[#f8f6f3] px-4 py-2 text-xs font-bold text-gray-500"
                >
                  Verwijderen
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
