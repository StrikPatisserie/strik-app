"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteOnlineLetterOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function removeOrder() {
    const confirmation = window.prompt(`Deze bestelling wordt echt verwijderd en de klant krijgt een annuleringsmail. Typ ${orderNumber} om te bevestigen:`);
    if (confirmation === null) return;
    if (confirmation.trim() !== orderNumber) {
      setMessage("Ordernummer komt niet overeen. Er is niets verwijderd.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/lettershop/delete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, confirmation: orderNumber }),
      });
      const result = await response.json() as { deleted?: boolean; mailStatus?: string; message?: string };
      if (!response.ok || !result.deleted) throw new Error(result.message || "Verwijderen is niet gelukt.");
      window.alert(result.mailStatus === "SENT"
        ? "Bestelling verwijderd en annuleringsmail verstuurd."
        : "Bestelling verwijderd. De annuleringsmail staat klaar om opnieuw te worden verzonden.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verwijderen is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 border-t border-[#eee3d8] pt-3">
    <button type="button" disabled={busy} onClick={removeOrder} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{busy ? "Verwijderen…" : "Bestelling definitief verwijderen"}</button>
    {message && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{message}</p>}
  </div>;
}
