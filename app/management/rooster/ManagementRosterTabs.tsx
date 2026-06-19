"use client";

import { useState } from "react";
import ManagementLaborCosts from "../loonkosten/ManagementLaborCosts";
import ManagementRoster from "./ManagementRoster";

type RosterTab = "werkrooster" | "loonkosten";

const tabs: Array<{ id: RosterTab; label: string }> = [
  { id: "werkrooster", label: "WERKROOSTER" },
  { id: "loonkosten", label: "LOONKOSTEN" },
];

export default function ManagementRosterTabs() {
  const [activeTab, setActiveTab] = useState<RosterTab>("werkrooster");

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 gap-1.5 rounded-full border border-[#d6e5d8] bg-white/85 p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-w-0 flex-1 rounded-full px-3 py-2 text-center text-[clamp(0.62rem,1.35vw,0.9rem)] uppercase tracking-[0.11em] transition ${
              activeTab === tab.id
                ? "bg-[#ef5737] font-black text-white shadow-sm"
                : "font-bold text-[#2d2a26]/55 hover:bg-[#f6faf4] hover:text-[#2d2a26]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "werkrooster" ? <ManagementRoster /> : <ManagementLaborCosts />}
    </div>
  );
}
