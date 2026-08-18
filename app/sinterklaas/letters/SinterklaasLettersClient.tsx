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

type OnlineLetterImportRow = {
  id: string;
  sourceKey: string;
  batch: string;
  articleNumber: string;
  productName: string;
  pickupDate: string;
  letter: string;
  chocolate: ChocolateLetterChocolate;
  size: ChocolateLetterSize;
  style: ChocolateLetterStyle;
  quantity: number;
  notes: string;
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

function isoDateFromParts(day: string, month: string, year: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day + days, 12);

  return nextDate.toISOString().slice(0, 10);
}

function cleanImportKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function parseOnlineLetterProduct(productName: string) {
  const normalized = productName.toLocaleLowerCase("nl-NL");
  const chocolate: ChocolateLetterChocolate = normalized.includes("vegan")
    ? "vegan-puur"
    : normalized.includes("puur")
      ? "puur"
      : normalized.includes("wit")
        ? "wit"
        : "melk";
  const size: ChocolateLetterSize = normalized.includes("klein")
    ? "klein"
    : "groot";
  const style: ChocolateLetterStyle = normalized.includes("vorm")
    ? "vorm"
    : "spuit";

  return { chocolate, size, style };
}

function getOnlineImportWeekDates(text: string, yearOverride: string) {
  const weekMatch = text.match(
    /Week\s+([0-9]+)\s*\((\d{2})-(\d{2})-(\d{4})\s+t\/m\s+(\d{2})-(\d{2})-(\d{4})\)/i
  );
  const requestedYear = /^\d{4}$/.test(yearOverride.trim())
    ? yearOverride.trim()
    : "";
  const sourceYear = weekMatch?.[4] || currentYear();
  const importYear = requestedYear || sourceYear;
  const startDate = weekMatch
    ? isoDateFromParts(weekMatch[2], weekMatch[3], importYear)
    : todayIso();
  const dates = Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
  const batch = weekMatch
    ? `Week ${weekMatch[1]} (${dates[0]} t/m ${dates[6]})`
    : `Online import ${todayIso()}`;

  return { dates, batch };
}

function parseOnlineLetterImport(text: string, yearOverride: string) {
  const { dates, batch } = getOnlineImportWeekDates(text, yearOverride);
  const rows: OnlineLetterImportRow[] = [];
  const pendingNotes: string[] = [];

  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .forEach((line) => {
      if (
        /^(Productielijst|Week|Ma\s+Di|Afdrukdatum|Pagina|Totaal:?$|\d+\s+Chocolade)/i.test(
          line
        )
      ) {
        return;
      }

      if (/extra omschrijvingen|let op|lactose|noten/i.test(line)) {
        pendingNotes.push(line.replace(/^\*+/, "").trim());
        return;
      }

      const match = line.match(
        /^(\d{4}\.\d{3})\s+(.+?)\s+online\s+([A-Za-z])\s+(.*)$/i
      );
      if (!match) return;

      const dayQuantities = (match[4].match(/\b\d+\b/g) || [])
        .slice(0, 7)
        .map(Number);
      if (dayQuantities.length < 7) return;

      const articleNumber = match[1];
      const productName = match[2].trim();
      const letter = match[3].toUpperCase();
      const { chocolate, size, style } = parseOnlineLetterProduct(productName);
      const notes = [
        `Artikel ${articleNumber}`,
        productName,
        ...pendingNotes,
      ].join("\n");
      pendingNotes.length = 0;

      dayQuantities.forEach((quantity, index) => {
        if (quantity < 1) return;

        const pickupDate = dates[index];
        const sourceKey = cleanImportKey(
          [
            "online-letter",
            pickupDate,
            articleNumber,
            letter,
            chocolate,
            size,
            style,
          ].join("-")
        );

        rows.push({
          id: sourceKey,
          sourceKey,
          batch,
          articleNumber,
          productName,
          pickupDate,
          letter,
          chocolate,
          size,
          style,
          quantity,
          notes,
        });
      });
    });

  return rows;
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
    order.source === "online" && "Herkomst: online bestelling",
    order.sourceBatch && `Import: ${order.sourceBatch}`,
    order.sourceImportedAt &&
      `Laatst ingeladen: ${formatDateTime(order.sourceImportedAt)}`,
    order.customerEmail && `E-mail: ${order.customerEmail}`,
    order.phone && `Telefoon: ${order.phone}`,
    order.shop && `Winkel: ${order.shop}`,
    order.customerConfirmationSentAt &&
      `Bevestiging: ${formatDateTime(order.customerConfirmationSentAt)}`,
    order.bakeryEmailSentAt &&
      `Bakkerijmail: ${formatDateTime(order.bakeryEmailSentAt)}`,
  ].filter(Boolean);
  const isDone = order.productionDone || order.status === "klaar";
  const isOnline = order.source === "online";
  const doneAtLabel = order.productionDoneAt
    ? formatDateTime(order.productionDoneAt)
    : "";

  return (
    <article
      className={`border px-3 py-2 ${
        isDone
          ? "border-[#b7d8ad] bg-[#eef8ea]"
          : isOnline
            ? "border-[#b9d8eb] bg-[#f2f8fc]"
          : "border-[#e4ded5] bg-white"
      }`}
    >
      <div className="grid gap-3 lg:grid-cols-[9rem_minmax(0,1fr)_15rem]">
        <div
          className={`border-l-4 pl-2 ${
            isDone
              ? "border-[#24551d]"
              : isOnline
                ? "border-[#2f6f91]"
                : "border-[#c3d3bc]"
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
            {isOnline && (
              <span className="rounded-full bg-[#dceef8] px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2f6f91]">
                Online
              </span>
            )}
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

function OnlineImportDialog({
  text,
  year,
  importing,
  message,
  onTextChange,
  onYearChange,
  onClose,
  onImport,
}: Readonly<{
  text: string;
  year: string;
  importing: boolean;
  message: string;
  onTextChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onClose: () => void;
  onImport: (rows: OnlineLetterImportRow[]) => void;
}>) {
  const rows = useMemo(() => parseOnlineLetterImport(text, year), [text, year]);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const previewRows = rows.slice(0, 14);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#1a1815]/45 px-3 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-6xl border border-[#b9d8eb] bg-[#faf8f5] p-3 shadow-2xl sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#e4ded5] pb-3">
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
              Chocoladeletters
            </p>
            <h2 className="text-xl font-black text-[#1a1815] sm:text-2xl">
              Online weeklijst inladen
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

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <input
                value={year}
                onChange={(event) => onYearChange(event.target.value)}
                placeholder="Importjaar"
                className="h-10 border border-[#e4ded5] bg-white px-3 text-sm font-black outline-none"
              />
              <div className="flex items-center border border-[#e4ded5] bg-white px-3 text-sm font-bold text-[#6b645b]">
                {rows.length} regels · {totalQuantity} stuks
              </div>
            </div>
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="Plak de tekst van Productielijst Week Chocoladeletters"
              rows={18}
              className="w-full border border-[#e4ded5] bg-white px-3 py-2 text-sm font-semibold leading-relaxed outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="border border-[#b9d8eb] bg-[#f2f8fc] px-3 py-2">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#2f6f91]">
                Preview
              </p>
              <p className="text-sm font-bold text-[#4d463d]">
                Zelfde datum, artikel en letter wordt bij opnieuw importeren bijgewerkt.
              </p>
            </div>

            <div className="max-h-[25rem] overflow-auto border border-[#e4ded5] bg-white">
              {previewRows.length > 0 ? (
                previewRows.map((row) => (
                  <div
                    key={row.sourceKey}
                    className="border-b border-[#eee7dc] px-3 py-2 last:border-b-0"
                  >
                    <p className="text-xs font-black text-[#1a1815]">
                      {formatDate(row.pickupDate)} · {row.quantity}x{" "}
                      {row.letter} {row.chocolate} {row.size}
                    </p>
                    <p className="text-[0.68rem] font-bold text-[#6b645b]">
                      {row.articleNumber} · {row.productName}
                    </p>
                  </div>
                ))
              ) : (
                <p className="px-3 py-2 text-sm font-bold text-[#6b645b]">
                  Nog geen herkenbare regels.
                </p>
              )}
            </div>

            {rows.length > previewRows.length && (
              <p className="text-xs font-bold text-[#6b645b]">
                + {rows.length - previewRows.length} extra regels
              </p>
            )}
          </div>
        </div>

        {message && (
          <p className="mt-3 border border-[#e4ded5] bg-white px-3 py-2 text-sm font-black text-[#5f3f00]">
            {message}
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 border-t border-[#e4ded5] pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 border border-[#e4ded5] bg-white px-4 text-sm font-black text-[#4d463d]"
          >
            Sluiten
          </button>
          <button
            type="button"
            disabled={importing || rows.length < 1}
            onClick={() => onImport(rows)}
            className="h-10 bg-[#2f6f91] px-5 text-sm font-black text-white shadow-sm disabled:opacity-60"
          >
            {importing ? "Inladen..." : "Online orders inladen"}
          </button>
        </div>
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
  const [onlineImportOpen, setOnlineImportOpen] = useState(false);
  const [onlineImportText, setOnlineImportText] = useState("");
  const [onlineImportYear, setOnlineImportYear] = useState(() => currentYear());
  const [onlineImporting, setOnlineImporting] = useState(false);
  const [onlineImportMessage, setOnlineImportMessage] = useState("");
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
        order.source,
        order.sourceBatch,
        order.sourceKey,
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

  function openOnlineImportDialog() {
    setOnlineImportYear(year);
    setOnlineImportMessage("");
    setOnlineImportOpen(true);
  }

  function openEditOrderDialog(order: ChocolateLetterOrder) {
    setEditingOrder(order);
    setFormOpen(true);
  }

  function closeOrderDialog() {
    setFormOpen(false);
    setEditingOrder(null);
  }

  function closeOnlineImportDialog() {
    setOnlineImportOpen(false);
    setOnlineImportMessage("");
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

  async function importOnlineRows(rows: OnlineLetterImportRow[]) {
    if (rows.length < 1) {
      setOnlineImportMessage("Geen herkenbare online regels gevonden.");
      return;
    }

    setOnlineImporting(true);
    setOnlineImportMessage("");
    setError("");

    const savedOrders: ChocolateLetterOrder[] = [];
    let reopenedCount = 0;
    const importedAt = new Date().toISOString();

    try {
      for (const row of rows) {
        const existing = orders.find(
          (order) => order.id === row.id || order.sourceKey === row.sourceKey
        );
        const existingQuantity = existing
          ? existing.lines.reduce((sum, line) => sum + line.quantity, 0)
          : 0;
        const quantityChanged = Boolean(existing && existingQuantity !== row.quantity);
        const targetId = existing?.id || row.id;

        if (quantityChanged && existing?.productionDone) {
          reopenedCount += 1;
        }

        const saved = await updateLetterOrder(targetId, {
          id: targetId,
          year: yearFromDate(row.pickupDate),
          code: existing?.code || "",
          customerName: "Online bestellingen",
          customerEmail: "",
          phone: "",
          shop: "Online",
          pickupDate: row.pickupDate,
          pickupLocation: "Online",
          source: "online",
          sourceKey: row.sourceKey,
          sourceImportedAt: importedAt,
          sourceBatch: row.batch,
          status: quantityChanged
            ? "besteld"
            : existing?.status || "besteld",
          notes: row.notes,
          sendCustomerEmail: false,
          ...(quantityChanged
            ? {
                productionDone: false,
                productionDoneAt: "",
                productionDoneBy: "",
              }
            : {}),
          lines: [
            {
              id: `${row.sourceKey}-line`,
              letter: row.letter,
              chocolate: row.chocolate,
              size: row.size,
              style: row.style,
              quantity: row.quantity,
              logo: false,
              notes: "",
            },
          ],
        });
        savedOrders.push(saved);
      }

      setOrders((current) =>
        savedOrders.reduce(
          (nextOrders, order) => updateOrderList(nextOrders, order),
          current
        )
      );
      setOnlineImportMessage(
        `${savedOrders.length} online regels ingeladen of bijgewerkt${
          reopenedCount > 0 ? `, ${reopenedCount} opnieuw opengezet` : ""
        }.`
      );
    } catch (importError) {
      setOnlineImportMessage(
        importError instanceof Error
          ? importError.message
          : "Online weeklijst inladen is mislukt."
      );
    } finally {
      setOnlineImporting(false);
    }
  }

  const groupedOrders = groupByMonth(visibleOrders);

  return (
    <div className="space-y-4">
      <section className="border border-[#e4ded5] bg-white p-3 shadow-sm">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_8rem_7rem_13rem_13rem]">
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
            onClick={openOnlineImportDialog}
            className="flex h-10 items-center justify-center gap-2 bg-[#2f6f91] px-3 text-sm font-black text-white"
          >
            <span
              className="flex h-6 w-6 items-center justify-center bg-white/20 text-lg leading-none"
              aria-hidden="true"
            >
              +
            </span>
            Online import
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
      {onlineImportOpen && (
        <OnlineImportDialog
          text={onlineImportText}
          year={onlineImportYear}
          importing={onlineImporting}
          message={onlineImportMessage}
          onTextChange={setOnlineImportText}
          onYearChange={setOnlineImportYear}
          onClose={closeOnlineImportDialog}
          onImport={(rows) => void importOnlineRows(rows)}
        />
      )}
    </div>
  );
}
