"use client";

import { useEffect, useRef, useState } from "react";

type CupcakeOrder = {
  id: string;
  mailType?: "cupcake-jubilee" | "major-jubilee" | "birthday-cake";
  employeeName: string;
  yearsLabel?: string;
  eventDateLabel?: string;
  deliveryShop: string;
  deliveryDateLabel: string;
};

type CupcakeOrderResponse = {
  orders?: CupcakeOrder[];
  sent?: CupcakeOrder[];
  skipped?: CupcakeOrder[];
  failed?: CupcakeOrder[];
  message?: string;
  wordpressStatus?: number;
};

function mailTypeLabel(order: CupcakeOrder) {
  if (order.mailType === "birthday-cake") return "verjaardagstaart";
  if (order.mailType === "major-jubilee") return "jubileum-reminder";

  return "cupcake";
}

function orderLine(order: CupcakeOrder) {
  const eventLabel = order.yearsLabel
    ? `${order.yearsLabel} jaar`
    : order.eventDateLabel || "verjaardag";

  return `${mailTypeLabel(order)} · ${order.employeeName} · ${eventLabel} · ${
    order.deliveryShop || "Onbekend"
  }`;
}

export default function PersonnelAutoMailPanel() {
  const requestedRef = useRef(false);
  const [data, setData] = useState<CupcakeOrderResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    async function sendCupcakeOrders() {
      try {
        const response = await fetch("/api/personnel-mail-orders", {
          method: "POST",
          cache: "no-store",
        });
        const responseData = (await response.json().catch(() => null)) as
          | CupcakeOrderResponse
          | null;

        if (!response.ok) {
          setError(
            responseData?.message ||
              "Personeelsmails versturen lukt nog niet."
          );
          setData(responseData);
          return;
        }

        setData(responseData);
      } catch {
        setError("Personeelsmails controleren lukt nog niet.");
      }
    }

    void sendCupcakeOrders();
  }, []);

  const sent = data?.sent || [];
  const skipped = data?.skipped || [];
  const failed = data?.failed || [];
  const orders = data?.orders || [];

  if (!error && orders.length === 0) return null;

  const tone = error || failed.length
    ? "border-[#ef5737] bg-[#fff4ef] text-[#8f2f1d]"
    : sent.length
    ? "border-[#24551d] bg-[#eef6eb] text-[#1f4819]"
    : "border-[#f1d28f] bg-[#fff9e8] text-[#5f4810]";
  const title = error
    ? "Personeelsmail niet verstuurd"
    : sent.length
    ? `${sent.length} personeelsmail${sent.length === 1 ? "" : "s"} verstuurd`
    : `${skipped.length} personeelsmail${
        skipped.length === 1 ? "" : "s"
      } al verstuurd`;
  const visibleOrders = [...sent, ...skipped, ...failed].slice(0, 3);

  return (
    <section className={`rounded-lg border px-3 py-2 shadow-sm ${tone}`}>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase leading-tight">
            {title}
          </p>
          {error ? (
            <p className="mt-0.5 text-[0.72rem] font-bold leading-snug">
              {error}
            </p>
          ) : (
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.72rem] font-bold leading-snug">
              {visibleOrders.map((order) => (
                <span key={order.id}>{orderLine(order)}</span>
              ))}
            </div>
          )}
        </div>
        {orders.length > visibleOrders.length && (
          <span className="shrink-0 text-xs font-black">
            +{orders.length - visibleOrders.length}
          </span>
        )}
      </div>
    </section>
  );
}
