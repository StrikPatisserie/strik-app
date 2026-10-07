"use client";

import { useState } from "react";
import styles from "./print.module.css";

export default function PrintActions({
  sessionId,
  initialEmailedAt,
  initialEmailedTo,
}: {
  sessionId: string;
  initialEmailedAt: string;
  initialEmailedTo: string;
}) {
  const [printing, setPrinting] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(
    initialEmailedAt ? `Al gemaild naar ${initialEmailedTo}.` : ""
  );
  const pdfUrl = `/api/price-cards/pdf?session=${encodeURIComponent(sessionId)}`;

  async function printCards() {
    const printWindow = window.open("", "_blank");
    setPrinting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/price-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-session-printed", sessionId }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Printstatus opslaan is mislukt.");
      if (printWindow) printWindow.location.href = pdfUrl;
      else window.location.href = pdfUrl;
      setSuccess("Printklare PDF geopend. Print op 100% zonder marges.");
    } catch (printError) {
      printWindow?.close();
      setError(printError instanceof Error ? printError.message : "Afdrukken is mislukt.");
    } finally {
      setPrinting(false);
    }
  }

  async function emailPdf() {
    setMailing(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/price-cards/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await response.json()) as { message?: string; recipient?: string };
      if (!response.ok) throw new Error(data.message || "PDF mailen is mislukt.");
      setSuccess(`Klaar: de PDF staat in de inbox van ${data.recipient || "info@strik-patisserie.nl"}.`);
    } catch (mailError) {
      setError(mailError instanceof Error ? mailError.message : "PDF mailen is mislukt.");
    } finally {
      setMailing(false);
    }
  }

  return (
    <div className={styles.actions}>
      <a
        className={styles.backLink}
        href={`/management/prijskaartjes?session=${encodeURIComponent(sessionId)}`}
      >
        ← Aanpassen
      </a>
      <span className={styles.printHint}>Iedere pagina is één kaartje · brood wordt automatisch staand</span>
      {error ? <strong className={styles.actionError}>{error}</strong> : null}
      {success ? <strong className={styles.actionSuccess}>{success}</strong> : null}
      <a className={styles.actionButton} href={`${pdfUrl}&download=1`}>
        Download PDF
      </a>
      <button
        type="button"
        className={styles.printAction}
        onClick={() => void printCards()}
        disabled={printing || mailing}
      >
        {printing ? "Openen…" : "Open om te printen"}
      </button>
      <button
        type="button"
        className={styles.mailAction}
        onClick={() => void emailPdf()}
        disabled={printing || mailing}
      >
        {mailing ? "Mailen…" : "Mail naar info@strik-patisserie.nl"}
      </button>
    </div>
  );
}
