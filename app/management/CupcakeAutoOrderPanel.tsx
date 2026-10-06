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

export type PersonnelAutoMailStatus = {
  loading: boolean;
  alertCount: number;
};

export default function PersonnelAutoMailPanel({
  onStatusChange,
}: Readonly<{
  onStatusChange?: (status: PersonnelAutoMailStatus) => void;
}> = {}) {
  const requestedRef = useRef(false);
  const [data, setData] = useState<CupcakeOrderResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
      }
    }

    void sendCupcakeOrders();
  }, []);

  const failed = data?.failed || [];
  const alertCount = Math.max(failed.length, error ? 1 : 0);

  useEffect(() => {
    onStatusChange?.({ loading, alertCount });
  }, [alertCount, loading, onStatusChange]);

  if (loading || alertCount === 0) return null;

  const visibleOrders = failed.slice(0, 3);

  return (
    <section className="rounded-lg border border-[#ef5737] bg-[#fff4ef] px-3 py-2 text-[#8f2f1d] shadow-sm">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase leading-tight">
            Personeelsmail niet verstuurd
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
        {failed.length > visibleOrders.length && (
          <span className="shrink-0 text-xs font-black">
            +{failed.length - visibleOrders.length}
          </span>
        )}
      </div>
    </section>
  );
}
