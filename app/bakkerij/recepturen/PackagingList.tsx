import { useMemo, useState } from "react";
import type { PackagingItem, PackagingStatus, Recipe } from "./types";
import {
  EmptyState,
  FilterSelect,
  Panel,
  SearchInput,
  SectionTitle,
} from "./RecepturenShared";
import { formatEuro, normalizeSearch } from "./utils";
import styles from "./ManagementScreens.module.css";

type PackagingDraft = {
  id: string;
  name: string;
  supplier: string;
  articleNumber: string;
  packageSize: string;
  quantityPerPackage: string;
  packagePrice: string;
  status: PackagingStatus;
};

export default function PackagingList({
  packagingItems,
  recipes,
  onSavePackagingItem,
  onDeletePackagingItem,
}: Readonly<{
  packagingItems: PackagingItem[];
  recipes: Recipe[];
  onSavePackagingItem: (item: PackagingItem) => void;
  onDeletePackagingItem: (item: PackagingItem) => void;
}>) {
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [draft, setDraft] = useState<PackagingDraft>(() => createPackagingDraft());
  const [feedback, setFeedback] = useState("");
  const suppliers = Array.from(
    new Set(packagingItems.map((item) => item.supplier).filter(Boolean))
  ).sort((first, second) => first.localeCompare(second, "nl-NL"));

  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search);

    return packagingItems
      .filter((item) => {
        const matchesSearch =
          !query ||
          normalizeSearch(item.name).includes(query) ||
          normalizeSearch(item.articleNumber).includes(query) ||
          normalizeSearch(item.packageSize).includes(query);
        const matchesSupplier = supplier === "all" || item.supplier === supplier;

        return matchesSearch && matchesSupplier;
      })
      .sort((first, second) => first.name.localeCompare(second.name, "nl-NL"));
  }, [packagingItems, search, supplier]);

  function updateDraft(changes: Partial<PackagingDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function saveDraft() {
    const name = draft.name.trim();
    const quantityPerPackage = parseDutchNumber(draft.quantityPerPackage);
    const packagePrice = parseDutchNumber(draft.packagePrice);

    if (!name) {
      showFeedback("Vul eerst een naam in.");
      return;
    }

    if (quantityPerPackage <= 0 || packagePrice <= 0) {
      showFeedback("Vul aantal per verpakking en prijs in.");
      return;
    }

    onSavePackagingItem({
      id: draft.id || uniquePackagingId(name, packagingItems),
      name,
      supplier: draft.supplier.trim() || "Handmatig",
      articleNumber: draft.articleNumber.trim() || "-",
      packageSize: draft.packageSize.trim() || `${quantityPerPackage} stuks`,
      quantityPerPackage,
      packagePrice,
      unitPrice: roundMoney(packagePrice / quantityPerPackage),
      status: draft.status,
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
    setDraft(createPackagingDraft());
    showFeedback("Verpakking opgeslagen.");
  }

  function editPackaging(item: PackagingItem) {
    setDraft({
      id: item.id,
      name: item.name,
      supplier: item.supplier,
      articleNumber: item.articleNumber,
      packageSize: item.packageSize,
      quantityPerPackage: formatInputNumber(item.quantityPerPackage),
      packagePrice: formatInputNumber(item.packagePrice),
      status: item.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deletePackaging(item: PackagingItem) {
    const usageCount = recipesUsingPackaging(recipes, item.id).length;
    const confirmed = window.confirm(
      usageCount
        ? `${item.name} verwijderen? Deze verpakking staat in ${usageCount} recepten en wordt daar ook weggehaald.`
        : `${item.name} verwijderen uit verpakkingen?`
    );

    if (confirmed) onDeletePackagingItem(item);
  }

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2200);
  }

  return (
    <Panel>
      <div className="grid gap-3">
        <SectionTitle title="Verpakkingen" />

        <div className={styles.form}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <InputField
              label="Naam"
              value={draft.name}
              onChange={(value) => updateDraft({ name: value })}
            />
            <InputField
              label="Leverancier"
              value={draft.supplier}
              onChange={(value) => updateDraft({ supplier: value })}
            />
            <InputField
              label="Artikelnummer"
              value={draft.articleNumber}
              onChange={(value) => updateDraft({ articleNumber: value })}
            />
            <InputField
              label="Verpakking"
              value={draft.packageSize}
              onChange={(value) => updateDraft({ packageSize: value })}
              placeholder="Bijv. 100 stuks per doos"
            />
            <InputField
              label="Aantal"
              value={draft.quantityPerPackage}
              onChange={(value) => updateDraft({ quantityPerPackage: value })}
              inputMode="decimal"
            />
            <InputField
              label="Prijs"
              value={draft.packagePrice}
              onChange={(value) => updateDraft({ packagePrice: value })}
              inputMode="decimal"
            />
            <label className={styles.field}>
              Status
              <select
                value={draft.status}
                onChange={(event) =>
                  updateDraft({ status: event.target.value as PackagingStatus })
                }
              >
                <option value="active">Actief</option>
                <option value="inactive">Inactief</option>
              </select>
            </label>
            <MiniMetric
              label="Prijs/stuk"
              value={
                parseDutchNumber(draft.quantityPerPackage)
                  ? formatEuro(
                      parseDutchNumber(draft.packagePrice) /
                        parseDutchNumber(draft.quantityPerPackage)
                    )
                  : "-"
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className={`${styles.action} ${styles.primaryAction}`}
            >
              {draft.id ? "Verpakking opslaan" : "Verpakking toevoegen"}
            </button>
            {draft.id && (
              <button
                type="button"
                onClick={() => setDraft(createPackagingDraft())}
                className={styles.action}
              >
                Nieuwe invoer
              </button>
            )}
            {feedback && (
              <p className="text-sm font-black text-[#45663b]">{feedback}</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Zoek verpakking, artikelnummer of doosmaat"
          />
          <FilterSelect
            label="Leverancier"
            value={supplier}
            onChange={setSupplier}
            options={[
              { value: "all", label: "Alle leveranciers" },
              ...suppliers.map((item) => ({ value: item, label: item })),
            ]}
          />
        </div>

        {filteredItems.length ? (
          <div className={styles.table}>
            <div className={`${styles.tableHeading} hidden grid-cols-[minmax(14rem,1.3fr)_7rem_7rem_7rem_6rem_6rem_10rem] gap-3 lg:grid lg:min-w-[60rem]`}>
              <span>Verpakking</span>
              <span>Leverancier</span>
              <span>Artikel</span>
              <span>Doosprijs</span>
              <span>Per stuk</span>
              <span>Gebruik</span>
              <span>Acties</span>
            </div>
            <div className="divide-y divide-[#e7e0d8] bg-white">
              {filteredItems.map((item) => {
                const usageCount = recipesUsingPackaging(recipes, item.id).length;

                return (
                  <div
                    key={item.id}
                    className={`${styles.tableRow} grid lg:min-w-[60rem] lg:grid-cols-[minmax(14rem,1.3fr)_7rem_7rem_7rem_6rem_6rem_10rem] lg:items-center`}
                  >
                    <div className="min-w-0">
                      <p className={`${styles.rowTitle} truncate`}>{item.name}</p>
                      <p className={styles.rowMeta}>
                        {item.packageSize} · {item.status === "active" ? "actief" : "inactief"}
                      </p>
                      <p className={`${styles.rowMeta} lg:hidden`}>
                        {item.supplier} · {item.articleNumber} · {formatEuro(item.packagePrice)} per doos · {formatEuro(item.unitPrice)} per stuk · {usageCount} recepten
                      </p>
                    </div>
                    <p className="hidden text-sm font-bold text-[#2d2a26]/62 lg:block">
                      {item.supplier}
                    </p>
                    <p className="hidden text-sm font-bold lg:block">{item.articleNumber}</p>
                    <p className="hidden text-sm font-black lg:block">{formatEuro(item.packagePrice)}</p>
                    <p className="hidden text-sm font-black lg:block">{formatEuro(item.unitPrice)}</p>
                    <p className="hidden text-sm font-bold text-[#2d2a26]/62 lg:block">
                      {usageCount} recept{usageCount === 1 ? "" : "en"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => editPackaging(item)}
                        className={styles.action}
                      >
                        Bewerk
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePackaging(item)}
                        className={`${styles.action} ${styles.dangerAction}`}
                      >
                        Verwijder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState text="Nog geen verpakkingen gevonden met deze filters." />
        )}
      </div>
    </Panel>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal";
}>) {
  return (
    <label className={styles.field}>
      {label}
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MiniMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function createPackagingDraft(): PackagingDraft {
  return {
    id: "",
    name: "",
    supplier: "",
    articleNumber: "",
    packageSize: "100 stuks per doos",
    quantityPerPackage: "100",
    packagePrice: "",
    status: "active",
  };
}

function recipesUsingPackaging(recipes: Recipe[], packagingId: string) {
  return recipes.filter((recipe) =>
    (recipe.packagingItems || []).some((line) => line.packagingId === packagingId)
  );
}

function parseDutchNumber(value: string) {
  const parsed = Number.parseFloat(
    value
      .trim()
      .replace(/\s/g, "")
      .replace(/€|\u00a0/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatInputNumber(value: number) {
  if (!value) return "";

  return String(Math.round(value * 10000) / 10000).replace(".", ",");
}

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

function uniquePackagingId(name: string, packagingItems: PackagingItem[]) {
  const base =
    normalizeSearch(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "verpakking";
  let id = `pkg-${base}`;
  let counter = 1;

  while (packagingItems.some((item) => item.id === id)) {
    counter += 1;
    id = `pkg-${base}-${counter}`;
  }

  return id;
}
