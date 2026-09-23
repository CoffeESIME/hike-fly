"use client";
import { useEffect, useId, useRef } from "react";
import type { ElevationPoint } from "../types";
import { elevationChartCursor, type ElevationChartData } from "../utils/elevationChart";
import { Icon } from "./Icon";

export type ElevationProgressRef = React.RefObject<((distance: number) => void) | null>;

export function ElevationProfile({ profile, chart, progressRef, distanceRef }: {
  profile: ElevationPoint[]; chart: ElevationChartData;
  progressRef: ElevationProgressRef; distanceRef: React.RefObject<number>;
}) {
  const gradientId = useId();
  const lineRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const altitudeRef = useRef<HTMLSpanElement>(null);
  const distanceLabelRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const update = (distance: number) => {
      const cursor = elevationChartCursor(profile, chart, distance);
      lineRef.current?.setAttribute("transform", `translate(${cursor.x} 0)`);
      dotRef.current?.setAttribute("transform", `translate(${cursor.x} ${cursor.y})`);
      const altitude = `${Math.round(cursor.elevation).toLocaleString("es-MX")} m`;
      const km = `${(cursor.distance / 1000).toFixed(2)} km`;
      if (altitudeRef.current && altitudeRef.current.textContent !== altitude) altitudeRef.current.textContent = altitude;
      if (distanceLabelRef.current && distanceLabelRef.current.textContent !== km) distanceLabelRef.current.textContent = km;
    };
    progressRef.current = update;
    update(distanceRef.current);
    return () => { if (progressRef.current === update) progressRef.current = null; };
  }, [profile, chart, progressRef, distanceRef]);

  return <section className="elevation-profile" aria-label="Perfil de elevación del recorrido">
    <div className="elevation-profile-heading">
      <span><Icon name="mountain" /> Elevación</span>
      <span className="elevation-profile-position"><span ref={altitudeRef} /> <span aria-hidden="true">/</span> <span ref={distanceLabelRef} /></span>
    </div>
    <div className="elevation-profile-plot">
      <div className="elevation-profile-axis" aria-hidden="true"><span>{Math.round(chart.max).toLocaleString("es-MX")} m</span><span>{Math.round(chart.min).toLocaleString("es-MX")} m</span></div>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label={`Elevación entre ${Math.round(chart.min)} y ${Math.round(chart.max)} metros. Distancia ${(chart.totalDistance / 1000).toFixed(2)} kilómetros.`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e9ac75" stopOpacity=".26" /><stop offset="100%" stopColor="#94b999" stopOpacity=".06" /></linearGradient></defs>
        <path d="M0 10H1000 M0 86H1000" stroke="currentColor" strokeOpacity=".15" vectorEffect="non-scaling-stroke" fill="none" />
        {chart.areas.map((d, i) => <path key={i} d={d} fill={`url(#${gradientId})`} />)}
        {chart.lines.map((d, i) => <path key={i} d={d} fill="none" stroke="#e9ac75" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
        <line ref={lineRef} x1="0" x2="0" y1="0" y2="100" stroke="#f6eedf" strokeOpacity=".8" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <circle ref={dotRef} cx="0" cy="0" r="4" fill="#f6eedf" stroke="#e9ac75" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
    <div className="elevation-profile-distance" aria-hidden="true"><span>0 km</span><span>{(chart.totalDistance / 1000).toFixed(2)} km</span></div>
  </section>;
}
