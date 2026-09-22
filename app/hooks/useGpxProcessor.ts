"use client";
import { useEffect, useMemo, useRef } from "react";
import mapboxgl, { Map, LngLatBounds } from "mapbox-gl";
import type * as GeoJSON from "geojson";
import { bearing, point, lineString } from "@turf/turf";
import { parseGpxFeatureCollection, buildElevationProfile, summarizeProfile, routeSegments } from "../utils/gpxUtils";

export function useGpxProcessor(
  gpxData: GeoJSON.FeatureCollection | null,
  isMapLoaded: boolean,
  cameraPitch: number,
  mapRef: React.MutableRefObject<Map | null>,
  setStatusMessage: (msg: string | null) => void,
  setError: (err: string | null) => void,
  threshold: number,
) {
  const parsed = useMemo(() => {
    try { return { route: gpxData ? parseGpxFeatureCollection(gpxData) : null, error: null }; }
    catch (e) { return { route: null, error: e instanceof Error ? e.message : String(e) }; }
  }, [gpxData]);
  const gpxFeature = parsed.route;
  const profile = useMemo(() => gpxFeature ? buildElevationProfile(gpxFeature, threshold) : [], [gpxFeature, threshold]);
  const summary = useMemo(() => summarizeProfile(profile), [profile]);
  const elevationProfileRef = useRef(profile);
  elevationProfileRef.current = profile;
  const coords = gpxFeature?.geometry.coordinates;
  const startBearing = coords ? bearing(point(coords[0]), point(coords[1])) : 0;

  useEffect(() => { if (parsed.error) setError(parsed.error); }, [parsed.error, setError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const source = map.getSource("route-source") as mapboxgl.GeoJSONSource | undefined;
    for (const layer of map.getStyle()?.layers ?? []) {
      if (layer.id.startsWith("route-segment-")) map.removeLayer(layer.id);
    }
    if (map.getLayer("route-layer")) map.setLayoutProperty("route-layer", "visibility", "none");
    if (!gpxFeature) {
      source?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const segments = routeSegments(gpxFeature);
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection", features: segments.map((s, i) => lineString(s, { segment: i })),
    };
    if (source) source.setData(data);
    else map.addSource("route-source", { type: "geojson", data, lineMetrics: true });
    segments.forEach((_, i) => map.addLayer({
      id: "route-segment-" + i, type: "line", source: "route-source",
      filter: ["==", ["get", "segment"], i],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-width": 5, "line-opacity": 0.8,
        "line-gradient": ["step", ["line-progress"], "yellow", 0, "rgba(0,0,0,0)"] },
    }));
    const routeCoords = gpxFeature.geometry.coordinates;
    const bounds = routeCoords.reduce((b, c) => b.extend(c as [number, number]), new LngLatBounds());
    map.fitBounds(bounds, { padding: 100, duration: 2000, pitch: cameraPitch, bearing: startBearing, maxZoom: 17 });
    setStatusMessage("Ruta cargada. Lista para animación.");
    // Camera controls must not reparse/reframe an active route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpxFeature, isMapLoaded]);

  return { gpxFeature, totalPathDistance: summary.distance, startBearing, elevationProfileRef, profile, summary };
}
