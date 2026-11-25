"use client";
import { useEffect, useState } from "react";
import { earliestBusinessFolderDelivery } from "./businessFolderDelivery";

export function useBusinessFolderDelivery() {
  const [minimum, setMinimum] = useState(() => earliestBusinessFolderDelivery());
  useEffect(() => {
    const refresh = () => setMinimum(earliestBusinessFolderDelivery());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return minimum;
}
