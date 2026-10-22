"use client";

import { useState } from "react";
import styles from "./BridalInspiration.module.css";

export default function BridalAtmosphere() {
  const [paused, setPaused] = useState(false);
  return <><div className={styles.atmosphere} data-paused={paused} aria-hidden="true">
    <div className={styles.ambientLight} aria-hidden="true" />
    <svg className={styles.pipedLines} viewBox="0 0 460 460" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth=".8">
        {[0, 60, 120, 180, 240, 300].map(angle => <g key={angle} transform={`rotate(${angle} 230 230)`}><path d="M230 229C154 190 140 100 207 90c68-10 84 70 23 105-68 39-145-3-118-56 23-46 84-19 80 29" /><path d="M229 225c-50-61-42-117 9-121 49-3 62 55 28 83" /></g>)}
        <circle cx="230" cy="230" r="25" /><circle cx="230" cy="230" r="18" />
      </g>
    </svg>
  </div><button type="button" className={styles.motionToggle} onClick={() => setPaused(value => !value)} aria-label={paused ? "Achtergrondbeweging hervatten" : "Achtergrondbeweging pauzeren"} aria-pressed={paused}><span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span>{paused ? "Beweging aan" : "Beweging uit"}</button></>;
}
