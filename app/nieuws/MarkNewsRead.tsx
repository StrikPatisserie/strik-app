"use client";

import { useEffect } from "react";
import { NEWS_READ_EVENT, NEWS_READ_KEY } from "./newsState";

export default function MarkNewsRead({ latestKey }: { latestKey: string }) {
  useEffect(() => {
    if (!latestKey) return;

    localStorage.setItem(NEWS_READ_KEY, latestKey);
    window.dispatchEvent(new Event(NEWS_READ_EVENT));
  }, [latestKey]);

  return null;
}
