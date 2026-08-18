"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteB2BOrder,
  fetchB2BOrders,
  saveB2BOrder,
  updateB2BOrder,
} from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";

type B2BFormState = {
  customerName: string;
  contactName: string;
  customerEmail: string;
  phone: string;
  deliveryDate: string;
  productionDate: string;
  department: SinterklaasB2BOrder["department"];
  orderText: string;
  logo: string;
  packaging: string;
  importantNotes: string;
  priceAgreement: string;
  totalExVat: string;
  deliveryMethod: string;
  deliveryAddress: string;
  invoiceInfo: string;
};

const DEPARTMENTS: { id: SinterklaasB2BOrder["department"]; label: string }[] = [
  { id: "chocolade", label: "Chocolade" },
  { id: "bakkerij", label: "Bakkerij" },
  { id: "beide", label: "Beide" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentYear() {
  return String(new Date().getFullYear());
}

function yearFromDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : currentYear();
}

function addDays(date: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function createFormState(): B2BFormState {
  const deliveryDate = todayIso();
  return {
    customerName: "",
    contactName: "",
    customerEmail: "",
    phone: "",
    deliveryDate,
    productionDate: addDays(deliveryDate, -2),
    department: "chocolade",
    orderText: "",
    logo: "",
    packaging: "",
    importantNotes: "",
    priceAgreement: "",
    totalExVat: "",
    deliveryMethod: "",
    deliveryAddress: "",
    invoiceInfo: "",
  };
}

function formStateFromOrder(order: SinterklaasB2BOrder | null | undefined) {
  if (!order) return createFormState();

  return {
    customerName: order.customerName,
    contactName: order.contactName,
    customerEmail: order.customerEmail,
    phone: order.phone,
    deliveryDate: order.deliveryDate,
    productionDate: order.productionDate,
    department: order.department,
    orderText: order.orderText,
    logo: order.logo,
    packaging: order.packaging,
    importantNotes: order.importantNotes,
    priceAgreement: order.priceAgreement,
    totalExVat: order.totalExVat,
    deliveryMethod: order.deliveryMethod,
    deliveryAddress: order.deliveryAddress,
    invoiceInfo: order.invoiceInfo,
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

function normalizeHeader(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textFromCell(value: unknown) {
  if (typeof value === "boolean") return value ? "Ja" : "";
  if (typeof value === "number") return String(value);
  return String(value || "").trim();
}

function boolFromCell(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = textFromCell(value).toLocaleLowerCase("nl-NL");
  return ["ja", "x", "✓", "true", "1", "klaar"].includes(normalized);
}

function sheetYear(sheetName: string) {
  const match = sheetName.match(/20\d{2}/);
  return match ? match[0] : currentYear();
}

function excelDateToIso(
  value: unknown,
  XLSX: typeof import("xlsx"),
  fallbackYear: string
) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
        parsed.d
      ).padStart(2, "0")}`;
    }
  }

  const text = textFromCell(value);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return text;

  const nlMatch = text.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (nlMatch) {
    const year =
      nlMatch[3]?.length === 4
        ? nlMatch[3]
        : nlMatch[3]?.length === 2
          ? `20${nlMatch[3]}`
          : fallbackYear;
    return `${year}-${nlMatch[2].padStart(2, "0")}-${nlMatch[1].padStart(
      2,
      "0"
    )}`;
  }

  return "";
}

function findColumn(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) =>
    patterns.some((pattern) => pattern.test(header))
  );
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

function compareOrdersByDeliveryDate(
  a: SinterklaasB2BOrder,
  b: SinterklaasB2BOrder
) {
  if (!a.deliveryDate && b.deliveryDate) return 1;
  if (a.deliveryDate && !b.deliveryDate) return -1;

  return (
    a.deliveryDate.localeCompare(b.deliveryDate) ||
    a.customerName.localeCompare(b.customerName)
  );
}

function groupByMonth(orders: SinterklaasB2BOrder[]) {
  const groups = new Map<string, SinterklaasB2BOrder[]>();

  [...orders].sort(compareOrdersByDeliveryDate).forEach((order) => {
    const key = monthKey(order.deliveryDate);
    groups.set(key, [...(groups.get(key) || []), order]);
  });

  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "zonder-datum") return 1;
    if (b === "zonder-datum") return -1;
    return a.localeCompare(b);
  });
}

function updateOrderList(
  orders: SinterklaasB2BOrder[],
  nextOrder: SinterklaasB2BOrder
) {
  return [nextOrder, ...orders.filter((order) => order.id !== nextOrder.id)].sort(
    compareOrdersByDeliveryDate
  );
}

function statusBadge(label: string, active: boolean) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] ${
        active ? "bg-[#dcebd8] text-[#24551d]" : "bg-[#f2eee8] text-[#8b8278]"
      }`}
    >
      {label}
    </span>
  );
}

function dueSoon(order: SinterklaasB2BOrder) {
  if (!order.deliveryDate || order.productionDone || order.cancelled) return false;
  const today = new Date(`${todayIso()}T12:00:00`).getTime();
  const delivery = new Date(`${order.deliveryDate}T12:00:00`).getTime();
  const days = Math.round((delivery - today) / 86400000);
  return days >= 0 && days <= 2;
}

async function parseB2BExcel(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
  });
  const parsedOrders: B2BFormState[] = [];

  workbook.SheetNames.filter((sheetName) => /sint/i.test(sheetName)).forEach(
    (sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
      });

      if (rows.length < 2) return;

      const headers = rows[0].map(normalizeHeader);
      const fallbackYear = sheetYear(sheetName);
      const seasonIndex =
        headers[0] === "" && /sintkerst/i.test(sheetName) ? 0 : -1;
      const dateIndex = findColumn(headers, [/^datum$/, /leverdatum/]);
      const customerIndex = findColumn(headers, [/klantnaam/]);
      const chocolateIndex = findColumn(headers, [/choco/, /chocolade/]);
      const orderIndex = findColumn(headers, [/bestelling/]);
      const logoFlagIndex = findColumn(headers, [/logo op product/, /^logo$/]);
      const packagingIndex = findColumn(headers, [/verpakken/, /verpakking/]);
      const notesIndex = findColumn(headers, [/opmerking/, /belangrijk/]);
      const priceIndex = findColumn(headers, [/afgesproken prijs/, /prijs ex/]);
      const deliveryIndex = findColumn(headers, [
        /^levering$/,
        /bezorgen afhalen/,
        /bezorging/,
        /levering ophalen/,
      ]);
      const totalIndex = findColumn(headers, [/totaalprijs/, /tot prijs/]);
      const addressIndex = findColumn(headers, [/bezorg adres/, /^bezorgen$/]);
      const invoiceIndex = findColumn(headers, [/factuur/, /betaalgegevens/]);
      const enteredIndex = findColumn(headers, [/ingevoerd/]);
      const doneIndex = findColumn(headers, [/^af$/, /gemaakt/, /klaar/]);

      rows.slice(1).forEach((row) => {
        if (!Array.isArray(row)) return;
        if (seasonIndex >= 0 && !/sint/i.test(textFromCell(row[seasonIndex]))) {
          return;
        }

        const customerName = textFromCell(row[customerIndex]);
        const orderText = textFromCell(row[orderIndex]);
        if (!customerName || !orderText) return;

        const deliveryDate = excelDateToIso(row[dateIndex], XLSX, fallbackYear);
        const chocolateValue = textFromCell(row[chocolateIndex]).toLocaleLowerCase(
          "nl-NL"
        );
        const department: SinterklaasB2BOrder["department"] =
          chocolateValue.includes("gedeelt")
            ? "beide"
            : chocolateValue.includes("nee")
              ? "bakkerij"
              : "chocolade";
        const logo = [
          boolFromCell(row[logoFlagIndex]) ? "Logo op product" : "",
          logoFlagIndex >= 0 && !boolFromCell(row[logoFlagIndex])
            ? textFromCell(row[logoFlagIndex])
            : "",
        ]
          .filter(Boolean)
          .join(" - ");

        parsedOrders.push({
          ...createFormState(),
          customerName,
          deliveryDate,
          productionDate: deliveryDate ? addDays(deliveryDate, -2) : "",
          department,
          orderText,
          logo,
          packaging: textFromCell(row[packagingIndex]),
          importantNotes: textFromCell(row[notesIndex]),
          priceAgreement: textFromCell(row[priceIndex]),
          totalExVat: textFromCell(row[totalIndex]),
          deliveryMethod: textFromCell(row[deliveryIndex]),
          deliveryAddress: textFromCell(row[addressIndex]),
          invoiceInfo: textFromCell(row[invoiceIndex]),
        });

        const last = parsedOrders[parsedOrders.length - 1];
        if (enteredIndex >= 0 && boolFromCell(row[enteredIndex])) {
          last.importantNotes = [last.importantNotes, "In Excel: ingevoerd"]
            .filter(Boolean)
            .join("\n");
        }
        if (doneIndex >= 0 && boolFromCell(row[doneIndex])) {
          last.importantNotes = [last.importantNotes, "In Excel: af/klaar"]
            .filter(Boolean)
            .join("\n");
        }
      });
    }
  );

  return parsedOrders;
}

function B2BOrderForm({
  initialOrder,
  onSaved,
  onCancel,
}: Readonly<{
  initialOrder?: SinterklaasB2BOrder | null;
  onSaved: (order: SinterklaasB2BOrder) => void;
  onCancel: () => void;
}>) {
  const [form, setForm] = useState<B2BFormState>(() =>
    formStateFromOrder(initialOrder)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(formStateFromOrder(initialOrder));
  }, [initialOrder]);

  function setField<K extends keyof B2BFormState>(key: K, value: B2BFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.customerName.trim() || !form.orderText.trim()) {
      setMessage("Vul minimaal klantnaam en bestelling in.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveB2BOrder({
        id: initialOrder?.id,
        ...form,
        customerName: form.customerName.trim(),
        orderText: form.orderText.trim(),
        year: form.deliveryDate
          ? yearFromDate(form.deliveryDate)
          : initialOrder?.year || currentYear(),
        season: initialOrder?.season || "sint",
        source: initialOrder?.source || "handmatig",
        sourceSheet: initialOrder?.sourceSheet || "",
      });
      onSaved(saved);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "B2B-bestelling opslaan is mislukt."
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
          onChange={(event) => setField("customerName", event.target.value)}
          placeholder="Klantnaam"
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-bold outline-none"
        />
        <input
          value={form.contactName}
          onChange={(event) => setField("contactName", event.target.value)}
          placeholder="Contactpersoon"
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-bold outline-none"
        />
        <input
          value={form.customerEmail}
          onChange={(event) => setField("customerEmail", event.target.value)}
          placeholder="E-mail"
          type="email"
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-bold outline-none"
        />
        <input
          value={form.phone}
          onChange={(event) => setField("phone", event.target.value)}
          placeholder="Telefoon"
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-bold outline-none"
        />
        <label className="grid gap-1">
          <span className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
            Leverdatum
          </span>
          <input
            value={form.deliveryDate}
            onChange={(event) => {
              const deliveryDate = event.target.value;
              setForm((current) => ({
                ...current,
                deliveryDate,
                productionDate: addDays(deliveryDate, -2),
              }));
            }}
            type="date"
            className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-black outline-none"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
            Productiedatum
          </span>
          <input
            value={form.productionDate}
            onChange={(event) => setField("productionDate", event.target.value)}
            type="date"
            className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-black outline-none"
          />
        </label>
        <select
          value={form.department}
          onChange={(event) =>
            setField(
              "department",
              event.target.value as SinterklaasB2BOrder["department"]
            )
          }
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-black outline-none"
        >
          {DEPARTMENTS.map((department) => (
            <option key={department.id} value={department.id}>
              {department.label}
            </option>
          ))}
        </select>
        <input
          value={form.deliveryMethod}
          onChange={(event) => setField("deliveryMethod", event.target.value)}
          placeholder="Bezorgen / ophalen"
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-bold outline-none"
        />
      </div>

      <textarea
        value={form.orderText}
        onChange={(event) => setField("orderText", event.target.value)}
        placeholder="Bestelling"
        rows={4}
        className="w-full border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-bold outline-none"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <textarea
          value={form.logo}
          onChange={(event) => setField("logo", event.target.value)}
          placeholder="Logo"
          rows={2}
          className="border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-bold outline-none"
        />
        <textarea
          value={form.packaging}
          onChange={(event) => setField("packaging", event.target.value)}
          placeholder="Verpakken"
          rows={2}
          className="border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-bold outline-none"
        />
        <textarea
          value={form.importantNotes}
          onChange={(event) => setField("importantNotes", event.target.value)}
          placeholder="Belangrijk"
          rows={2}
          className="border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-bold outline-none"
        />
        <textarea
          value={form.deliveryAddress}
          onChange={(event) => setField("deliveryAddress", event.target.value)}
          placeholder="Bezorgadres"
          rows={2}
          className="border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-bold outline-none"
        />
        <input
          value={form.priceAgreement}
          onChange={(event) => setField("priceAgreement", event.target.value)}
          placeholder="Afgesproken prijs"
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-bold outline-none"
        />
        <input
          value={form.totalExVat}
          onChange={(event) => setField("totalExVat", event.target.value)}
          placeholder="Totaal ex btw"
          className="h-10 border border-[#d6e5d8] bg-white px-3 text-sm font-bold outline-none"
        />
      </div>

      <textarea
        value={form.invoiceInfo}
        onChange={(event) => setField("invoiceInfo", event.target.value)}
        placeholder="Factuurgegevens"
        rows={2}
        className="w-full border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-bold outline-none"
      />

      {message && (
        <p className="border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-bold text-[#24551d]">
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
              : "B2B-bestelling opslaan"}
        </button>
      </div>
    </form>
  );
}

function B2BOrderDialog({
  order,
  onClose,
  onSaved,
}: Readonly<{
  order: SinterklaasB2BOrder | null;
  onClose: () => void;
  onSaved: (order: SinterklaasB2BOrder) => void;
}>) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#1a1815]/45 px-3 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-5xl border border-[#d6e5d8] bg-[#faf8f5] p-3 shadow-2xl sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#e4ded5] pb-3">
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
              Sinterklaas B2B
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

        <B2BOrderForm
          key={order?.id || "new-order"}
          initialOrder={order}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

function B2BOrderRow({
  order,
  updatingId,
  onToggle,
  onEdit,
  onDelete,
}: Readonly<{
  order: SinterklaasB2BOrder;
  updatingId: string;
  onToggle: (
    order: SinterklaasB2BOrder,
    key: "entered" | "productionDone" | "packed" | "delivered"
  ) => void;
  onEdit: (order: SinterklaasB2BOrder) => void;
  onDelete: (order: SinterklaasB2BOrder) => void;
}>) {
  const extraLines = [
    order.contactName && `Contact: ${order.contactName}`,
    order.customerEmail && `E-mail: ${order.customerEmail}`,
    order.phone && `Telefoon: ${order.phone}`,
    order.logo && `Logo: ${order.logo}`,
    order.packaging && `Verpakken: ${order.packaging}`,
    order.importantNotes && `Belangrijk: ${order.importantNotes}`,
    order.deliveryAddress && `Adres: ${order.deliveryAddress}`,
    order.priceAgreement && `Prijsafspraak: ${order.priceAgreement}`,
    order.totalExVat && `Totaal ex btw: ${order.totalExVat}`,
    order.invoiceInfo && `Factuur: ${order.invoiceInfo}`,
    order.reminderEmailedAt &&
      `Reminder gemaild: ${formatDateTime(order.reminderEmailedAt)}`,
  ].filter(Boolean);

  return (
    <article
      className={`border px-3 py-2 ${
        order.cancelled
          ? "border-[#e4ded5] bg-[#f4f0ea] opacity-70"
          : dueSoon(order)
            ? "border-[#e5d28a] bg-[#fffdf4]"
            : "border-[#e4ded5] bg-white"
      }`}
    >
      <div className="grid gap-3 lg:grid-cols-[9rem_minmax(0,1fr)_18rem]">
        <div className="border-l-4 border-[#c3d3bc] pl-2">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8b8278]">
            Leverdatum
          </p>
          <p className="text-base font-black text-[#1a1815]">
            {formatDate(order.deliveryDate)}
          </p>
          {order.productionDate && (
            <p className="text-xs font-bold text-[#6b645b]">
              Productie: {formatDate(order.productionDate)}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black leading-tight text-[#1a1815]">
              {order.customerName}
            </h3>
            {statusBadge("Ingevoerd", order.entered)}
            {statusBadge("Productie", order.productionDone)}
            {statusBadge("Ingepakt", order.packed)}
            {statusBadge("Geleverd", order.delivered)}
            {dueSoon(order) && (
              <span className="rounded-full bg-[#fff3c4] px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#705000]">
                Binnen 2 dagen
              </span>
            )}
          </div>

          <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8b8278]">
            {order.department} · {order.deliveryMethod || "geen levering"}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-snug text-[#4d463d]">
            {order.orderText}
          </p>
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
          {(
            [
              ["entered", "Ingevoerd"],
              ["productionDone", "Productie klaar"],
              ["packed", "Ingepakt"],
              ["delivered", "Geleverd"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={updatingId === `${order.id}-${key}`}
              onClick={() => onToggle(order, key)}
              className={`h-8 px-2 text-[0.68rem] font-black shadow-sm disabled:opacity-60 ${
                order[key]
                  ? "bg-[#24551d] text-white"
                  : "border border-[#e4ded5] bg-white text-[#4d463d]"
              }`}
            >
              {updatingId === `${order.id}-${key}` ? "..." : label}
            </button>
          ))}
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

export default function SinterklaasB2BClient() {
  const [year, setYear] = useState(() => currentYear());
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<SinterklaasB2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [importPreview, setImportPreview] = useState<B2BFormState[]>([]);
  const [importing, setImporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SinterklaasB2BOrder | null>(
    null
  );

  async function loadOrders(nextYear = year, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      setOrders(await fetchB2BOrders(nextYear, nextSearch));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "B2B-bestellingen ophalen is mislukt."
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
        order.orderText,
        order.deliveryDate,
        order.deliveryMethod,
        order.department,
      ]
        .join(" ")
        .toLocaleLowerCase("nl-NL")
        .includes(term)
    );
  }, [orders, search]);

  async function toggleStatus(
    order: SinterklaasB2BOrder,
    key: "entered" | "productionDone" | "packed" | "delivered"
  ) {
    const value = !order[key];
    const timestampKey =
      key === "productionDone"
        ? "productionDoneAt"
        : key === "packed"
          ? "packedAt"
          : key === "delivered"
            ? "deliveredAt"
            : null;
    setUpdatingId(`${order.id}-${key}`);
    setError("");
    try {
      const saved = await updateB2BOrder(order.id, {
        [key]: value,
        ...(timestampKey ? { [timestampKey]: value ? new Date().toISOString() : "" } : {}),
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

  function openEditOrderDialog(order: SinterklaasB2BOrder) {
    setEditingOrder(order);
    setFormOpen(true);
  }

  function closeOrderDialog() {
    setFormOpen(false);
    setEditingOrder(null);
  }

  function handleSavedOrder(order: SinterklaasB2BOrder) {
    setOrders((current) => updateOrderList(current, order));
    closeOrderDialog();
  }

  async function deleteOrder(order: SinterklaasB2BOrder) {
    const confirmed = window.confirm(
      `B2B-bestelling van ${order.customerName} verwijderen?`
    );
    if (!confirmed) return;

    setUpdatingId(`${order.id}-delete`);
    setError("");
    try {
      await deleteB2BOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "B2B-bestelling verwijderen is mislukt."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function handleExcelFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const parsed = await parseB2BExcel(file);
      setImportPreview(parsed.slice(0, 300));
      if (parsed.length < 1) {
        setError("Geen Sinterklaas B2B-rijen gevonden in dit bestand.");
      }
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Excelbestand lezen is mislukt."
      );
    }
  }

  async function saveImportPreview() {
    if (importPreview.length < 1) return;
    setImporting(true);
    setError("");

    try {
      const savedOrders: SinterklaasB2BOrder[] = [];
      for (const order of importPreview) {
        const saved = await saveB2BOrder({
          ...order,
          customerName: order.customerName.trim(),
          orderText: order.orderText.trim(),
          year: yearFromDate(order.deliveryDate),
          season: "sint",
          source: "excel",
          sourceSheet: "Excel import",
        });
        savedOrders.push(saved);
      }
      setOrders((current) =>
        savedOrders.reduce(
          (list, saved) => updateOrderList(list, saved),
          current
        )
      );
      setImportPreview([]);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Excelimport opslaan is mislukt."
      );
    } finally {
      setImporting(false);
    }
  }

  const groupedOrders = groupByMonth(visibleOrders);

  return (
    <div className="space-y-4">
      <section className="border border-[#e4ded5] bg-white p-3 shadow-sm">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_8rem_7rem_13rem_12rem]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Zoek klant, datum, product"
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
          <label className="flex h-10 cursor-pointer items-center justify-center border border-[#d6e5d8] bg-[#f6faf4] px-3 text-sm font-black text-[#24551d]">
            Excel import
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => void handleExcelFile(event.target.files?.[0])}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      {error && (
        <p className="border border-[#f1b8a8] bg-[#fff4ef] px-3 py-2 text-sm font-black text-[#9a3412]">
          {error}
        </p>
      )}

      {importPreview.length > 0 && (
        <section className="border border-[#e5d28a] bg-[#fff8d8] p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-[#1a1815]">
              Import klaar: {importPreview.length} regels
            </h2>
            <button
              type="button"
              disabled={importing}
              onClick={() => void saveImportPreview()}
              className="h-10 bg-[#24551d] px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {importing ? "Opslaan..." : "Opslaan in WordPress"}
            </button>
          </div>
          <div className="mt-3 grid gap-1">
            {importPreview.slice(0, 8).map((order, index) => (
              <p
                key={`${order.customerName}-${index}`}
                className="border border-[#eadb8b] bg-white/75 px-2 py-1 text-xs font-bold text-[#4d463d]"
              >
                {formatDate(order.deliveryDate)} · {order.customerName} ·{" "}
                {order.orderText.slice(0, 110)}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#1a1815]">Bestellingen</h2>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b8278]">
              Gesorteerd op leverdatum
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
                    <B2BOrderRow
                      key={order.id}
                      order={order}
                      updatingId={updatingId}
                      onToggle={toggleStatus}
                      onEdit={openEditOrderDialog}
                      onDelete={(nextOrder) => void deleteOrder(nextOrder)}
                    />
                  ))}
                </div>
              </section>
            ))}
          {!loading && visibleOrders.length < 1 && (
            <p className="border border-[#e4ded5] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
              Geen B2B-bestellingen gevonden.
            </p>
          )}
        </div>
      </section>

      {formOpen && (
        <B2BOrderDialog
          order={editingOrder}
          onClose={closeOrderDialog}
          onSaved={handleSavedOrder}
        />
      )}
    </div>
  );
}
