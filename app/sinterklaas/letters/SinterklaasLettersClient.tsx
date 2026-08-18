"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteLetterOrder,
  fetchLetterOrders,
  saveLetterOrder,
  updateLetterOrder,
} from "../sinterklaasApi";
import type {
  ChocolateLetterChocolate,
  ChocolateLetterLine,
  ChocolateLetterOrder,
  ChocolateLetterSize,
  ChocolateLetterStyle,
} from "../types";

type Mode = "winkel" | "productie";

type LetterFormState = {
  customerName: string;
  customerEmail: string;
  phone: string;
  shop: string;
  pickupDate: string;
  pickupLocation: string;
  notes: string;
  sendCustomerEmail: boolean;
  lines: ChocolateLetterLine[];
};

const CHOCOLATES: { id: ChocolateLetterChocolate; label: string }[] = [
  { id: "melk", label: "Melk" },
  { id: "puur", label: "Puur" },
  { id: "wit", label: "Wit" },
  { id: "vegan-puur", label: "Vegan puur" },
];
const SIZES: { id: ChocolateLetterSize; label: string }[] = [
  { id: "klein", label: "Klein" },
  { id: "groot", label: "Groot" },
];
const STYLES: { id: ChocolateLetterStyle; label: string }[] = [
  { id: "spuit", label: "Spuit" },
  { id: "vorm", label: "Vorm" },
];
const SHOPS = ["Ziekerstraat", "Heyendaal", "Daalseweg", "Lent", "Malden"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentYear() {
  return String(new Date().getFullYear());
}

function yearFromDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : currentYear();
}

function createLine(): ChocolateLetterLine {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    letter: "S",
    chocolate: "melk",
    size: "groot",
    style: "spuit",
    quantity: 1,
    logo: false,
    notes: "",
  };
}

function createFormState(): LetterFormState {
  return {
    customerName: "",
    customerEmail: "",
    phone: "",
    shop: "Ziekerstraat",
    pickupDate: todayIso(),
    pickupLocation: "Ziekerstraat",
    notes: "",
    sendCustomerEmail: true,
    lines: [createLine()],
  };
}

function formStateFromOrder(order: ChocolateLetterOrder | null | undefined) {
  if (!order) return createFormState();

  return {
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    phone: order.phone,
    shop: order.shop || "Ziekerstraat",
    pickupDate: order.pickupDate || todayIso(),
    pickupLocation: order.pickupLocation || order.shop || "Ziekerstraat",
    notes: order.notes,
    sendCustomerEmail: order.sendCustomerEmail,
    lines:
      order.lines.length > 0
        ? order.lines.map((line) => ({ ...line }))
        : [createLine()],
  };
}

function formatDate(date: string) {
  if (!date) return "geen datum";

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function totalPieces(order: ChocolateLetterOrder) {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

function lineLabel(line: ChocolateLetterLine) {
  return `${line.quantity}x ${line.letter.toUpperCase()} ${line.size} ${line.style} ${line.chocolate}${
    line.logo ? " met logo" : ""
  }`;
}

function monthKey(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "zonder-datum";
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  if (key === "zonder-datum") return "Zonder datum";

  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}-01T12:00:00`));
}

function compareOrdersByPickupDate(
  a: ChocolateLetterOrder,
  b: ChocolateLetterOrder
) {
  if (!a.pickupDate && b.pickupDate) return 1;
  if (a.pickupDate && !b.pickupDate) return -1;

  return (
    a.pickupDate.localeCompare(b.pickupDate) ||
    a.customerName.localeCompare(b.customerName)
  );
}

function groupByMonth(orders: ChocolateLetterOrder[]) {
  const groups = new Map<string, ChocolateLetterOrder[]>();

  [...orders].sort(compareOrdersByPickupDate).forEach((order) => {
    const key = monthKey(order.pickupDate);
    groups.set(key, [...(groups.get(key) || []), order]);
  });

  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "zonder-datum") return 1;
    if (b === "zonder-datum") return -1;
    return a.localeCompare(b);
  });
}

function statusClasses(order: ChocolateLetterOrder) {
  if (order.pickedUp || order.status === "opgehaald") {
    return "bg-[#ece7de] text-[#6b645b]";
  }
  if (order.productionDone || order.status === "klaar") {
    return "bg-[#dcebd8] text-[#24551d]";
  }
  if (order.status === "geannuleerd") {
    return "bg-[#f4d6d0] text-[#9a3412]";
  }

  return "bg-[#fff3c4] text-[#705000]";
}

function statusLabel(order: ChocolateLetterOrder) {
  if (order.pickedUp || order.status === "opgehaald") return "Opgehaald";
  if (order.productionDone || order.status === "klaar") return "Klaar";
  if (order.status === "geannuleerd") return "Geannuleerd";

  return "Besteld";
}

function updateOrderList(
  orders: ChocolateLetterOrder[],
  nextOrder: ChocolateLetterOrder
) {
  return [nextOrder, ...orders.filter((order) => order.id !== nextOrder.id)].sort(
    compareOrdersByPickupDate
  );
}

function SummaryStrip({ orders }: Readonly<{ orders: ChocolateLetterOrder[] }>) {
  const totals = useMemo(() => {
    const map = new Map<string, { label: string; quantity: number }>();

    orders
      .filter((order) => !order.productionDone && order.status !== "geannuleerd")
      .forEach((order) => {
        order.lines.forEach((line) => {
          const key = [
            line.chocolate,
            line.size,
            line.style,
            line.letter.toUpperCase(),
            line.logo ? "logo" : "zonder-logo",
          ].join("-");
          const existing = map.get(key);
          const label = `${line.letter.toUpperCase()} · ${line.chocolate} · ${line.size} · ${line.style}${
            line.logo ? " · logo" : ""
          }`;
          map.set(key, {
            label,
            quantity: (existing?.quantity || 0) + line.quantity,
          });
        });
      });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);

  if (totals.length < 1) {
    return (
      <p className="rounded-lg border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
        Geen open chocoladeletters voor productie.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {totals.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between border border-[#e5d28a] bg-[#fff8d8] px-3 py-2"
        >
          <span className="text-sm font-black text-[#1a1815]">{item.label}</span>
          <span className="text-lg font-black text-[#5f3f00]">{item.quantity}</span>
        </div>
      ))}
    </div>
  );
}

function OrderRow({
  order,
  onToggleDone,
  onEdit,
  onDelete,
  updatingId,
  productionMode = false,
}: Readonly<{
  order: ChocolateLetterOrder;
  onToggleDone: (order: ChocolateLetterOrder) => void;
  onEdit: (order: ChocolateLetterOrder) => void;
  onDelete: (order: ChocolateLetterOrder) => void;
  updatingId: string;
  productionMode?: boolean;
}>) {
  const extraLines = [
    order.customerEmail && `E-mail: ${order.customerEmail}`,
    order.phone && `Telefoon: ${order.phone}`,
    order.shop && `Winkel: ${order.shop}`,
    order.customerConfirmationSentAt &&
      `Bevestiging: ${formatDateTime(order.customerConfirmationSentAt)}`,
    order.bakeryEmailSentAt &&
      `Bakkerijmail: ${formatDateTime(order.bakeryEmailSentAt)}`,
  ].filter(Boolean);
  const isDone = order.productionDone || order.status === "klaar";
  const doneAtLabel = order.productionDoneAt
    ? formatDateTime(order.productionDoneAt)
    : "";

  return (
    <article
      className={`border px-3 py-2 ${
        isDone
          ? "border-[#b7d8ad] bg-[#eef8ea]"
          : "border-[#e4ded5] bg-white"
      }`}
    >
      <div className="grid gap-3 lg:grid-cols-[9rem_minmax(0,1fr)_15rem]">
        <div
          className={`border-l-4 pl-2 ${
            isDone ? "border-[#24551d]" : "border-[#c3d3bc]"
          }`}
        >
          <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
            Ophaaldatum
          </p>
          <p className="text-base font-black text-[#1a1815]">
            {formatDate(order.pickupDate)}
          </p>
          <p className="text-xs font-bold text-[#6b645b]">
            {order.pickupLocation || order.shop || "geen locatie"}
          </p>
          {isDone && (
            <p className="mt-1 rounded bg-[#dcebd8] px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#24551d]">
              Klaar: {doneAtLabel || "datum onbekend"}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#1a1815] px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white">
              {order.code}
            </span>
            <h3 className="text-base font-black leading-tight text-[#1a1815]">
              {order.customerName}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.12em] ${statusClasses(order)}`}
            >
              {statusLabel(order)}
            </span>
            {order.customerConfirmationSentAt && (
              <span className="rounded-full bg-[#edf5fb] px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#31566b]">
                Bevestigd
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-black text-[#4d463d]">
            {totalPieces(order)} stuks
          </p>
          <p className="mt-1 text-xs font-semibold leading-snug text-[#6b645b]">
            {order.lines.map(lineLabel).join(" · ")}
          </p>
          {order.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[#4d463d]">
              {order.notes}
            </p>
          )}
          {extraLines.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs font-black text-[#24551d]">
                Extra gegevens
              </summary>
              <p className="mt-1 whitespace-pre-wrap border border-[#e4ded5] bg-[#faf8f5] px-2 py-1.5 text-xs font-bold leading-snug text-[#6b645b]">
                {extraLines.join("\n")}
              </p>
            </details>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-start gap-1.5 lg:justify-end">
          <button
            type="button"
            disabled={updatingId === order.id}
            onClick={() => onToggleDone(order)}
            className={`h-8 px-2 text-[0.68rem] font-black shadow-sm disabled:opacity-60 ${
              order.productionDone
                ? "border border-[#d9d2c9] bg-white text-[#6b645b]"
                : "bg-[#24551d] text-white"
            }`}
          >
            {updatingId === order.id
              ? "..."
              : order.productionDone
                ? "Zet open"
                : productionMode
                  ? "Afvinken"
                  : "Klaar"}
          </button>
          <button
            type="button"
            onClick={() => onEdit(order)}
            className="h-8 border border-[#d6e5d8] bg-[#f6faf4] px-2 text-[0.68rem] font-black text-[#24551d] shadow-sm"
          >
            Wijzig
          </button>
          <button
            type="button"
            disabled={updatingId === `${order.id}-delete`}
            onClick={() => onDelete(order)}
            className="h-8 border border-[#f1b8a8] bg-white px-2 text-[0.68rem] font-black text-[#9a3412] shadow-sm disabled:opacity-60"
          >
            {updatingId === `${order.id}-delete` ? "..." : "Verwijder"}
          </button>
        </div>
      </div>
    </article>
  );
}

function LetterOrderForm({
  initialOrder,
  onSaved,
  onCancel,
}: Readonly<{
  initialOrder?: ChocolateLetterOrder | null;
  onSaved: (order: ChocolateLetterOrder) => void;
  onCancel: () => void;
}>) {
  const [form, setForm] = useState<LetterFormState>(() =>
    formStateFromOrder(initialOrder)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(formStateFromOrder(initialOrder));
  }, [initialOrder]);

  function updateLine(id: string, patch: Partial<ChocolateLetterLine>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.id === id ? { ...line, ...patch } : line
      ),
    }));
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const customerName = form.customerName.trim();
    const lines = form.lines.filter(
      (line) => line.letter.trim() && line.quantity > 0
    );

    if (!customerName || lines.length < 1) {
      setMessage("Vul minimaal klantnaam en één letter in.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        customerName,
        year: form.pickupDate
          ? yearFromDate(form.pickupDate)
          : initialOrder?.year || currentYear(),
        status: (initialOrder?.status ||
          "besteld") as ChocolateLetterOrder["status"],
        lines: lines.map((line) => ({
          ...line,
          letter: line.letter.trim().toUpperCase(),
          quantity: Math.max(1, Math.round(line.quantity)),
        })),
      };
      const saved = initialOrder?.id
        ? await updateLetterOrder(initialOrder.id, payload)
        : await saveLetterOrder(payload);
      onSaved(saved);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Bestelling opslaan is mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submitOrder}
      className="space-y-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={form.customerName}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              customerName: event.target.value,
            }))
          }
          placeholder="Klantnaam"
          className="h-11 border border-[#e4ded5] bg-white px-3 text-sm font-bold outline-none"
        />
        <input
          value={form.customerEmail}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              customerEmail: event.target.value,
            }))
          }
          placeholder="E-mail klant"
          type="email"
          className="h-11 border border-[#e4ded5] bg-white px-3 text-sm font-bold outline-none"
        />
        <input
          value={form.phone}
          onChange={(event) =>
            setForm((current) => ({ ...current, phone: event.target.value }))
          }
          placeholder="Telefoon"
          className="h-11 border border-[#e4ded5] bg-white px-3 text-sm font-bold outline-none"
        />
        <input
          value={form.pickupDate}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              pickupDate: event.target.value,
            }))
          }
          type="date"
          className="h-11 border border-[#e4ded5] bg-white px-3 text-sm font-bold outline-none"
        />
        <select
          value={form.shop}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              shop: event.target.value,
              pickupLocation: event.target.value,
            }))
          }
          className="h-11 border border-[#e4ded5] bg-white px-3 text-sm font-bold outline-none"
        >
          {SHOPS.map((shop) => (
            <option key={shop} value={shop}>
              {shop}
            </option>
          ))}
        </select>
        <input
          value={form.pickupLocation}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              pickupLocation: event.target.value,
            }))
          }
          placeholder="Ophaallocatie"
          className="h-11 border border-[#e4ded5] bg-white px-3 text-sm font-bold outline-none"
        />
      </div>

      <div className="space-y-2">
        {form.lines.map((line, index) => (
          <div
            key={line.id}
            className="grid gap-2 border border-[#eadb8b] bg-white/75 p-2 sm:grid-cols-[4.5rem_6rem_6rem_6rem_5rem_1fr_2.5rem]"
          >
            <input
              value={line.letter}
              onChange={(event) =>
                updateLine(line.id, {
                  letter: event.target.value.toUpperCase().slice(0, 8),
                })
              }
              placeholder="Letter"
              className="h-10 border border-[#e4ded5] bg-white px-2 text-sm font-black uppercase outline-none"
            />
            <select
              value={line.chocolate}
              onChange={(event) =>
                updateLine(line.id, {
                  chocolate: event.target.value as ChocolateLetterChocolate,
                })
              }
              className="h-10 border border-[#e4ded5] bg-white px-2 text-sm font-bold outline-none"
            >
              {CHOCOLATES.map((chocolate) => (
                <option key={chocolate.id} value={chocolate.id}>
                  {chocolate.label}
                </option>
              ))}
            </select>
            <select
              value={line.size}
              onChange={(event) =>
                updateLine(line.id, {
                  size: event.target.value as ChocolateLetterSize,
                })
              }
              className="h-10 border border-[#e4ded5] bg-white px-2 text-sm font-bold outline-none"
            >
              {SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </select>
            <select
              value={line.style}
              onChange={(event) =>
                updateLine(line.id, {
                  style: event.target.value as ChocolateLetterStyle,
                })
              }
              className="h-10 border border-[#e4ded5] bg-white px-2 text-sm font-bold outline-none"
            >
              {STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
            <input
              value={line.quantity}
              onChange={(event) =>
                updateLine(line.id, { quantity: Number(event.target.value) })
              }
              type="number"
              min={1}
              className="h-10 border border-[#e4ded5] bg-white px-2 text-sm font-black outline-none"
            />
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-[#4d463d]">
              <input
                checked={line.logo}
                onChange={(event) =>
                  updateLine(line.id, { logo: event.target.checked })
                }
                type="checkbox"
                className="h-4 w-4"
              />
              Logo
            </label>
            <button
              type="button"
              disabled={form.lines.length === 1}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  lines: current.lines.filter((item) => item.id !== line.id),
                }))
              }
              className="h-10 border border-[#e4ded5] bg-white text-sm font-black disabled:opacity-40"
              aria-label={`Regel ${index + 1} verwijderen`}
            >
              x
            </button>
            <input
              value={line.notes}
              onChange={(event) =>
                updateLine(line.id, { notes: event.target.value })
              }
              placeholder="Opmerking bij deze regel"
              className="h-10 border border-[#e4ded5] bg-white px-2 text-sm font-bold outline-none sm:col-span-7"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() =>
            setForm((current) => ({
              ...current,
              lines: [...current.lines, createLine()],
            }))
          }
          className="h-10 border border-[#d7c168] bg-white px-3 text-sm font-black"
        >
          Regel toevoegen
        </button>
        <label className="flex items-center gap-2 text-sm font-bold text-[#4d463d]">
          <input
            checked={form.sendCustomerEmail}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sendCustomerEmail: event.target.checked,
              }))
            }
            type="checkbox"
            className="h-4 w-4"
          />
          Bevestiging naar klant mailen
        </label>
      </div>

      <textarea
        value={form.notes}
        onChange={(event) =>
          setForm((current) => ({ ...current, notes: event.target.value }))
        }
        placeholder="Algemene opmerkingen"
        rows={3}
        className="w-full border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold outline-none"
      />

      {message && (
        <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#5f3f00]">
          {message}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-[#e4ded5] pt-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 border border-[#e4ded5] bg-white px-4 text-sm font-black text-[#4d463d]"
        >
          Sluiten
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-10 bg-[#24551d] px-5 text-sm font-black text-white shadow-sm disabled:opacity-60"
        >
          {saving
            ? "Opslaan..."
            : initialOrder
              ? "Wijziging opslaan"
              : "Bestelling opslaan"}
        </button>
      </div>
    </form>
  );
}

function LetterOrderDialog({
  order,
  onClose,
  onSaved,
}: Readonly<{
  order: ChocolateLetterOrder | null;
  onClose: () => void;
  onSaved: (order: ChocolateLetterOrder) => void;
}>) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#1a1815]/45 px-3 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-6xl border border-[#d6e5d8] bg-[#faf8f5] p-3 shadow-2xl sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#e4ded5] pb-3">
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
              Chocoladeletters
            </p>
            <h2 className="text-xl font-black text-[#1a1815] sm:text-2xl">
              {order ? "Bestelling wijzigen" : "Bestelling toevoegen"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#e4ded5] bg-white text-xl font-black text-[#1a1815]"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        <LetterOrderForm
          key={order?.id || "new-letter-order"}
          initialOrder={order}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

export default function SinterklaasLettersClient({
  mode,
}: Readonly<{ mode: Mode }>) {
  const [year, setYear] = useState(() => currentYear());
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<ChocolateLetterOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ChocolateLetterOrder | null>(
    null
  );

  async function loadOrders(nextYear = year, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      setOrders(await fetchLetterOrders(nextYear, nextSearch));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Chocoladeletters ophalen is mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders(year, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("nl-NL");
    if (!term) return orders;

    return orders.filter((order) =>
      [
        order.customerName,
        order.code,
        order.pickupDate,
        order.pickupLocation,
        order.shop,
        order.lines.map(lineLabel).join(" "),
      ]
        .join(" ")
        .toLocaleLowerCase("nl-NL")
        .includes(term)
    );
  }, [orders, search]);

  async function toggleProductionDone(order: ChocolateLetterOrder) {
    const done = !order.productionDone;
    const nextStatus: ChocolateLetterOrder["status"] = done ? "klaar" : "besteld";
    setUpdatingId(order.id);
    setError("");
    try {
      const saved = await updateLetterOrder(order.id, {
        productionDone: done,
        productionDoneAt: done ? new Date().toISOString() : "",
        status: nextStatus,
      });
      setOrders((current) => updateOrderList(current, saved));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Status bijwerken is mislukt."
      );
    } finally {
      setUpdatingId("");
    }
  }

  function openNewOrderDialog() {
    setEditingOrder(null);
    setFormOpen(true);
  }

  function openEditOrderDialog(order: ChocolateLetterOrder) {
    setEditingOrder(order);
    setFormOpen(true);
  }

  function closeOrderDialog() {
    setFormOpen(false);
    setEditingOrder(null);
  }

  function handleSavedOrder(order: ChocolateLetterOrder) {
    setOrders((current) => updateOrderList(current, order));
    closeOrderDialog();
  }

  async function deleteOrder(order: ChocolateLetterOrder) {
    const confirmed = window.confirm(
      `Chocoladeletter bestelling van ${order.customerName} verwijderen?`
    );
    if (!confirmed) return;

    setUpdatingId(`${order.id}-delete`);
    setError("");
    try {
      await deleteLetterOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Chocoladeletter bestelling verwijderen is mislukt."
      );
    } finally {
      setUpdatingId("");
    }
  }

  const groupedOrders = groupByMonth(visibleOrders);

  return (
    <div className="space-y-4">
      <section className="border border-[#e4ded5] bg-white p-3 shadow-sm">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_8rem_7rem_13rem]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Zoek ordernummer, klant, datum of letter"
            className="h-10 border border-[#e4ded5] bg-[#faf8f5] px-3 text-sm font-bold outline-none"
          />
          <input
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-10 border border-[#e4ded5] bg-[#faf8f5] px-3 text-sm font-black outline-none"
          />
          <button
            type="button"
            onClick={() => void loadOrders(year, search)}
            className="h-10 bg-[#f7df83] px-3 text-sm font-black text-[#1a1815]"
          >
            Ververs
          </button>
          <button
            type="button"
            onClick={openNewOrderDialog}
            className="flex h-10 items-center justify-center gap-2 bg-[#24551d] px-3 text-sm font-black text-white"
          >
            <span
              className="flex h-6 w-6 items-center justify-center bg-white/20 text-lg leading-none"
              aria-hidden="true"
            >
              +
            </span>
            Toevoegen
          </button>
        </div>
      </section>

      {error && (
        <p className="border border-[#f1b8a8] bg-[#fff4ef] px-3 py-2 text-sm font-black text-[#9a3412]">
          {error}
        </p>
      )}

      {mode === "productie" && (
        <section>
          <h2 className="mb-2 text-lg font-black text-[#1a1815]">
            Productietotalen
          </h2>
          <SummaryStrip orders={visibleOrders} />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#1a1815]">
              {mode === "productie" ? "Productielijst" : "Bestellingen"}
            </h2>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b8278]">
              Gesorteerd op ophaaldatum
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#f2eee8] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#6b645b]">
            {visibleOrders.length} zichtbaar
          </span>
        </div>

        <div className="space-y-3">
          {loading && (
            <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
              Laden...
            </p>
          )}
          {!loading &&
            groupedOrders.map(([key, group]) => (
              <section key={key} className="border border-[#e4ded5] bg-white/65">
                <div className="flex items-center justify-between bg-[#dcebd8] px-3 py-1.5">
                  <h3 className="text-sm font-black capitalize text-[#1a1815]">
                    {monthLabel(key)}
                  </h3>
                  <span className="rounded-full bg-white/85 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#6b645b]">
                    {group.length} totaal
                  </span>
                </div>
                <div className="grid gap-1.5 p-2">
                  {group.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      onToggleDone={toggleProductionDone}
                      onEdit={openEditOrderDialog}
                      onDelete={(nextOrder) => void deleteOrder(nextOrder)}
                      updatingId={updatingId}
                      productionMode={mode === "productie"}
                    />
                  ))}
                </div>
              </section>
            ))}
          {!loading && visibleOrders.length < 1 && (
            <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
              Geen letterbestellingen gevonden.
            </p>
          )}
        </div>
      </section>

      {formOpen && (
        <LetterOrderDialog
          order={editingOrder}
          onClose={closeOrderDialog}
          onSaved={handleSavedOrder}
        />
      )}
    </div>
  );
}
