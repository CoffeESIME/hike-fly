"use client";
import Head from "next/head";
import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  useCallback,
} from "react";
import mapboxgl, {
  Map,
  LngLatLike,
  MercatorCoordinate,
  LngLat,
  LngLatBounds,
} from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { gpx } from "@tmcw/togeojson";
import * as GeoJSON from "geojson";
import * as turf from "@turf/turf";
import * as THREE from "three";
import { ThreeCustomLayer } from "./utils/ThreeCustomLayer";

// Explicitly access functions to avoid webpack/type issues
const {
  length,
  bearing,
  along,
  lineString,
  point,
  nearestPointOnLine,
} = turf;

// --- Configuration ---
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
const CAMERA_PITCH = 60;
const CAMERA_ALTITUDE_ABOVE_TERRAIN = 500;
const ANIMATION_DURATION_SECONDS = 60;
const CAMERA_ROTATION_DEGREES = 180;
const LERP_SMOOTHING_FACTOR = 0.1;

// --- Types ---
type PhotoMarker = {
  id: string;
  url: string;
  distanceAlongPath: number; // Meters from start
  coordinate: [number, number];
  shown: boolean; // To track if it has been shown in the current run
};

type Keyframe = {
  distance: number;
  position: mapboxgl.MercatorCoordinate;
  orientation: [number, number, number, number]; // Quaternion x, y, z, w
};

// --- Helper Functions ---
const lerp = (start: number, end: number, amt: number): number =>
  (1 - amt) * start + amt * end;

const lerpLngLat = (
  start: LngLatLike,
  end: LngLatLike,
  amt: number
): LngLatLike => {
  const startArr = LngLat.convert(start).toArray();
  const endArr = LngLat.convert(end).toArray();
  return [lerp(startArr[0], endArr[0], amt), lerp(startArr[1], endArr[1], amt)];
};

const computeCameraPosition = (
  pitch: number,
  bearing: number,
  targetLngLat: LngLatLike,
  altitude: number
): LngLatLike => {
  const target = LngLat.convert(targetLngLat);
  const kmPerDegreeLongitude = 111.32 * Math.cos(target.lat * (Math.PI / 180));
  const kmPerDegreeLatitude = 111.32;

  const bearingInRadian = bearing * (Math.PI / 180);
  const pitchInRadian = (90 - pitch) * (Math.PI / 180);

  const groundDistance = altitude / Math.tan(pitchInRadian);

  const offsetY = Math.cos(bearingInRadian) * groundDistance;
  const offsetX = Math.sin(bearingInRadian) * groundDistance;

  const latDiff = -(offsetY / (kmPerDegreeLatitude * 1000));
  const lngDiff = offsetX / (kmPerDegreeLongitude * 1000);

  return [target.lng + lngDiff, target.lat + latDiff];
};

const toggleMapInteractivity = (map: Map | null, enable: boolean) => {
  if (!map) return;
  if (enable) {
    map.boxZoom.enable();
    map.scrollZoom.enable();
    map.doubleClickZoom.enable();
    map.dragPan.enable();
    map.dragRotate.enable();
    map.keyboard.enable();
    map.touchZoomRotate.enable();
  } else {
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.touchZoomRotate.disable();
  }
};

// --- Component ---
export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const threeLayerRef = useRef<ThreeCustomLayer | null>(null);

  // Pausing logic for photos
  const isPausedForPhotoRef = useRef<boolean>(false);
  const pauseStartTimeRef = useRef<number>(0);
  const totalPausedTimeRef = useRef<number>(0);
  const currentDistanceRef = useRef<number>(0);

  const previousSmoothedTargetRef = useRef<LngLatLike | null>(null);

  // --- State ---
  const [gpxData, setGpxData] = useState<GeoJSON.FeatureCollection | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [gpxFeature, setGpxFeature] = useState<any>(null);

  const [totalPathDistance, setTotalPathDistance] = useState<number>(0);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [isTerrainReady, setIsTerrainReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Animation
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animationDuration] = useState<number>(
    ANIMATION_DURATION_SECONDS * 1000
  );
  const [startBearing, setStartBearing] = useState<number>(0);

  // Photos
  const [photos, setPhotos] = useState<PhotoMarker[]>([]);
  const [activePhoto, setActivePhoto] = useState<PhotoMarker | null>(null);

  // Keyframes
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [useKeyframes, setUseKeyframes] = useState<boolean>(false);

  // Menu Visibility
  const [hideMenuOnStart, setHideMenuOnStart] = useState<boolean>(false);
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(true);

  const handleCaptureKeyframe = () => {
    const map = mapRef.current;
    if (!map) return;

    const camera = map.getFreeCameraOptions();
    if (!camera.position || !camera.orientation) return;

    const newKeyframe: Keyframe = {
      distance: currentDistanceRef.current,
      position: camera.position,
      orientation: camera.orientation as [number, number, number, number],
    };

    setKeyframes((prev) => {
      const newFrames = [...prev, newKeyframe];
      // Sort by distance to ensure correct interpolation order
      return newFrames.sort((a, b) => a.distance - b.distance);
    });

    // Visual feedback could be added here
    console.log("Keyframe captured at distance:", currentDistanceRef.current);
  };

  const updateCamera = useCallback(
    (position: LngLatLike, altitude: number, target: LngLatLike) => {
      const map = mapRef.current;
      if (!map) return;
      try {
        const camera = map.getFreeCameraOptions();
        camera.position = MercatorCoordinate.fromLngLat(position, altitude);
        camera.lookAtPoint(target);
        map.setFreeCameraOptions(camera);
      } catch (e) {
        console.error("Error updating camera:", e);
      }
    },
    []
  );

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
          map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        }

        // Add 3D Character Layer
        const customLayer = new ThreeCustomLayer("3d-character-layer");
        map.addLayer(customLayer);
        threeLayerRef.current = customLayer;

        const checkReady = () => {
          if (
            map.isSourceLoaded("mapbox-dem") &&
            map.getTerrain() &&
            typeof map.queryTerrainElevation === "function"
          ) {
            console.log("Terreno listo.");
            setIsTerrainReady(true);
            setStatusMessage("Terreno 3D listo.");
          } else {
            setTimeout(checkReady, 1000);
          }
        };
        setTimeout(checkReady, 500);

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
                "step",
                ["line-progress"],
                "yellow",
                0,
                "rgba(0, 0, 0, 0)",
              ],
            },
          });
        }
      });

      map.on("error", (e) => {
        console.warn("Error en Mapbox:", e);
      });
    } catch (mapInitError) {
      console.error("Error iniciando el mapa:", mapInitError);
      setError(String(mapInitError));
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lineFeature: any = null;
      const mergedCoords: GeoJSON.Position[] = [];

      gpxData.features.forEach((feature) => {
        if (feature.geometry.type === "LineString") {
          if (!lineFeature) {
            lineFeature = feature as GeoJSON.Feature<GeoJSON.LineString>;
          }
          mergedCoords.push(...feature.geometry.coordinates);
        } else if (feature.geometry.type === "MultiLineString") {
          feature.geometry.coordinates.forEach((line) => {
            mergedCoords.push(...line);
          });
        }
      });

      if (!lineFeature && mergedCoords.length >= 2) {
        lineFeature = lineString(mergedCoords);
      } else if (
        lineFeature &&
        mergedCoords.length > lineFeature.geometry.coordinates.length
      ) {
        lineFeature = lineString(mergedCoords);
      }

      if (!lineFeature || lineFeature.geometry.coordinates.length < 2) {
        throw new Error(
          "No se encontró una LineString válida con al menos 2 puntos."
        );
      }

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
                "step",
                ["line-progress"],
                "yellow",
                0,
                "rgba(0,0,0,0)",
              ],
            },
          });
        }
      }

      const dist = length(lineFeature, { units: "meters" });
      setTotalPathDistance(dist);

      const coords = lineFeature.geometry.coordinates;
      const initialBearing = bearing(point(coords[0]), point(coords[1]));
      setStartBearing(initialBearing);

      setGpxFeature(lineFeature);

      setStatusMessage("Ruta cargada. Lista para animación.");
      setError(null);

      if (mapRef.current) {
        const bounds = new LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]);
        coords.forEach((c: any) => bounds.extend(c as [number, number])); // eslint-disable-line @typescript-eslint/no-explicit-any
        mapRef.current.fitBounds(bounds, {
          padding: 100,
          duration: 2000,
          pitch: CAMERA_PITCH,
          bearing: initialBearing,
          maxZoom: 17,
        });
      }
    } catch (err) {
      console.error("Error procesando GPX:", err);
      setError(
        `Error procesando GPX: ${err instanceof Error ? err.message : String(err)
        }`
      );
      setGpxFeature(null);
      setStatusMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [gpxData, isMapLoaded]);

  const animationStep = useCallback(
    (timestamp: number) => {
      if (
        !isAnimatingRef.current ||
        !gpxFeature ||
        !mapRef.current ||
        !isTerrainReady
      ) {
        if (animationFrameRef.current)
          cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        return;
      }

      // Handle Pause for Photo
      if (isPausedForPhotoRef.current) {
        if (pauseStartTimeRef.current === 0) {
          pauseStartTimeRef.current = timestamp;
        }
        // Keep requesting frames but don't advance animation
        animationFrameRef.current = requestAnimationFrame(animationStep);
        return;
      }

      // If we were paused, update totalPausedTime
      if (pauseStartTimeRef.current > 0) {
        totalPausedTimeRef.current += timestamp - pauseStartTimeRef.current;
        pauseStartTimeRef.current = 0;
      }

      const map = mapRef.current;

      if (animationStartTimeRef.current === null) {
        animationStartTimeRef.current = timestamp;
      }

      // Adjust elapsed time by subtracting paused time
      const elapsedTime =
        timestamp - animationStartTimeRef.current - totalPausedTimeRef.current;
      let animationPhase = elapsedTime / animationDuration;

      if (animationPhase >= 1.0) {
        animationPhase = 1.0;
      }

      try {
        map.setPaintProperty("route-layer", "line-gradient", [
          "step",
          ["line-progress"],
          "yellow",
          animationPhase,
          "rgba(0,0,0,0)",
        ]);
      } catch { }

      const distanceAlongPath = totalPathDistance * animationPhase;
      currentDistanceRef.current = distanceAlongPath;

      const exactTargetFeature = along(gpxFeature, distanceAlongPath, {
        units: "meters",
      });
      const exactTargetCoords = exactTargetFeature.geometry
        .coordinates as LngLatLike;

      // Check for Photos
      const PHOTO_TRIGGER_DISTANCE = 20; // meters
      const photoToShow = photos.find((p) => {
        return (
          !p.shown &&
          Math.abs(p.distanceAlongPath - distanceAlongPath) <
          PHOTO_TRIGGER_DISTANCE
        );
      });

      if (photoToShow) {
        console.log("Showing photo:", photoToShow.id);
        isPausedForPhotoRef.current = true;
        setActivePhoto(photoToShow);
        // Mark as shown so we don't trigger it again immediately
        setPhotos((prev) =>
          prev.map((p) => (p.id === photoToShow.id ? { ...p, shown: true } : p))
        );
        // Continue loop to handle pause state
        animationFrameRef.current = requestAnimationFrame(animationStep);
        return;
      }

      // --- Common Logic (Character & Camera Target) ---
      if (previousSmoothedTargetRef.current === null) {
        previousSmoothedTargetRef.current = exactTargetCoords;
      }
      const smoothedTargetCoords = lerpLngLat(
        previousSmoothedTargetRef.current,
        exactTargetCoords,
        LERP_SMOOTHING_FACTOR
      );
      previousSmoothedTargetRef.current = smoothedTargetCoords;

      const targetElevation =
        map.queryTerrainElevation(smoothedTargetCoords) ?? 0;

      // --- Camera Logic ---
      if (useKeyframes && keyframes.length > 1) {
        // 1. Find surrounding keyframes
        // We need the last keyframe <= currentDistance and the first keyframe > currentDistance
        let prevKeyframe = keyframes[0];
        let nextKeyframe = keyframes[keyframes.length - 1];

        for (let i = 0; i < keyframes.length - 1; i++) {
          if (keyframes[i].distance <= distanceAlongPath && keyframes[i + 1].distance > distanceAlongPath) {
            prevKeyframe = keyframes[i];
            nextKeyframe = keyframes[i + 1];
            break;
          }
        }

        // Handle edge cases (before first or after last)
        if (distanceAlongPath < keyframes[0].distance) {
          nextKeyframe = keyframes[0];
          prevKeyframe = keyframes[0];
        }
        if (distanceAlongPath > keyframes[keyframes.length - 1].distance) {
          prevKeyframe = keyframes[keyframes.length - 1];
          nextKeyframe = keyframes[keyframes.length - 1];
        }

        // 2. Interpolate
        let t = 0;
        const distDiff = nextKeyframe.distance - prevKeyframe.distance;
        if (distDiff > 0) {
          t = (distanceAlongPath - prevKeyframe.distance) / distDiff;
        }

        // Clamp t
        t = Math.max(0, Math.min(1, t));

        // Interpolate Position (Linear)
        const posA = prevKeyframe.position;
        const posB = nextKeyframe.position;
        const x = lerp(posA.x, posB.x, t);
        const y = lerp(posA.y, posB.y, t);
        const z = lerp(posA.z, posB.z, t);

        const newPos = new MercatorCoordinate(x, y, z);

        // Interpolate Orientation (Slerp)
        const qA = new THREE.Quaternion(...prevKeyframe.orientation);
        const qB = new THREE.Quaternion(...nextKeyframe.orientation);
        qA.slerp(qB, t);

        const newCamera = map.getFreeCameraOptions();
        newCamera.position = newPos;
        newCamera.orientation = [qA.x, qA.y, qA.z, qA.w];
        map.setFreeCameraOptions(newCamera);

      } else {
        // Default "Eagle View" Logic
        const cameraAltitude = targetElevation + CAMERA_ALTITUDE_ABOVE_TERRAIN;

        const currentBearing =
          startBearing - animationPhase * CAMERA_ROTATION_DEGREES;

        const cameraLngLat = computeCameraPosition(
          CAMERA_PITCH,
          currentBearing,
          smoothedTargetCoords,
          CAMERA_ALTITUDE_ABOVE_TERRAIN
        );

        updateCamera(cameraLngLat, cameraAltitude, smoothedTargetCoords);
      }

      // Update 3D Character
      if (threeLayerRef.current) {
        const tCoords = LngLat.convert(smoothedTargetCoords);
        // Calculate bearing for the character to face forward
        // We can use the bearing between current smoothed pos and next small step
        const nextStep = along(
          gpxFeature,
          distanceAlongPath + 5, // look 5 meters ahead
          { units: "meters" }
        );
        const nextCoords = nextStep.geometry.coordinates;
        const charBearing = bearing(
          point([tCoords.lng, tCoords.lat]),
          point(nextCoords)
        );

        threeLayerRef.current.updatePosition(
          tCoords.lng,
          tCoords.lat,
          targetElevation,
          charBearing
        );
      }

      if (animationPhase < 1.0) {
        animationFrameRef.current = requestAnimationFrame(animationStep);
      } else {
        animationFrameRef.current = null;
        animationStartTimeRef.current = null;
        previousSmoothedTargetRef.current = null;
        setIsAnimating(false);
        setStatusMessage("Animación completada.");
        toggleMapInteractivity(map, true);
        setIsMenuVisible(true);
      }
    },
    [
      gpxFeature,
      totalPathDistance,
      animationDuration,
      startBearing,
      isTerrainReady,
      updateCamera,
      photos, // Dependency on photos to trigger them
      keyframes,
      useKeyframes,
    ]
  );

  useEffect(() => {
    isAnimatingRef.current = isAnimating;

    if (isAnimating) {
      if (!gpxFeature || !isTerrainReady) {
        setError("Carga una ruta y espera a que el terreno esté listo.");
        setIsAnimating(false);
        return;
      }
      setStatusMessage("Animación en curso...");

      if (mapRef.current) {
        toggleMapInteractivity(mapRef.current, false);
      }

      // Reset pause state if starting fresh
      if (animationStartTimeRef.current === null) {
        totalPausedTimeRef.current = 0;
        pauseStartTimeRef.current = 0;
        isPausedForPhotoRef.current = false;
        // Reset photos shown state
        setPhotos((prev) => prev.map((p) => ({ ...p, shown: false })));
      }

      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);

      animationFrameRef.current = requestAnimationFrame(animationStep);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (mapRef.current) {
        toggleMapInteractivity(mapRef.current, true);
      }
      if (statusMessage === "Animación en curso...") {
        setStatusMessage("Animación pausada.");
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (mapRef.current) {
        toggleMapInteractivity(mapRef.current, true);
      }
    };
  }, [isAnimating, animationStep, gpxFeature, isTerrainReady, statusMessage]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setStatusMessage(null);
    setGpxData(null);
    setGpxFeature(null);
    setTotalPathDistance(0);
    setIsAnimating(false);
    setPhotos([]); // Reset photos on new file

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("Selecciona un archivo .gpx válido.");
      return;
    }

    setIsLoading(true);
    setStatusMessage("Leyendo archivo...");

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const gpxContent = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(gpxContent, "application/xml");
        const geojsonData = gpx(doc);
        setGpxData(geojsonData);
        setStatusMessage("Archivo GPX leído. Procesando...");
      } catch (err) {
        console.error("Error leyendo archivo GPX:", err);
        setError(
          `Error leyendo GPX: ${err instanceof Error ? err.message : String(err)
          }`
        );
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setIsLoading(false);
      setError("Error de lectura en el archivo GPX.");
    };

    reader.readAsText(file);
  };

  const handleToggleAnimation = () => {
    if (!gpxFeature || !isTerrainReady) {
      setError("La ruta/terreno no están listos.");
      return;
    }
    setError(null);

    setIsAnimating((prev) => {
      const nextState = !prev;
      if (nextState && hideMenuOnStart) {
        setIsMenuVisible(false);
      }
      return nextState;
    });
  };

  const handleResetAnimation = () => {
    setError(null);
    setIsAnimating(false);
    animationStartTimeRef.current = null;
    previousSmoothedTargetRef.current = null;
    totalPausedTimeRef.current = 0;
    pauseStartTimeRef.current = 0;
    isPausedForPhotoRef.current = false;
    setStatusMessage("Animación reiniciada.");

    const map = mapRef.current;
    if (map) {
      try {
        map.setPaintProperty("route-layer", "line-gradient", [
          "step",
          ["line-progress"],
          "yellow",
          0,
          "rgba(0,0,0,0)",
        ]);
      } catch { }

      if (gpxFeature?.geometry?.coordinates?.length) {
        const startCoords = gpxFeature.geometry.coordinates[0];
        map.flyTo({
          center: startCoords as [number, number],
          zoom: 15,
          pitch: CAMERA_PITCH,
          bearing: startBearing,
          duration: 1500,
        });
      }
    }
  };

  const handleAddPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gpxFeature) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      const map = mapRef.current;
      if (!map) return;
      const center = map.getCenter();
      const centerPt = point([center.lng, center.lat]);
      const snapped = nearestPointOnLine(gpxFeature, centerPt, { units: 'meters' });

      const snappedMeters = snapped.properties?.location || 0;

      const newPhoto: PhotoMarker = {
        id: Date.now().toString(),
        url,
        distanceAlongPath: snappedMeters,
        coordinate: snapped.geometry.coordinates as [number, number],
        shown: false,
      };

      setPhotos(prev => [...prev, newPhoto]);
      alert(`Foto añadida en el km ${(snappedMeters / 1000).toFixed(2)} de la ruta.`);
    };
    reader.readAsDataURL(file);
  };

  const closePhotoOverlay = () => {
    setActivePhoto(null);
    isPausedForPhotoRef.current = false;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      <Head>
        <title>Visor GPX 3D</title>
      </Head>

      {/* Modern Dark UI Controls */}
      <div
        style={{
          display: isMenuVisible ? "block" : "none",
          position: "absolute",
          top: "20px",
          left: "20px",
          width: "320px",
          background: "rgba(20, 20, 20, 0.95)",
          backdropFilter: "blur(10px)",
          borderRadius: "12px",
          padding: "20px",
          color: "#ffffff",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          zIndex: 10,
          border: "1px solid rgba(255, 255, 255, 0.1)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <h2
          style={{
            margin: "0 0 20px 0",
            fontSize: "1.5rem",
            fontWeight: "700",
            background: "linear-gradient(45deg, #0070f3, #00c6ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          FlyBy 3D
        </h2>

        {/* Status Bar */}
        <div
          style={{
            marginBottom: "20px",
            padding: "10px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "8px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: error
                ? "#ff4444"
                : isAnimating
                  ? "#00c6ff"
                  : "#00ff88",
              boxShadow: error
                ? "0 0 8px #ff4444"
                : isAnimating
                  ? "0 0 8px #00c6ff"
                  : "0 0 8px #00ff88",
            }}
          />
          <span style={{ opacity: 0.9 }}>
            {error || statusMessage || "Listo para iniciar"}
          </span>
        </div>

        {/* File Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ position: "relative" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#888",
                fontWeight: "600",
              }}
            >
              Ruta GPX
            </label>
            <input
              type="file"
              accept=".gpx"
              onChange={handleFileChange}
              disabled={isLoading || isAnimating}
              style={{
                width: "100%",
                padding: "8px",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid #333",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div style={{ position: "relative" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#888",
                fontWeight: "600",
              }}
            >
              Añadir Foto
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleAddPhoto}
                disabled={!gpxFeature || isAnimating}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "0.9rem",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "#666",
                marginTop: "4px",
                fontStyle: "italic",
              }}
            >
              Se añade en la ubicación actual de la cámara
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div
          style={{
            marginTop: "25px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <button
            onClick={handleToggleAnimation}
            disabled={!gpxFeature || !isTerrainReady || isLoading}
            style={{
              padding: "12px",
              background: isAnimating
                ? "rgba(255, 68, 68, 0.2)"
                : "linear-gradient(135deg, #0070f3, #00c6ff)",
              color: isAnimating ? "#ff4444" : "white",
              border: isAnimating ? "1px solid #ff4444" : "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.95rem",
              transition: "all 0.2s ease",
              boxShadow: isAnimating ? "none" : "0 4px 12px rgba(0, 112, 243, 0.3)",
            }}
          >
            {isAnimating ? "PAUSAR" : "INICIAR"}
          </button>

          <button
            onClick={handleResetAnimation}
            disabled={!gpxFeature || isLoading}
            style={{
              padding: "12px",
              background: "rgba(255, 255, 255, 0.1)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.95rem",
              transition: "all 0.2s ease",
            }}
          >
            REINICIAR
          </button>
        </div>

        {/* Keyframe Controls */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "15px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <label style={{ fontSize: "0.8rem", color: "#ccc", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={useKeyframes}
                onChange={(e) => setUseKeyframes(e.target.checked)}
                disabled={keyframes.length < 2}
              />
              Usar Keyframes ({keyframes.length})
            </label>

            <button
              onClick={handleCaptureKeyframe}
              disabled={isAnimating || !gpxFeature}
              style={{
                padding: "6px 12px",
                background: "rgba(255, 165, 0, 0.2)",
                color: "orange",
                border: "1px solid orange",
                borderRadius: "6px",
                fontSize: "0.75rem",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              + CAPTURAR VISTA
            </button>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#666", fontStyle: "italic" }}>
            Pausa, mueve la cámara y captura para crear una ruta personalizada.
          </div>
          {/* Hide Menu Option */}
          <div
            style={{
              marginTop: "15px",
              paddingTop: "15px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <label style={{ fontSize: "0.8rem", color: "#ccc", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={hideMenuOnStart}
                onChange={(e) => setHideMenuOnStart(e.target.checked)}
              />
              Ocultar menú al iniciar
            </label>
          </div>
        </div>
      </div>

      {/* Restore Menu Button (Visible when menu is hidden) */}
      {
        !isMenuVisible && (
          <button
            onClick={() => setIsMenuVisible(true)}
            style={{
              position: "absolute",
              top: "20px",
              left: "20px",
              padding: "10px 15px",
              background: "rgba(20, 20, 20, 0.8)",
              backdropFilter: "blur(5px)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              cursor: "pointer",
              zIndex: 10,
              fontWeight: "600",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>☰</span> MOSTRAR MENÚ
          </button>
        )
      }

      {/* Map Container */}
      <div ref={mapContainerRef} style={{ flexGrow: 1, minHeight: 0 }} />

      {/* Photo Overlay */}
      {
        activePhoto && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
              animation: "fadeIn 0.3s ease",
            }}
            onClick={closePhotoOverlay}
          >
            <div
              style={{
                maxWidth: "90%",
                maxHeight: "80%",
                background: "white",
                padding: "10px",
                borderRadius: "8px",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto.url}
                alt="Route Point"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  display: "block",
                  borderRadius: "4px",
                }}
              />
              <button
                onClick={closePhotoOverlay}
                style={{
                  marginTop: "15px",
                  width: "100%",
                  padding: "10px",
                  background: "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                Continuar Recorrido
              </button>
            </div>
          </div>
        )
      }
    </div>
  );
}
