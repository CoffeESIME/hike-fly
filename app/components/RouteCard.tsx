"use client";
import { useRef, useState, useMemo, useEffect } from "react";
import type { RouteFeature } from "../utils/gpxUtils";
import { routeSegments } from "../utils/gpxUtils";
import type { StatItem } from "../utils/statistics";
import { Icon } from "./Icon";

export function routeDrawing(route: RouteFeature, width: number, height: number): string {
  const segments = routeSegments(route);
  let previousLon = segments[0][0][0];
  const projected = segments.map(segment => segment.map(c => {
    // Unwrap the antimeridian and use Mercator to preserve local angles.
    let lon = c[0];
    while (lon - previousLon > 180) lon -= 360;
    while (lon - previousLon < -180) lon += 360;
    previousLon = lon;
    const lat = Math.max(-85, Math.min(85, c[1])) * Math.PI / 180;
    return [lon * Math.PI / 180, -Math.log(Math.tan(Math.PI / 4 + lat / 2))];
  }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const segment of projected) for (const [x, y] of segment) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const scale = Math.min((width - 32) / Math.max(maxX - minX, 1e-9), (height - 32) / Math.max(maxY - minY, 1e-9));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return projected.map(segment => segment.map(([x, y], i) => `${i ? "L" : "M"}${((x - cx) * scale + width / 2).toFixed(2)},${((y - cy) * scale + height / 2).toFixed(2)}`).join(" ")).join(" ");
}

const palettes = {
  tierra: { background: "#f2eee5", ink: "#283d32", route: "#c15c32" },
  noche: { background: "#182820", ink: "#f2eee5", route: "#e9ac75" },
  papel: { background: "#faf7f0", ink: "#292923", route: "#292923" },
};

export function RouteCard({ route, items }: { route: RouteFeature; items: StatItem[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [title, setTitle] = useState(route.properties.name.slice(0, 60));
  useEffect(() => setTitle(route.properties.name.slice(0, 60)), [route]);
  const [colors, setColors] = useState(palettes.tierra);
  const [transparent, setTransparent] = useState(false);
  const [square, setSquare] = useState(false);
  const [stroke, setStroke] = useState(5);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const shown = items.filter(item => item.value !== "—");
  const height = square ? 720 : 960;
  const rows = Math.ceil(shown.length / 3);
  const routeTop = 168 + rows * 92;
  const routeHeight = height - routeTop - 96;
  const path = useMemo(() => routeDrawing(route, 600, routeHeight), [route, routeHeight]);

  const save = async (format: "svg" | "png") => {
    if (!svgRef.current || busy) return;
    setBusy(true); setMessage("");
    let sourceUrl: string | null = null, downloadUrl: string | null = null;
    try {
      const source = new Blob([new XMLSerializer().serializeToString(svgRef.current)], { type: "image/svg+xml;charset=utf-8" });
      let blob = source;
      if (format === "png") {
        sourceUrl = URL.createObjectURL(source);
        const image = new Image();
        image.src = sourceUrl;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 1440; canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No se pudo preparar la imagen.");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("No se pudo exportar la imagen.")), "image/png"));
      }
      downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl; link.download = `flyby-ruta.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      setMessage(`Tarjeta ${format.toUpperCase()} preparada para descargar.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo guardar la tarjeta."); }
    finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (downloadUrl) { const url = downloadUrl; window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setBusy(false);
    }
  };

  return <details className="settings-section route-card-settings">
    <summary><Icon name="route" /> Tarjeta de ruta <span>2D / EXPORTAR</span></summary>
    <p className="settings-help">Un recuerdo de tu recorrido. Esta tarjeta se guarda por separado y no aparece al finalizar la animación.</p>
    <label>Nombre del recorrido<input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} /></label>
    <label>Estilo<select defaultValue="tierra" onChange={e => setColors(palettes[e.target.value as keyof typeof palettes])}>
      <option value="tierra">Tierra</option><option value="noche">Noche</option><option value="papel">Tinta sobre papel</option>
    </select></label>
    <div className="setting-columns">
      <label>Trazo<input type="color" value={colors.route} onChange={e => setColors({ ...colors, route: e.target.value })} /></label>
      <label>Texto<input type="color" value={colors.ink} onChange={e => setColors({ ...colors, ink: e.target.value })} /></label>
      <label>Fondo<input type="color" disabled={transparent} value={colors.background} onChange={e => setColors({ ...colors, background: e.target.value })} /></label>
    </div>
    <label>Grosor del trazo · {stroke}<input type="range" min="2" max="12" value={stroke} onChange={e => setStroke(Number(e.target.value))} /></label>
    <label>Formato<select value={square ? "square" : "portrait"} onChange={e => setSquare(e.target.value === "square")}><option value="portrait">Vertical · 3:4</option><option value="square">Cuadrado · 1:1</option></select></label>
    <label className="check-setting"><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} /> Fondo transparente</label>
    <div className={`route-card-preview${transparent ? " transparent-preview" : ""}`}>
      <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width="720" height={height} viewBox={`0 0 720 ${height}`} role="img" aria-label={`Tarjeta de ${title}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <title>{title || "Mi recorrido"}</title>
        {!transparent && <rect width="720" height={height} fill={colors.background} />}
        <g fill={colors.ink} fontFamily="Verdana, sans-serif">
          <text x="60" y="64" fontSize="14" letterSpacing="4">FLYBY / MI RECORRIDO</text>
          <text x="60" y="115" fontSize={title.length > 32 ? "23" : "32"} fontWeight="bold" textLength={title.length > 42 ? 600 : undefined} lengthAdjust="spacingAndGlyphs">{title || "Mi recorrido"}</text>
          <path d="M60 140H660" stroke={colors.ink} opacity="0.25" />
          {shown.map((item, i) => <g key={item.key} transform={`translate(${60 + i % 3 * 204},${180 + Math.floor(i / 3) * 92})`}>
            <text fontSize="13">{item.label}</text>
            <text y="34" fontSize={item.value.length > 10 ? "20" : "28"} fontWeight="bold">{item.value}<tspan fontSize="13"> {item.unit}</tspan></text>
          </g>)}
          <path d={path} transform={`translate(60,${routeTop})`} fill="none" stroke={colors.route} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M60 ${height - 66}H660`} stroke={colors.ink} opacity="0.25" />
          <text x="60" y={height - 34} fontSize="12" letterSpacing="2">FUERA. MÁS LEJOS.</text>
          <text x="660" y={height - 34} textAnchor="end" fontSize="18" fontWeight="bold">FLYBY</text>
        </g>
      </svg>
    </div>
    <div className="setting-columns export-buttons">
      <button disabled={busy} onClick={() => save("png")}><Icon name="download" /> Guardar PNG</button>
      <button disabled={busy} onClick={() => save("svg")}>Guardar SVG</button>
    </div>
    <p className="settings-help" role="status">{message || "PNG en alta resolución · SVG editable. Los datos ausentes se omiten."}</p>
  </details>;
}
