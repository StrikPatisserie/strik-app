"use client";

import { useEffect, useMemo, useState } from "react";
import {
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

function orderMeta(order: ChocolateLetterOrder) {
  return `${formatDate(order.pickupDate)} · ${order.pickupLocation || order.shop || "geen locatie"} · ${totalPieces(order)} stuks`;
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
    (a, b) =>
      a.pickupDate.localeCompare(b.pickupDate) ||
      a.customerName.localeCompare(b.customerName)
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
  updatingId,
  productionMode = false,
}: Readonly<{
  order: ChocolateLetterOrder;
  onToggleDone: (order: ChocolateLetterOrder) => void;
  updatingId: string;
  productionMode?: boolean;
}>) {
  return (
    <article className="border border-[#e4ded5] bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
          <p className="mt-1 text-sm font-bold text-[#6b645b]">
            {orderMeta(order)}
          </p>
          <p className="mt-1 text-xs font-semibold text-[#9b9489]">
            {order.lines.map(lineLabel).join(" · ")}
          </p>
          {order.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[#4d463d]">
              {order.notes}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={updatingId === order.id}
          onClick={() => onToggleDone(order)}
          className={`h-9 shrink-0 px-3 text-sm font-black shadow-sm disabled:opacity-60 ${
            order.productionDone
              ? "border border-[#d9d2c9] bg-white text-[#6b645b]"
              : "bg-[#24551d] text-white"
          }`}
        >
          {updatingId === order.id
            ? "Opslaan..."
            : order.productionDone
              ? "Zet open"
              : productionMode
                ? "Afvinken"
                : "Klaar"}
        </button>
      </div>
    </article>
  );
}

function WinkelOrderForm({
  onSaved,
}: Readonly<{ onSaved: (order: ChocolateLetterOrder) => void }>) {
  const [form, setForm] = useState<LetterFormState>(() => createFormState());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      const saved = await saveLetterOrder({
        ...form,
        customerName,
        year: yearFromDate(form.pickupDate),
        status: "besteld",
        lines: lines.map((line) => ({
          ...line,
          letter: line.letter.trim().toUpperCase(),
          quantity: Math.max(1, Math.round(line.quantity)),
        })),
      });
      onSaved(saved);
      setForm({
        ...createFormState(),
        shop: form.shop,
        pickupLocation: form.pickupLocation,
        pickupDate: form.pickupDate,
      });
      setMessage("Bestelling opgeslagen en doorgestuurd.");
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
      className="space-y-3 border border-[#d7c168] bg-[#fff8d8] p-3 shadow-sm"
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

      <button
        type="submit"
        disabled={saving}
        className="h-11 bg-[#ef5737] px-5 text-sm font-black text-white shadow-sm disabled:opacity-60"
      >
        {saving ? "Opslaan..." : "Bestelling opslaan"}
      </button>
    </form>
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

  return (
    <div className="space-y-4">
      <section className="border border-[#e4ded5] bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_7rem]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Zoek klant, datum of letter"
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
        </div>
      </section>

      {error && (
        <p className="border border-[#f1b8a8] bg-[#fff4ef] px-3 py-2 text-sm font-black text-[#9a3412]">
          {error}
        </p>
      )}

      {mode === "winkel" && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.72fr)]">
          <div>
            <h2 className="mb-2 text-lg font-black text-[#1a1815]">
              Nieuwe letterbestelling
            </h2>
            <WinkelOrderForm
              onSaved={(order) =>
                setOrders((current) => updateOrderList(current, order))
              }
            />
          </div>

          <div>
            <h2 className="mb-2 text-lg font-black text-[#1a1815]">
              Bestellingen
            </h2>
            <div className="grid gap-2">
              {loading ? (
                <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
                  Laden...
                </p>
              ) : (
                visibleOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onToggleDone={toggleProductionDone}
                    updatingId={updatingId}
                  />
                ))
              )}
              {!loading && visibleOrders.length < 1 && (
                <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
                  Geen letterbestellingen gevonden.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {mode === "productie" && (
        <section className="space-y-3">
          <div>
            <h2 className="mb-2 text-lg font-black text-[#1a1815]">
              Productietotalen
            </h2>
            <SummaryStrip orders={visibleOrders} />
          </div>

          <div>
            <h2 className="mb-2 text-lg font-black text-[#1a1815]">
              Orders
            </h2>
            <div className="grid gap-2">
              {loading ? (
                <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
                  Laden...
                </p>
              ) : (
                visibleOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onToggleDone={toggleProductionDone}
                    updatingId={updatingId}
                    productionMode
                  />
                ))
              )}
              {!loading && visibleOrders.length < 1 && (
                <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
                  Geen letterbestellingen gevonden.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
