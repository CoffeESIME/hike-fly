import type * as GeoJSON from "geojson";
import { distance, point, along, lineString } from "@turf/turf";
import type { ElevationPoint } from "../types";

export type RouteFeature = GeoJSON.Feature<GeoJSON.LineString, {
  name: string; segmentStarts: number[]; times: (string | null)[];
}>;

/** Read timestamps without compacting missing entries, which loses point alignment. */
export function readGpx(doc: Document): GeoJSON.FeatureCollection {
  if (doc.getElementsByTagName("parsererror").length || doc.documentElement.localName !== "gpx") {
    throw new Error("El archivo no contiene un GPX válido.");
  }
  const children = (el: Element, name: string) => Array.from(el.children).filter(c => c.localName === name);
  const value = (el: Element, name: string) => children(el, name)[0]?.textContent?.trim() || null;
  const tracks = Array.from(doc.getElementsByTagNameNS("*", "trk"));
  const routes = Array.from(doc.getElementsByTagNameNS("*", "rte"));
  const features: GeoJSON.Feature[] = [];
  // Prefer recorded tracks over planned routes when both are supplied.
  for (const container of tracks.length ? tracks : routes) {
    for (const segment of container.localName === "trk" ? children(container, "trkseg") : [container]) {
      const nodes = children(segment, container.localName === "trk" ? "trkpt" : "rtept");
      if (nodes.length < 2) continue;
      const coordinates = nodes.map(node => {
        const lon = node.getAttribute("lon"), lat = node.getAttribute("lat");
        if (!lon?.trim() || !lat?.trim()) throw new Error("Un punto GPX no tiene coordenadas.");
        const c = [Number(lon), Number(lat)];
        const ele = value(node, "ele");
        if (ele !== null && Number.isFinite(Number(ele))) c.push(Number(ele));
        return c;
      });
      features.push(lineString(coordinates, {
        name: value(container, "name") || "Mi recorrido",
        coordinateProperties: { times: nodes.map(node => value(node, "time")) },
      }));
    }
  }
  return { type: "FeatureCollection", features };
}

/** Preserve boundaries: gaps must not become distance or vertical gain. */
export function parseGpxFeatureCollection(data: GeoJSON.FeatureCollection): RouteFeature {
  const coordinates: GeoJSON.Position[] = [], segmentStarts: number[] = [], times: (string | null)[] = [];
  let name = "Mi recorrido";
  for (const f of data.features) {
    if (!f.geometry || !["LineString", "MultiLineString"].includes(f.geometry.type)) continue;
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : (f.geometry as GeoJSON.MultiLineString).coordinates;
    const rawTimes = f.properties?.coordinateProperties?.times ?? f.properties?.coordTimes;
    for (const [s, line] of lines.entries()) {
      if (line.length < 2) continue;
      if (line.some(c => !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90)) {
        throw new Error("La ruta contiene coordenadas fuera de rango.");
      }
      if (!coordinates.length && typeof f.properties?.name === "string") name = f.properties.name;
      segmentStarts.push(coordinates.length);
      const ts = f.geometry.type === "LineString" ? rawTimes : rawTimes?.[s];
      const aligned = Array.isArray(ts) && ts.length === line.length;
      line.forEach((c, i) => {
        coordinates.push(c.slice(0, 3));
        times.push(aligned && typeof ts[i] === "string" ? ts[i] : null);
      });
    }
  }
  if (coordinates.length < 2) throw new Error("No se encontró una ruta con al menos dos puntos.");
  return lineString(coordinates, { name, segmentStarts, times }) as RouteFeature;
}

export function routeSegments(route: RouteFeature): GeoJSON.Position[][] {
  return route.properties.segmentStarts.map((start, i, starts) => route.geometry.coordinates.slice(start, starts[i + 1]));
}

export function buildElevationProfile(route: RouteFeature, threshold = 3): ElevationPoint[] {
  const starts = new Set(route.properties.segmentStarts);
  let dist = 0, gain = 0, loss = 0, anchor: number | null = null;
  const times = route.properties.times.map(t => t === null ? NaN : Date.parse(t));
  const validTimes = times.length > 1 && times.every((t, i) => Number.isFinite(t) && (i === 0 || t >= times[i - 1])) && times[times.length - 1] > times[0];
  return route.geometry.coordinates.map((c, i, coords) => {
    const ele = Number.isFinite(c[2]) ? c[2] : null;
    if (i > 0 && !starts.has(i)) dist += distance(point(coords[i - 1]), point(c), { units: "meters" });
    if (starts.has(i) || ele === null || anchor === null) anchor = ele;
    else {
      const delta = ele - anchor;
      // Vertical deadband reduces GPS jitter; never crosses missing data or a segment.
      if (Math.abs(delta) >= threshold || i === coords.length - 1 || starts.has(i + 1)) {
        gain += Math.max(0, delta); loss += Math.max(0, -delta); anchor = ele;
      }
    }
    return { dist, ele, gain, loss, elapsed: validTimes ? (times[i] - times[0]) / 1000 : null, coordinate: c };
  });
}

/** Upper bound handles repeated coordinates and zero-distance boundaries. */
export function profilePosition(profile: ElevationPoint[], target: number) {
  let low = 0, high = profile.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (profile[mid].dist <= target) low = mid + 1; else high = mid;
  }
  const a = profile[Math.max(0, low - 1)], b = profile[Math.min(low, profile.length - 1)];
  const t = a && b && b.dist > a.dist ? Math.max(0, Math.min(1, (target - a.dist) / (b.dist - a.dist))) : 0;
  return { a, b, t };
}

export function metricAtDistance(profile: ElevationPoint[], target: number, key: "ele" | "gain" | "loss" | "elapsed"): number | null {
  const { a, b, t } = profilePosition(profile, target);
  if (!a || !b) return null;
  if (t === 0) return a[key];
  const start = a[key], end = b[key];
  return start === null || end === null ? null : start + (end - start) * t;
}

export function routePointAtDistance(profile: ElevationPoint[], target: number) {
  const { a, b, t } = profilePosition(profile, target);
  if (!a || !b) throw new Error("La ruta está vacía.");
  return t === 0 ? point(a.coordinate) : along(lineString([a.coordinate, b.coordinate]), (b.dist - a.dist) * t, { units: "meters" });
}

export function summarizeProfile(profile: ElevationPoint[]) {
  const completeElevation = profile.length > 1 && profile.every(p => p.ele !== null);
  const last = profile[profile.length - 1];
  let min: number | null = null, max: number | null = null;
  for (const p of profile) if (p.ele !== null) { min = min === null ? p.ele : Math.min(min, p.ele); max = max === null ? p.ele : Math.max(max, p.ele); }
  return {
    distance: last?.dist ?? 0, gain: completeElevation ? last.gain : null,
    loss: completeElevation ? last.loss : null, duration: last?.elapsed ?? null,
    min: completeElevation ? min : null, max: completeElevation ? max : null,
  };
}
