"use client";

import { useState } from "react";
import styles from "./print.module.css";

export default function PrintActions({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function printCards() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/price-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-session-printed", sessionId }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Printstatus opslaan is mislukt.");
      window.print();
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "Afdrukken is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.actions}>
      <a href="/management/prijskaartjes">← Terug naar kaartjes</a>
      <span>Evolis: 85 × 55 mm · schaal 100% · marges geen</span>
      {error ? <strong>{error}</strong> : null}
      <button type="button" onClick={() => void printCards()} disabled={busy}>
        {busy ? "Voorbereiden…" : "Afdrukken / opslaan als PDF"}
      </button>
    </div>
  );
}
