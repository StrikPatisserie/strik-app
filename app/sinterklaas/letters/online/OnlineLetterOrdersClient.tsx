"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { lettershopShopLabel } from "@/app/lettershop/shops";
import { formatPickupDate } from "@/app/lettershop/formatPickupDate";
import LetterOrderCard from "../LetterOrderCard";
import { LetterOrdersColumns, LetterOrdersHeader } from "../LetterOrdersLayout";
import styles from "../LetterOrders.module.css";
import DeleteOnlineLetterOrderButton from "./DeleteOnlineLetterOrderButton";
import { filterOnlineOrders, onlineItemLabel, onlineOrderStatuses, onlineOrderTotal, type OnlineLetterOrder } from "./onlineOrders";

function money(cents: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function monthLabel(key: string) {
  return key === "zonder-datum" ? "Zonder datum" : new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(`${key}-01T12:00:00`));
}

export default function OnlineLetterOrdersClient({ orders, photoUrls, error }: { orders: OnlineLetterOrder[]; photoUrls: Record<string, string>; error?: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const visibleOrders = useMemo(() => filterOnlineOrders(orders, search, status), [orders, search, status]);
  const groups = new Map<string, OnlineLetterOrder[]>();
  visibleOrders.forEach((order) => {
    const key = /^\d{4}-\d{2}-\d{2}$/.test(order.requested_date) ? order.requested_date.slice(0, 7) : "zonder-datum";
    groups.set(key, [...(groups.get(key) || []), order]);
  });

  return <div className={styles.page}>
    <LetterOrdersHeader channel="online" action={<Link href="/lettershop" target="_blank" className={styles.button}>Open Lettershop ↗</Link>} />
    <div className={styles.meta}><span>Bestellingen <b>{visibleOrders.length}</b></span><span>Letters <b>{visibleOrders.reduce((sum, order) => sum + order.letter_order_items.reduce((count, item) => count + item.quantity, 0), 0)}</b></span><span>Totaal getoond <b>{money(visibleOrders.reduce((sum, order) => sum + onlineOrderTotal(order), 0))}</b></span></div>
    <div className={styles.tools}>
      <input className={styles.search} aria-label="Zoek Lettershopbestellingen" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek klant, ordernummer of letter…" />
      <select aria-label="Status Lettershopbestellingen" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Alle statussen</option>{Object.entries(onlineOrderStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </div>
    {error && <p role="alert" className={styles.error}>Bestellingen laden is mislukt: {error}</p>}
    <div className={styles.list}>
      <LetterOrdersColumns />
      {!error && !visibleOrders.length && <p className={styles.empty}>{orders.length ? "Geen bestellingen gevonden voor deze zoekopdracht." : "Er zijn nog geen online letterbestellingen."}</p>}
      {Array.from(groups.entries()).map(([key, group]) => <section key={key} aria-label={monthLabel(key)}>
        <div className={styles.month}><h2>{monthLabel(key)}</h2><span>{group.length} {group.length === 1 ? "bestelling" : "bestellingen"}</span></div>
        {group.map((order) => {
          const quantity = order.letter_order_items.reduce((sum, item) => sum + item.quantity, 0);
          return <LetterOrderCard key={order.id}
            date={formatPickupDate(order.requested_date) || "Geen datum"}
            location={lettershopShopLabel(order.pickup_location)}
            code={`${order.order_number} · ${quantity} letters`}
            customer={order.customer_name}
            summary={order.letter_order_items.map(onlineItemLabel).join(" · ")}
            status={onlineOrderStatuses[order.fulfillment_status] || order.fulfillment_status}
            tone={order.fulfillment_status === "READY" ? "ready" : ["COMPLETED", "CANCELLED"].includes(order.fulfillment_status) ? "closed" : undefined}
            amount={money(onlineOrderTotal(order))}
            warning={order.notes ? <p>Let op: {order.notes}</p> : undefined}
          >
            <div className={styles.detailGrid}>
              <div>
                <h4>Bestelling · {quantity} letters</h4>
                <ul className={styles.lines}>{order.letter_order_items.map((item, index) => <li key={index}>{onlineItemLabel(item)}{item.logo_storage_path && photoUrls[item.logo_storage_path] && <p><a href={photoUrls[item.logo_storage_path]} target="_blank" rel="noreferrer">Bekijk foto / logo ↗</a></p>}</li>)}</ul>
                {order.gift_wrap && <p>Cadeaupapier · alle letters ingepakt · {money(order.gift_wrap_price_cents)} per letter</p>}
                {order.notes && <p><strong>Opmerking:</strong> {order.notes}</p>}
              </div>
              <div>
                <h4>Contact & afhalen</h4>
                {order.customer_email && <p><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></p>}
                {order.phone && <p><a href={`tel:${order.phone}`}>{order.phone}</a></p>}
                <p>{formatPickupDate(order.requested_date)}</p>
                <p>{lettershopShopLabel(order.pickup_location)}</p>
                <p className={styles.muted}>Besteld via de Lettershop · {order.order_number}</p>
              </div>
            </div>
            {order.fulfillment_status === "NEW" && <div className={styles.detailActions}><DeleteOnlineLetterOrderButton orderId={order.id} orderNumber={order.order_number} className={styles.remove} /></div>}
          </LetterOrderCard>;
        })}
      </section>)}
    </div>
    <p className={styles.footer}><span>{visibleOrders.length} van {orders.length} {orders.length === 1 ? "bestelling" : "bestellingen"} zichtbaar</span><span>Gesorteerd op ophaaldatum · bedragen incl. btw</span></p>
  </div>;
}
