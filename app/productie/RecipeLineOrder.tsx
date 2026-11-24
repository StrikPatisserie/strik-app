"use client";

import { useRef, useState, type PointerEvent } from "react";
import s from "./RecipeLineOrder.module.css";

type Props = { rowKey: number; index: number; keys: number[]; disabled: boolean; onMove: (targetKey: number) => void };

export function moveRecipeLine<T extends { key: number }>(rows: T[], sourceKey: number, targetKey: number): T[] {
  const from = rows.findIndex(row => row.key === sourceKey), to = rows.findIndex(row => row.key === targetKey);
  if (from < 0 || to < 0 || from === to) return rows;
  const next = [...rows];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Pointer capture supports dragging with a mouse, pen or touch screen.
 * Each occurrence has its own key; two lines linked to Water stay distinct. */
export default function RecipeLineOrder({ rowKey, index, keys, disabled, onMove }: Props) {
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = start.current;
    start.current = null;
    setDragging(false);
    if (!cancelled && !disabled && drag?.moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-recipe-line-key]");
      if (target && target.closest("[data-recipe-lines]") === event.currentTarget.closest("[data-recipe-lines]")) {
        const key = Number(target.dataset.recipeLineKey);
        if (keys.includes(key) && key !== rowKey) onMove(key);
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div className={s.controls}>
    <button type="button" className={s.handle} disabled={disabled} aria-label={`Receptregel ${index + 1} verslepen`} title="Versleep of gebruik de pijltjestoetsen" aria-pressed={dragging}
      onPointerDown={event => { if (disabled || event.button !== 0) return; start.current = { x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
      onPointerMove={event => { if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 5) start.current.moved = true; }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
      onLostPointerCapture={() => { start.current = null; setDragging(false); }}
      onKeyDown={event => { const target = event.key === "ArrowUp" ? keys[index - 1] : event.key === "ArrowDown" ? keys[index + 1] : undefined; if (target !== undefined && !disabled) { event.preventDefault(); onMove(target); } }}>
      <span aria-hidden="true">⠿</span>
    </button>
    <button type="button" disabled={disabled || index === 0} aria-label={`Receptregel ${index + 1} omhoog`} onClick={() => onMove(keys[index - 1])}>↑</button>
    <button type="button" disabled={disabled || index === keys.length - 1} aria-label={`Receptregel ${index + 1} omlaag`} onClick={() => onMove(keys[index + 1])}>↓</button>
  </div>;
}
