"use client";

import { useState } from "react";
import PersonnelAutoMailPanel from "./CupcakeAutoOrderPanel";
import JubileeReminderPanel, {
  JubileeReminderStatus,
} from "./JubileeReminderPanel";
import WordPressStatusPanel from "./WordPressStatusPanel";

export default function ManagementStatusSection() {
  const [jubileeStatus, setJubileeStatus] = useState<JubileeReminderStatus>({
    loading: true,
    openAlertCount: 0,
  });
  const hasOpenJubileeAlerts = jubileeStatus.openAlertCount > 0;

  return (
    <details className="group mt-5">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between border-y py-3 text-sm font-black [&::-webkit-details-marker]:hidden ${
          hasOpenJubileeAlerts
            ? "border-[#ef5737]/45 bg-[#fff7f4] px-3 text-[#8f2f1d]"
            : "border-[#e7e0d8] text-[#2d2a26]/70"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          Meldingen & status
          {hasOpenJubileeAlerts && (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef5737] px-1.5 text-xs font-black leading-none text-white shadow-sm"
              title={`${jubileeStatus.openAlertCount} open verjaardag of jubileum`}
              aria-label={`${jubileeStatus.openAlertCount} open verjaardag of jubileum`}
            >
              !
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {hasOpenJubileeAlerts && (
            <span className="hidden text-[0.66rem] font-black uppercase leading-tight tracking-normal text-[#b73524] sm:inline">
              {jubileeStatus.openAlertCount} open
            </span>
          )}
          <span className="text-xl leading-none transition group-open:rotate-90">
            &gt;
          </span>
        </span>
      </summary>

      <div className="mt-3 grid gap-3">
        <JubileeReminderPanel onStatusChange={setJubileeStatus} />
        <PersonnelAutoMailPanel />
        <WordPressStatusPanel />
      </div>
    </details>
  );
}
