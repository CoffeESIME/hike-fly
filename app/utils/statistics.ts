import type { ElevationPoint, StatisticsSettings } from "../types";
import { metricAtDistance, summarizeProfile } from "./gpxUtils";

export const DEFAULT_STATISTICS: StatisticsSettings = {
  elevationSource: "auto", manualGain: "", liveElevation: true, elevationThreshold: 3,
  durationSource: "auto", manualHours: "", manualMinutes: "", liveDuration: true, showDuration: true,
};

export function nonnegativeNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function manualDuration(settings: StatisticsSettings): number | null {
  if (!settings.manualHours.trim() && !settings.manualMinutes.trim()) return null;
  const hours = nonnegativeNumber(settings.manualHours || "0"), minutes = nonnegativeNumber(settings.manualMinutes || "0");
  if (hours === null || minutes === null || !Number.isInteger(hours) || !Number.isInteger(minutes) || minutes >= 60) return null;
  const seconds = hours * 3600 + minutes * 60;
  return seconds > 0 && Number.isSafeInteger(seconds) ? seconds : null;
}
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const s = Math.floor(seconds), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min ${s % 60} s`;
}
export type StatItem = { key: string; label: string; value: string; unit: string; icon: "route" | "up" | "down" | "mountain" | "clock" | "speed"; detail?: string };

export function statisticsAtDistance(
  profile: ElevationPoint[], settings: StatisticsSettings, distance: number, final = false,
  summary = summarizeProfile(profile),
): StatItem[] {
  const gainLive = !final && settings.elevationSource === "auto" && settings.liveElevation;
  const timeLive = !final && settings.durationSource === "auto" && settings.liveDuration;
  const gain = settings.elevationSource === "manual" ? nonnegativeNumber(settings.manualGain)
    : summary.gain === null ? null : gainLive ? metricAtDistance(profile, distance, "gain") : summary.gain;
  const totalTime = settings.durationSource === "manual" ? manualDuration(settings) : summary.duration;
  const duration = timeLive ? metricAtDistance(profile, distance, "elapsed") : totalTime;
  const meters = (n: number | null) => n === null ? "—" : Math.round(n).toLocaleString("es-MX");
  const stats: StatItem[] = [
    { key: "distance", label: final ? "Distancia" : "Recorrido", value: ((final ? summary.distance : distance) / 1000).toFixed(2), unit: "km", icon: "route" },
    { key: "gain", label: "Desnivel +", value: meters(gain), unit: gain === null ? "" : "m", icon: "up", detail: settings.elevationSource === "manual" ? "Total manual" : gainLive ? "Acumulado GPX" : "Total GPX" },
    { key: "duration", label: timeLive ? "Tiempo transcurrido" : "Duración total", value: formatDuration(duration), unit: "", icon: "clock", detail: settings.durationSource === "manual" ? "Manual · fijo" : "GPX · incluye pausas" },
  ];
  if (!final) stats.push({ key: "altitude", label: "Altitud", value: meters(metricAtDistance(profile, distance, "ele")), unit: "m", icon: "mountain" });
  else {
    if (settings.elevationSource === "auto") stats.push({ key: "loss", label: "Desnivel −", value: meters(summary.loss), unit: summary.loss === null ? "" : "m", icon: "down" });
    stats.push(
      { key: "max", label: "Altitud máxima", value: meters(summary.max), unit: summary.max === null ? "" : "m", icon: "mountain" },
      { key: "min", label: "Altitud mínima", value: meters(summary.min), unit: summary.min === null ? "" : "m", icon: "mountain" },
    );
    if (totalTime !== null && totalTime > 0) stats.push({ key: "speed", label: "Velocidad media", value: (summary.distance / 1000 / (totalTime / 3600)).toFixed(1), unit: "km/h", icon: "speed", detail: "Incluye pausas" });
  }
  return settings.showDuration ? stats : stats.filter(item => item.key !== "duration");
}
