"use client";
import { useEffect, useRef } from "react";
import type { StatItem } from "../utils/statistics";
import { Icon } from "./Icon";

export function RouteCompleteOverlay({ items, onClose }: { items: StatItem[]; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();
    return () => previous?.focus();
  }, []);
  return <section className="route-complete" role="dialog" aria-modal="true" aria-labelledby="complete-title"
    onKeyDown={e => { if (e.key === "Escape") onClose(); if (e.key === "Tab") { e.preventDefault(); buttonRef.current?.focus(); } }}>
    <div className="complete-content">
      <p className="eyebrow">FLYBY / RESUMEN DEL RECORRIDO</p>
      <h2 id="complete-title">Cada paso cuenta.</h2>
      <div className="complete-stats">
        {items.map(item => <div key={item.key}>
          <span className="stat-label"><Icon name={item.icon} /> {item.label}</span>
          <strong>{item.value} <small>{item.unit}</small></strong>
          {item.detail && <span className="stat-detail">{item.detail}</span>}
        </div>)}
      </div>
      <button ref={buttonRef} className="quiet-button" onClick={onClose}>Volver al mapa <span aria-hidden="true">↗</span></button>
    </div>
  </section>;
}
