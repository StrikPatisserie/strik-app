"use client";

import { useEffect, useState, type RefObject } from "react";

export const PHYSICAL_KEYBOARD_KEY = "strik-production-physical-keyboard-v1";
const textInputs = new Set(["text", "search", "number", "email", "tel", "url", "password"]);

/** This browser's preference only. Hardware typing and normal input validation
 * stay available. inputmode is a browser hint, not an OS keyboard setting.
 */
export default function usePhysicalKeyboard(rootRef: RefObject<HTMLDivElement | null>) {
  const [physicalKeyboard, setPhysicalKeyboard] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      setPhysicalKeyboard(localStorage.getItem(PHYSICAL_KEYBOARD_KEY) === "true");
    } catch { setStorageError(true); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(PHYSICAL_KEYBOARD_KEY, String(physicalKeyboard));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [ready, physicalKeyboard]);

  useEffect(() => {
    const root = rootRef.current;
    if (!physicalKeyboard || !root) return;
    const originals = new Map<HTMLElement, { inputMode: string | null; policy: string | null }>();

    function prepare(element: HTMLElement) {
      if (element.tagName === "INPUT" && !textInputs.has((element.getAttribute("type") || "text").toLowerCase())) return;
      if (originals.has(element)) return;
      originals.set(element, { inputMode: element.getAttribute("inputmode"), policy: element.getAttribute("virtualkeyboardpolicy") });
      element.setAttribute("virtualkeyboardpolicy", "manual");
      element.setAttribute("inputmode", "none");
    }
    function scan() {
      root!.querySelectorAll<HTMLElement>('input,textarea,[contenteditable="true"]').forEach(prepare);
    }
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const [element, original] of originals) {
        if (original.inputMode === null) element.removeAttribute("inputmode");
        else element.setAttribute("inputmode", original.inputMode);
        if (original.policy === null) element.removeAttribute("virtualkeyboardpolicy");
        else element.setAttribute("virtualkeyboardpolicy", original.policy);
      }
    };
  }, [physicalKeyboard, rootRef]);

  return { physicalKeyboard, setPhysicalKeyboard, storageError };
}
