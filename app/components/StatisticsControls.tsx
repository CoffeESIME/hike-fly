"use client";
import type { StatisticsSettings } from "../types";
import type { summarizeProfile } from "../utils/gpxUtils";
import { formatDuration, manualDuration, nonnegativeNumber } from "../utils/statistics";
import { Icon } from "./Icon";

export function StatisticsControls({ settings, onChange, summary }: {
  settings: StatisticsSettings; onChange: (settings: StatisticsSettings) => void; summary: ReturnType<typeof summarizeProfile>;
}) {
  const update = (patch: Partial<StatisticsSettings>) => onChange({ ...settings, ...patch });
  return <details className="settings-section" open>
    <summary><Icon name="settings" /> Estadísticas <span>DATOS DE LA RUTA</span></summary>
    <label>Desnivel positivo<select value={settings.elevationSource} onChange={e => update({ elevationSource: e.target.value as "auto" | "manual" })}>
      <option value="auto">Calcular desde el GPX</option><option value="manual">Introducir total manual</option>
    </select></label>
    {settings.elevationSource === "manual" ? <>
      <label>Desnivel + (m)<input type="number" min="0" step="any" placeholder="Ej. 850" value={settings.manualGain} onChange={e => update({ manualGain: e.target.value })} aria-invalid={nonnegativeNumber(settings.manualGain) === null} /></label>
      <p className="settings-help">{nonnegativeNumber(settings.manualGain) === null ? "Introduce un total válido, mayor o igual que cero. " : ""}El total manual permanece fijo durante la animación.</p>
    </> : <>
      <label>Filtro de elevación<select value={settings.elevationThreshold} onChange={e => update({ elevationThreshold: Number(e.target.value) })}>
        <option value="0">Sin filtro · suma de ascensos</option><option value="3">Ignorar oscilaciones menores a 3 m</option><option value="5">Ignorar oscilaciones menores a 5 m</option>
      </select></label>
      <p className="settings-help">{summary.gain === null ? "Faltan elevaciones: el desnivel no está disponible. Puedes introducirlo manualmente." : `Estimación GPX: ${Math.round(summary.gain).toLocaleString("es-MX")} m de ascenso. El filtro reduce pequeñas oscilaciones del GPS.`}</p>
      <label className="check-setting"><input type="checkbox" checked={settings.liveElevation} disabled={summary.gain === null} onChange={e => update({ liveElevation: e.target.checked })} /> Acumular desnivel durante la animación</label>
      {!settings.liveElevation && <p className="settings-help">Se mostrará el desnivel total fijo.</p>}
    </>}
    <label>Duración de la actividad<select value={settings.durationSource} onChange={e => update({ durationSource: e.target.value as "auto" | "manual" })}>
      <option value="auto">Leer tiempos del GPX</option><option value="manual">Introducir horas y minutos</option>
    </select></label>
    {settings.durationSource === "manual" ? <>
      <div className="setting-columns">
        <label>Horas<input type="number" min="0" step="1" placeholder="0" value={settings.manualHours} onChange={e => update({ manualHours: e.target.value })} /></label>
        <label>Minutos<input type="number" min="0" max="59" step="1" placeholder="0" value={settings.manualMinutes} onChange={e => update({ manualMinutes: e.target.value })} /></label>
      </div>
      <p className="settings-help">{manualDuration(settings) === null ? "Introduce una duración positiva; minutos de 0 a 59. " : ""}La duración manual se muestra como total fijo.</p>
    </> : <>
      <p className="settings-help">{summary.duration === null ? "El GPX no contiene tiempos completos y ordenados. Puedes introducir la duración manualmente." : `Duración: ${formatDuration(summary.duration)}. Incluye pausas entre el primer y el último punto.`}</p>
      <label className="check-setting"><input type="checkbox" checked={settings.liveDuration} disabled={summary.duration === null} onChange={e => update({ liveDuration: e.target.checked })} /> Mostrar tiempo transcurrido del GPX</label>
    </>}
    <p className="settings-help">La duración de la actividad es independiente de la duración de la animación. “—” indica que no hay datos suficientes.</p>
  </details>;
}
