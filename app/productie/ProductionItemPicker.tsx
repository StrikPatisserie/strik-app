"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Icon from "./ProductionIcon";
import { KIND_LABELS, matchesProductionSearch, type Item } from "./planning";
import styles from "./ProductionItemPicker.module.css";

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

const RESULT_LIMIT = 60;

export default function ProductionItemPicker({
  items,
  value,
  onChange,
  disabled = false,
  label = "Product of halffabricaat",
  required = false,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = items.find(item => item.id === value);
  const expanded = open && !disabled;
  const results = useMemo(() => {
    const visible: ProductionPickerItem[] = [];
    let count = 0;
    for (const item of items) {
      if (!matchesProductionSearch(query, [item.name, item.articleNumber, ...(item.searchValues || [])])) continue;
      count += 1;
      if (visible.length < RESULT_LIMIT) visible.push(item);
    }
    return { visible, count };
  }, [items, query]);
  const highlightedIndex = Math.min(activeIndex, results.visible.length - 1);
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    if (!expanded || highlightedIndex < 0) return;
    const option = listRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    option?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [expanded, highlightedIndex, query]);

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function choose(item: ProductionPickerItem) {
    onChange(item.id);
    close();
  }

  function clear() {
    inputRef.current?.focus();
    onChange("");
    setQuery("");
    setOpen(true);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Enter" && expanded) {
      event.preventDefault();
      const item = results.visible[highlightedIndex];
      if (item) choose(item);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!expanded) {
      setQuery(selected?.name || "");
      setOpen(true);
      setActiveIndex(0);
      return;
    }
    const lastIndex = results.visible.length - 1;
    setActiveIndex(event.key === "ArrowDown"
      ? highlightedIndex >= lastIndex ? 0 : highlightedIndex + 1
      : highlightedIndex <= 0 ? lastIndex : highlightedIndex - 1);
  }

  return <div className={styles.picker} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }}>
    <label className={styles.label} htmlFor={`${id}-input`}>{label}</label>
    <div className={styles.control} data-disabled={disabled}>
      <Icon name="search" size={16}/>
      <input
        ref={inputRef}
        id={`${id}-input`}
        className={styles.input}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-list` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={expanded && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined}
        aria-describedby={expanded ? `${id}-status` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        required={required}
        value={expanded ? query : selected?.name || ""}
        placeholder="Zoek naam, artikelnummer of ingrediënt…"
        onFocus={event => {
          setQuery(selected?.name || "");
          setOpen(true);
          setActiveIndex(0);
          event.currentTarget.select();
        }}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
          if (value) onChange("");
        }}
        onKeyDown={handleKeyDown}
      />
      {!disabled && (value || query) && <button className={styles.clear} type="button" aria-label="Productkeuze wissen" title="Productkeuze wissen" onClick={clear}><Icon name="close" size={16}/></button>}
    </div>
    {expanded && <div className={styles.popup}>
      <ul ref={listRef} id={`${id}-list`} className={styles.options} role="listbox" aria-label="Gevonden producten en onderdelen">
        {results.visible.map((item, index) => <li
          key={item.id}
          id={optionId(index)}
          role="option"
          tabIndex={-1}
          aria-selected={index === highlightedIndex}
          className={`${styles.option} ${index === highlightedIndex ? styles.active : ""}`}
          onMouseDown={event => event.preventDefault()}
          onMouseMove={() => setActiveIndex(index)}
          onClick={() => choose(item)}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              choose(item);
            }
          }}
        >
          <span className={styles.itemName}>{item.name}</span>
          <span className={styles.meta}>{KIND_LABELS[item.kind]}{item.articleNumber && ` · ${item.articleNumber}`}</span>
          {item.productionBlocked && <span className={styles.blocked}>Recept controleren</span>}
        </li>)}
      </ul>
      <p id={`${id}-status`} className={styles.resultStatus} role="status">
        {results.count === 0 ? "Geen producten gevonden."
          : results.count > RESULT_LIMIT ? `${RESULT_LIMIT} van ${results.count} resultaten · verfijn je zoekopdracht`
          : `${results.count} ${results.count === 1 ? "resultaat" : "resultaten"}`}
      </p>
    </div>}
  </div>;
}
