"use client";

import { useState } from "react";
import PersonnelAutoMailPanel, {
  PersonnelAutoMailStatus,
} from "./CupcakeAutoOrderPanel";
import JubileeReminderPanel, {
  JubileeReminderStatus,
} from "./JubileeReminderPanel";
import WordPressStatusPanel from "./WordPressStatusPanel";

export default function ManagementStatusSection() {
  const [jubileeStatus, setJubileeStatus] = useState<JubileeReminderStatus>({
    loading: true,
    openAlertCount: 0,
  });
  const [mailStatus, setMailStatus] = useState<PersonnelAutoMailStatus>({
    loading: true,
    alertCount: 0,
  });
  const notificationCount =
    jubileeStatus.openAlertCount + mailStatus.alertCount;
  const hasNotifications = notificationCount > 0;

  return (
    <div className="mt-5">
      <section
        className={
          hasNotifications
            ? "rounded-xl border border-[#ef5737]/45 bg-white/70 p-2 shadow-sm"
            : ""
        }
      >
        {hasNotifications && (
          <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs font-black uppercase tracking-[0.08em] text-[#8f2f1d]">
            <span className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#ef5737] text-xs leading-none text-white shadow-sm">
                !
              </span>
              Meldingen
            </span>
            <span>{notificationCount} open</span>
          </div>
        )}
        <div className={hasNotifications ? "grid gap-2" : "hidden"}>
          <JubileeReminderPanel onStatusChange={setJubileeStatus} />
          <PersonnelAutoMailPanel onStatusChange={setMailStatus} />
        </div>
      </section>

      <div className="mt-2 flex justify-end px-1">
        <WordPressStatusPanel />
      </div>
    </div>
  );
}
