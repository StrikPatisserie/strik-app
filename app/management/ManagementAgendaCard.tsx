"use client";

import { useCallback, useEffect, useState } from "react";
import { StrikActionCard, strikIcons } from "../StrikUI";

type UpcomingCountResponse = {
  count?: number;
};

function formatBadge(count: number) {
  if (count <= 0) return undefined;

  return count > 9 ? "9+" : count;
}

export default function ManagementAgendaCard() {
  const [upcomingCount, setUpcomingCount] = useState(0);

  const loadUpcomingCount = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/tamigo-employees?view=management&mode=upcoming-count&days=7",
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => null)) as
        | UpcomingCountResponse
        | null;

      setUpcomingCount(res.ok ? data?.count || 0 : 0);
    } catch {
      setUpcomingCount(0);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadUpcomingCount();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadUpcomingCount]);

  return (
    <StrikActionCard
      href="/management/agenda"
      label="Team"
      title="Strik Agenda"
      description="Agenda, verjaardagen en jubilea."
      icon={strikIcons.strikAgenda}
      tone="honey"
      badge={formatBadge(upcomingCount)}
    />
  );
}
