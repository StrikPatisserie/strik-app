"use client";
import { useState } from "react";
import { B2BOrderForm } from "../../sinterklaas/b2b/SinterklaasB2BClient";
import { normalizeB2BOrder, type saveB2BOrder } from "../../sinterklaas/sinterklaasApi";
import { b2bProductionLetters } from "../../sinterklaas/b2bCombinationLetters";
import type { SinterklaasB2BOrder } from "../../sinterklaas/types";
import styles from "../../sinterklaas/b2b/B2BOrders.module.css";

export default function B2BEntryPreview() {
  const [editing, setEditing] = useState(true), [initial, setInitial] = useState<SinterklaasB2BOrder | null>(null);
  const [saved, setSaved] = useState<SinterklaasB2BOrder | null>(null);
  const [version, setVersion] = useState(0);
  const save: typeof saveB2BOrder = async input => {
    const result = normalizeB2BOrder({ ...input, id: input.id || "preview-order", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    if (!result) throw Error("Controleer de proefbestelling.");
    return result;
  };
  function start(existing = false) {
    setInitial(existing ? normalizeB2BOrder({ id: "preview-existing", customerName: "Voorbeeldbedrijf", year: "2026", season: "sint", status: "akkoord", department: "bakkerij", deliveryDate: "2026-11-24", deliveryMethod: "Afhalen bij Strik Heyendaal", orderText: "PRODUCTEN EN PRIJS\n20 × Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter · letter S · € 12,50 p.s. ex btw · € 250,00", totalExVat: "250,00", letterLines: [] }) : null);
    setVersion(value => value + 1); setEditing(true);
  }
  const letters = saved ? b2bProductionLetters(saved) : null;
  return <main style={{ minHeight: "100dvh", background: "#c3d3bc", padding: "24px clamp(12px,4vw,60px)" }}>
    <div className={styles.page} style={{ maxWidth: 1200, margin: "0 auto" }}>
      <p style={{ fontSize: 11, marginBottom: 14, color: "#53644d" }}>Lokale preview · proefbestellingen · er worden geen echte bestellingen of mails verstuurd</p>
      <header className={styles.header}><div><p className={styles.eyebrow}>Sinterklaas · B2B</p><h1>{editing ? initial ? "Bestelling wijzigen" : "Nieuwe bestelling" : "Proefbestelling opgeslagen"}</h1></div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button" className={styles.button} onClick={() => start()}>Nieuwe proef</button><button type="button" className={styles.button} onClick={() => start(true)}>Pakket zonder smaak testen</button></div></header>
      {editing ? <B2BOrderForm key={version} initialOrder={initial} season="sint" saveOrder={save} onSaved={order => { setSaved(order); setEditing(false); }} onCancel={() => setEditing(false)} /> : saved ? <section className={styles.formPanel}>
        <h2>{saved.customerName}</h2><p style={{ marginBottom: 15 }}>{saved.totalExVat} excl. btw</p>
        <button type="button" className={styles.button} onClick={() => { setInitial(saved); setVersion(value => value + 1); setEditing(true); }}>Proefbestelling wijzigen</button>
        <h3 style={{ marginTop: 24, marginBottom: 10 }}>Letterplanning</h3>
        {letters?.lines.map(line => <div key={line.id} style={{ borderBottom: "1px solid #d9e2d3", padding: "10px 0", fontSize: 13 }}><strong>{line.quantity}× {line.letter}</strong> · {line.chocolate} · {line.size} · {line.style}{line.combinationProduct && <p style={{ color: "#855e20", marginTop: 4 }}>Combinatieproduct: {line.combinationProduct} · hoort bij dit pakket</p>}</div>)}
        {letters?.issues.map(issue => <p key={issue.product} role="alert">Eerst controleren: {issue.quantity}× {issue.product} · {issue.message}</p>)}
        {!letters?.requiredQuantity && <p>Geen chocoladeletters in deze bestelling.</p>}
      </section> : <p>Kies ‘Nieuwe proef’ om het formulier te bekijken.</p>}
    </div>
  </main>;
}
