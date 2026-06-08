"use client";
import { useState, useEffect, useRef } from "react";
import { Map } from "mapbox-gl";
import { ThreeCustomLayer } from "../utils/ThreeCustomLayer";
import { DEFAULT_TERRAIN_EXAGGERATION } from "../constants/defaults";

export type UseMapInitReturn = {
  mapRef: React.MutableRefObject<Map | null>;
  threeLayerRef: React.MutableRefObject<ThreeCustomLayer | null>;
  isMapLoaded: boolean;
  isTerrainReady: boolean;
  statusMessage: string | null;
  setStatusMessage: (msg: string | null) => void;
  error: string | null;
};

/**
 * Initialises the Mapbox GL map, adds the DEM terrain source, the Three.js
 * custom layer and the empty route line source/layer. Polls until the terrain
 * elevation API is available.
 *
 * @param mapContainerRef  ref to the DOM div that hosts the map canvas
 */
export function useMapInit(
  mapContainerRef: React.RefObject<HTMLDivElement | null>
): UseMapInitReturn {
  const mapRef       = useRef<Map | null>(null);
  const threeLayerRef = useRef<ThreeCustomLayer | null>(null);

  const [isMapLoaded,    setIsMapLoaded]    = useState(false);
  const [isTerrainReady, setIsTerrainReady] = useState(false);
  const [statusMessage,  setStatusMessage]  = useState<string | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    setStatusMessage("Inicializando mapa...");
    try {
      const map = new Map({
        container: mapContainerRef.current,
        zoom: 5,
        center: [-99, 19],
        pitch: 0,
        bearing: 0,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        interactive: true,
        preserveDrawingBuffer: true,
      });

      mapRef.current = map;

      map.on("load", () => {
        console.log("Map 'load' event fired.");
        setIsMapLoaded(true);
        setStatusMessage("Mapa cargado. Añadiendo terreno...");

        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          });
        }
        if (!map.getTerrain()) {
          map.setTerrain({ source: "mapbox-dem", exaggeration: DEFAULT_TERRAIN_EXAGGERATION });
        }

        // 3-D character layer (Three.js)
        const customLayer = new ThreeCustomLayer("3d-character-layer");
        map.addLayer(customLayer);
        threeLayerRef.current = customLayer;

        // Terrain readiness polling
        let terrainCheckAttempts = 0;
        const MAX_TERRAIN_ATTEMPTS = 15;
        const checkReady = () => {
          terrainCheckAttempts++;
          const demLoaded      = map.isSourceLoaded("mapbox-dem");
          const terrainSet     = !!map.getTerrain();
          const elevFnAvailable = typeof map.queryTerrainElevation === "function";

          console.log(`Verificando terreno (intento ${terrainCheckAttempts}):`, { demLoaded, terrainSet, elevFnAvailable });

          if ((demLoaded && terrainSet && elevFnAvailable) || terrainCheckAttempts >= MAX_TERRAIN_ATTEMPTS) {
            if (terrainCheckAttempts >= MAX_TERRAIN_ATTEMPTS && !demLoaded) {
              console.warn("Terreno DEM no cargó completamente. Continuando de todas formas.");
              setStatusMessage("Terreno parcial. Carga una ruta para empezar.");
            } else {
              console.log("Terreno listo.");
              setStatusMessage("Terreno 3D listo. Carga una ruta GPX.");
            }
            setIsTerrainReady(true);
          } else {
            setStatusMessage(`Cargando terreno 3D... (${terrainCheckAttempts}/${MAX_TERRAIN_ATTEMPTS})`);
            setTimeout(checkReady, 1000);
          }
        };
        setTimeout(checkReady, 500);

        // Empty route source + layer
        if (!map.getLayer("route-layer")) {
          map.addSource("route-source", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            lineMetrics: true,
          });
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
                "yellow", 0, "rgba(0, 0, 0, 0)",
              ],
            },
          });
        }
      });

      map.on("error", (e) => console.warn("Error en Mapbox:", e));
    } catch (mapInitError) {
      console.error("Error iniciando el mapa:", mapInitError);
      setError(String(mapInitError));
    }

    return () => {
      const map = mapRef.current;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mapRef, threeLayerRef, isMapLoaded, isTerrainReady, statusMessage, setStatusMessage, error };
}
