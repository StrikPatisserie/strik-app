"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

export function useDeviceOrder(locationId: string, enabled: boolean, ids: string[]) {
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderRef = useRef<string[]>([]);
  const drag = useRef<{ id: string; y: number } | null>(null);
  const key = `strik-temperature-device-order:${locationId}`;

  useEffect(() => {
    let saved: string[] = [];
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(value)) saved = value.filter((id): id is string => typeof id === "string");
    } catch { /* Use the existing order when storage is unavailable. */ }
    orderRef.current = saved;
    setOrder(saved);
  }, [key]);

  const orderedIds = [...ids].sort((a, b) => {
    const first = order.indexOf(a);
    const second = order.indexOf(b);
    return (first < 0 ? Infinity : first) - (second < 0 ? Infinity : second);
  });

  function move(id: string, target: string) {
    const current = [...ids].sort((a, b) => {
      const ai = orderRef.current.indexOf(a), bi = orderRef.current.indexOf(b);
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
    });
    const from = current.indexOf(id), to = current.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    current.splice(from, 1);
    current.splice(to, 0, id);
    orderRef.current = current;
    setOrder(current);
    try { localStorage.setItem(key, JSON.stringify(current)); } catch { /* Keep the order for this session. */ }
  }

  useEffect(() => {
    if (!draggingId) return;
    let frame: number;
    function scroll() {
      const active = drag.current;
      if (!active) return;
      const delta = active.y < 100 ? -12 : active.y > window.innerHeight - 100 ? 12 : 0;
      if (delta) {
        const container = document.querySelector<HTMLElement>("[data-app-content]");
        if (container && container.scrollHeight > container.clientHeight) container.scrollBy(0, delta);
        else window.scrollBy(0, delta);
      }
      frame = requestAnimationFrame(scroll);
    }
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [draggingId]);

  return {
    orderedIds: enabled ? orderedIds : ids,
    draggingId,
    move,
    handleProps(id: string) {
      return {
        onPointerDown(event: PointerEvent<HTMLButtonElement>) {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id, y: event.clientY };
          setDraggingId(id);
        },
        onPointerMove(event: PointerEvent<HTMLButtonElement>) {
          if (drag.current?.id !== id) return;
          drag.current.y = event.clientY;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-temperature-row]")?.dataset.temperatureRow;
          if (target) move(id, target);
        },
        onPointerUp() { drag.current = null; setDraggingId(null); },
        onPointerCancel() { drag.current = null; setDraggingId(null); },
        onLostPointerCapture() { drag.current = null; setDraggingId(null); },
      };
    },
  };
}
