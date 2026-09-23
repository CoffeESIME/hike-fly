import type { ElevationPoint } from "../types";
import { metricAtDistance } from "./gpxUtils";

export type ElevationChartData = {
  min: number; max: number; totalDistance: number;
  lines: string[]; areas: string[];
};

export function elevationChartAvailability(profile: ElevationPoint[]): string | null {
  if (profile.length < 2) return "Se necesitan al menos dos puntos de la ruta.";
  if (profile.some(p => p.ele === null || !Number.isFinite(p.ele))) {
    return "Faltan elevaciones válidas en el GPX. El perfil se omitirá durante la animación.";
  }
  if (profile[0].dist !== 0 || profile.some((p, i) => !Number.isFinite(p.dist) || p.dist < 0 || (i > 0 && p.dist < profile[i - 1].dist)) || profile[profile.length - 1].dist <= 0) {
    return "Se necesita una distancia válida mayor que cero para mostrar el perfil.";
  }
  return null;
}

export function chartY(elevation: number, min: number, max: number): number {
  return max === min ? 48 : 86 - (elevation - min) / (max - min) * 76;
}

/** Cache the drawing once. Retain the extrema in each horizontal pixel bucket. */
export function buildElevationChart(profile: ElevationPoint[], segmentStarts: number[]): ElevationChartData | null {
  if (elevationChartAvailability(profile)) return null;
  let min = Infinity, max = -Infinity;
  for (const p of profile) { min = Math.min(min, p.ele!); max = Math.max(max, p.ele!); }
  const totalDistance = profile[profile.length - 1].dist;
  const lines: string[] = [], areas: string[] = [];
  for (const [s, start] of segmentStarts.entries()) {
    const end = segmentStarts[s + 1] ?? profile.length;
    if (end - start < 2) continue;
    const selected: number[] = [];
    for (let i = start; i < end;) {
      const bucket = Math.floor(profile[i].dist / totalDistance * 1000);
      let low = i, high = i, j = i + 1;
      while (j < end && Math.floor(profile[j].dist / totalDistance * 1000) === bucket) {
        if (profile[j].ele! < profile[low].ele!) low = j;
        if (profile[j].ele! > profile[high].ele!) high = j;
        j++;
      }
      selected.push(...Array.from(new Set([i, low, high, j - 1])).sort((a, b) => a - b));
      i = j;
    }
    const x = (i: number) => (profile[i].dist / totalDistance * 1000).toFixed(2);
    const line = selected.map((i, n) => `${n ? "L" : "M"}${x(i)},${chartY(profile[i].ele!, min, max).toFixed(2)}`).join(" ");
    lines.push(line);
    areas.push(`${line} L${x(end - 1)},100 L${x(start)},100 Z`);
  }
  return lines.length ? { min, max, totalDistance, lines, areas } : null;
}

/** Use the original profile for the marker, never the simplified drawing. */
export function elevationChartCursor(profile: ElevationPoint[], chart: ElevationChartData, distance: number) {
  const clamped = Math.max(0, Math.min(chart.totalDistance, Number.isFinite(distance) ? distance : 0));
  const elevation = metricAtDistance(profile, clamped, "ele")!;
  return { x: clamped / chart.totalDistance * 1000, y: chartY(elevation, chart.min, chart.max), elevation, distance: clamped };
}
