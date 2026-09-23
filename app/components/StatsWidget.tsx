"use client";
import type React from "react";
import type { StatItem } from "../utils/statistics";
import { Icon } from "./Icon";

export function StatsWidget({ statsRef, items }: {
  statsRef: React.RefObject<HTMLDivElement | null>; items: StatItem[];
}) {
  return <div ref={statsRef} className={`live-stats${items.length === 1 ? " live-stats-single" : ""}`} style={{ "--stat-count": items.length } as React.CSSProperties} aria-label="Estadísticas del recorrido">
    {items.map(item => <div key={item.key} className="live-stat">
      <span className="stat-label"><Icon name={item.icon} /> {item.label}</span>
      <strong><span data-stat={item.key}>{item.value}</span> <small>{item.unit}</small></strong>
      {item.detail && <span className="stat-detail">{item.detail}</span>}
    </div>)}
  </div>;
}
