"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./LetterOrders.module.css";

type Props = {
  date: string;
  location: string;
  code: string;
  customer: string;
  summary: string;
  status: string;
  tone?: "ready" | "closed";
  statusNote?: string;
  amount: string;
  amountHint?: string;
  openAmount?: boolean;
  action?: ReactNode;
  warning?: ReactNode;
  children: ReactNode;
};

export default function LetterOrderCard(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  return <article className={styles.order}>
    <div className={styles.rowMain}>
      <div className={styles.date}>{props.date}<small>{props.location}</small></div>
      <div className={styles.customer}>
        <p className={styles.code}>{props.code}</p>
        <h3>{props.customer}</h3>
        <p className={styles.summary}>{props.summary}</p>
        {props.warning && <div className={styles.warning}>{props.warning}</div>}
      </div>
      <div className={styles.statusCell}><span className={styles.status} data-tone={props.tone}>{props.status}</span>{props.statusNote && <span className={styles.statusNote}>{props.statusNote}</span>}</div>
      <div className={styles.amount}>{props.amount}{props.amountHint && <small data-open={props.openAmount}>{props.amountHint}</small>}</div>
      <div className={styles.actions}>
        {props.action}
        <button className={styles.toggle} type="button" aria-label={`${expanded ? "Sluit" : "Open"} bestelgegevens van ${props.customer}`} aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(!expanded)}><span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span></button>
      </div>
    </div>
    <div className={styles.detail} id={detailId} hidden={!expanded}>{props.children}</div>
  </article>;
}
