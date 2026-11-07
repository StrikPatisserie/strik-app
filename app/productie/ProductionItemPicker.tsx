"use client";

import { useMemo } from "react";
import { KIND_LABELS, type Item } from "./planning";
import SearchableChoice from "./SearchableChoice";

export type ProductionPickerItem = Pick<Item, "id" | "name" | "kind" | "articleNumber" | "productionBlocked"> & {
  searchValues?: readonly string[];
};

type Props = {
  items: readonly ProductionPickerItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
  required?: boolean;
};

export default function ProductionItemPicker({ items, label = "Product of halffabricaat", ...props }: Props) {
  const choices = useMemo(() => items.map(item => ({
    id: item.id,
    name: item.name,
    description: `${KIND_LABELS[item.kind]}${item.articleNumber ? ` · ${item.articleNumber}` : ""}`,
    searchValues: item.searchValues,
    badge: item.productionBlocked ? "Recept controleren" : undefined,
  })), [items]);
  return <SearchableChoice {...props} choices={choices} label={label}
    placeholder="Zoek naam, artikelnummer of ingrediënt…" clearLabel="Productkeuze wissen"
    resultsLabel="Gevonden producten en onderdelen" emptyMessage="Geen producten gevonden."/>;
}
