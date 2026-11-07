"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Icon from "./ProductionIcon";
import { matchesProductionSearch } from "./planning";
import styles from "./SearchableChoice.module.css";

export type SearchableChoiceOption = {
  id: string;
  name: string;
  description?: string;
  searchValues?: readonly string[];
  disabled?: boolean;
  badge?: string;
};

export type SearchableChoiceProps = {
  choices: readonly SearchableChoiceOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label: string;
  required?: boolean;
  name?: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  clearLabel?: string;
  resultsLabel?: string;
  emptyMessage?: string;
};

const RESULT_LIMIT = 60;

export default function SearchableChoice({
  choices,
  value,
  onChange,
  disabled = false,
  label,
  required = false,
  name,
  invalid = false,
  describedBy,
  placeholder = "Typ om te zoeken…",
  clearLabel = `${label} wissen`,
  resultsLabel = "Gevonden opties",
  emptyMessage = "Geen resultaten gevonden.",
}: SearchableChoiceProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const selected = useMemo(() => choices.find(choice => choice.id === value), [choices, value]);
  const selectedName = selected?.name || (value ? `Ontbrekende koppeling (${value})` : "");
  const missing = Boolean(value) && !selected;
  const expanded = open && !disabled;
  const pendingChoice = expanded && query.trim() !== (selected?.name || "").trim();
  const results = useMemo(() => {
    const visible: SearchableChoiceOption[] = [];
    let count = 0;
    if (!expanded) return { visible, count };
    for (const item of choices) {
      if (!matchesProductionSearch(query, [item.name, item.description, ...(item.searchValues || [])])) continue;
      count += 1;
      if (visible.length < RESULT_LIMIT) visible.push(item);
    }
    if (selected && query === selected.name && !visible.some(choice => choice.id === selected.id)) {
      visible.splice(Math.max(0, RESULT_LIMIT - 1), 1, selected);
    }
    return { visible, count };
  }, [choices, query, expanded, selected]);
  const unchangedSelection = Boolean(selected) && query === selected?.name;
  const cappedIndex = Math.min(activeIndex ?? 0, results.visible.length - 1);
  const highlightedIndex = activeIndex === null && unchangedSelection
    ? results.visible.findIndex(choice => choice.id === value && !choice.disabled)
    : results.visible[cappedIndex] && !results.visible[cappedIndex].disabled
      ? cappedIndex : results.visible.findIndex(choice => !choice.disabled);
  const optionId = (index: number) => `${id}-option-${index}`;
  const descriptionIds = [describedBy, expanded ? `${id}-status` : undefined].filter(Boolean).join(" ") || undefined;

  useEffect(() => {
    inputRef.current?.setCustomValidity(pendingChoice ? "Kies een resultaat of wis de zoekopdracht." : "");
  }, [pendingChoice]);

  useEffect(() => {
    if (!expanded || highlightedIndex < 0) return;
    const option = listRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    option?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [expanded, highlightedIndex, query]);

  function close() {
    inputRef.current?.setCustomValidity("");
    setOpen(false);
    setQuery("");
    setActiveIndex(null);
  }

  function choose(item: SearchableChoiceOption) {
    if (item.disabled) return;
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
      if (activeIndex === null && unchangedSelection) {
        close();
        return;
      }
      const item = results.visible[highlightedIndex];
      if (item) choose(item);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!expanded) {
      setQuery(selectedName);
      setOpen(true);
      setActiveIndex(null);
      return;
    }
    const enabled = results.visible.flatMap((choice, index) => choice.disabled ? [] : [index]);
    if (!enabled.length) return;
    const position = enabled.indexOf(highlightedIndex);
    const next = event.key === "ArrowDown" ? (position + 1) % enabled.length : position <= 0 ? enabled.length - 1 : position - 1;
    setActiveIndex(enabled[next]);
  }

  return <div className={styles.picker} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }}>
    <label className={styles.label} htmlFor={`${id}-input`}>{label}</label>
    {name && <input type="hidden" name={name} value={value} disabled={disabled}/>}
    <div className={styles.control} data-disabled={disabled} data-invalid={invalid || missing}>
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
        aria-invalid={invalid || missing || undefined}
        aria-describedby={descriptionIds}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        required={required}
        value={expanded ? query : selectedName}
        placeholder={placeholder}
        onFocus={event => {
          setQuery(selectedName);
          setOpen(true);
          setActiveIndex(null);
          event.currentTarget.select();
        }}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(null);
        }}
        onKeyDown={handleKeyDown}
      />
      {!disabled && (value || query) && <button className={styles.clear} type="button" aria-label={clearLabel} title={clearLabel} onClick={clear}><Icon name="close" size={16}/></button>}
    </div>
    {expanded && <div className={styles.popup}>
      <ul ref={listRef} id={`${id}-list`} className={styles.options} role="listbox" aria-label={resultsLabel}>
        {results.visible.map((item, index) => <li
          key={item.id}
          id={optionId(index)}
          role="option"
          tabIndex={-1}
          aria-disabled={item.disabled || undefined}
          aria-selected={index === highlightedIndex}
          className={`${styles.option} ${index === highlightedIndex ? styles.active : ""}`}
          onMouseDown={event => event.preventDefault()}
          onMouseMove={() => { if (!item.disabled) setActiveIndex(index); }}
          onClick={() => choose(item)}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              choose(item);
            }
          }}
        >
          <span className={styles.itemName}>{item.name}</span>
          {item.description && <span className={styles.meta}>{item.description}</span>}
          {item.badge && <span className={styles.badge}>{item.badge}</span>}
        </li>)}
      </ul>
      <p id={`${id}-status`} className={styles.resultStatus} role="status">
        {results.count === 0 ? emptyMessage
          : results.count > RESULT_LIMIT ? `${RESULT_LIMIT} van ${results.count} resultaten · verfijn je zoekopdracht`
          : `${results.count} ${results.count === 1 ? "resultaat" : "resultaten"}`}
      </p>
    </div>}
  </div>;
}
