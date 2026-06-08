"use client";
import { useState, useEffect, useRef } from "react";
import mapboxgl, { Map, LngLatBounds } from "mapbox-gl";
import * as GeoJSON from "geojson";
import * as turf from "@turf/turf";
import { parseGpxFeatureCollection, calculateElevationGain, buildElevationProfile } from "../utils/gpxUtils";
import { ElevationPoint } from "../types";

const { length: turfLength, bearing: turfBearing, point: turfPoint } = turf;

export type UseGpxProcessorReturn = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gpxFeature: any | null;
  totalPathDistance: number;
  startBearing: number;
  totalElevationGainRef: React.MutableRefObject<number>;
  elevationProfileRef: React.MutableRefObject<ElevationPoint[]>;
  isLoading: boolean;
  error: string | null;
};

/**
 * Reacts to changes in `gpxData` and `isMapLoaded`:
 *  - Parses the GeoJSON feature collection into a single LineString
 *  - Feeds the route geometry into the Mapbox `route-source`
 *  - Computes total path distance, initial bearing, elevation gain, and profile
 *  - Calls `fitBounds` to frame the route
 *
 * Also calls `setStatusMessage` and `setError` on the parent for UI feedback.
 */
export function useGpxProcessor(
  gpxData: GeoJSON.FeatureCollection | null,
  isMapLoaded: boolean,
  cameraPitch: number,
  mapRef: React.MutableRefObject<Map | null>,
  setStatusMessage: (msg: string | null) => void,
  setError: (err: string | null) => void
): UseGpxProcessorReturn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [gpxFeature, setGpxFeature]               = useState<any | null>(null);
  const [totalPathDistance, setTotalPathDistance]   = useState<number>(0);
  const [startBearing, setStartBearing]             = useState<number>(0);
  const [isLoading, setIsLoading]                   = useState<boolean>(false);
  const [error, setLocalError]                      = useState<string | null>(null);

  const totalElevationGainRef = useRef<number>(0);
  const elevationProfileRef   = useRef<ElevationPoint[]>([]);

  useEffect(() => {
    if (!gpxData) {
      setGpxFeature(null);
      setTotalPathDistance(0);
      const map = mapRef.current;
      if (map && map.getSource("route-source")) {
        (map.getSource("route-source") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      return;
    }

    if (!isMapLoaded) return;

    setStatusMessage("Procesando archivo GPX...");
    setIsLoading(true);

    try {
      const lineFeature = parseGpxFeatureCollection(gpxData);

      const map = mapRef.current;
      if (map) {
        const routeGeoJson: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: [lineFeature],
        };
        const source = map.getSource("route-source") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(routeGeoJson);
        } else {
          map.addSource("route-source", {
            type: "geojson",
            data: routeGeoJson,
            lineMetrics: true,
          });
        }

        if (!map.getLayer("route-layer")) {
          map.addLayer({
            id: "route-layer",
            type: "line",
            source: "route-source",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-width": 5,
              "line-opacity": 0.8,
              "line-gradient": [
                "step", ["line-progress"],
                "yellow", 0, "rgba(0,0,0,0)",
              ],
            },
          });
        }
      }

      const dist             = turfLength(lineFeature, { units: "meters" });
      const coords           = lineFeature.geometry.coordinates;
      const initialBearing   = turfBearing(turfPoint(coords[0]), turfPoint(coords[1]));
      const elevGain         = calculateElevationGain(lineFeature);
      const profile          = buildElevationProfile(lineFeature);

      setTotalPathDistance(dist);
      setStartBearing(initialBearing);
      totalElevationGainRef.current  = elevGain;
      elevationProfileRef.current    = profile;

      setGpxFeature(lineFeature);
      setStatusMessage("Ruta cargada. Lista para animación.");
      setError(null);
      setLocalError(null);

      if (mapRef.current) {
        const bounds = new LngLatBounds(
          coords[0] as [number, number],
          coords[0] as [number, number]
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        coords.forEach((c: any) => bounds.extend(c as [number, number]));
        mapRef.current.fitBounds(bounds, {
          padding: 100,
          duration: 2000,
          pitch: cameraPitch,
          bearing: initialBearing,
          maxZoom: 17,
        });
      }
    } catch (err) {
      console.error("Error procesando GPX:", err);
      const msg = `Error procesando GPX: ${err instanceof Error ? err.message : String(err)}`;
      setLocalError(msg);
      setError(msg);
      setGpxFeature(null);
      setStatusMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [gpxData, isMapLoaded, cameraPitch]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    gpxFeature,
    totalPathDistance,
    startBearing,
    totalElevationGainRef,
    elevationProfileRef,
    isLoading,
    error,
  };
}
