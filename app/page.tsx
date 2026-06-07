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
  distance,
} = turf;

// --- Configuration ---
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
const CAMERA_PITCH = 60;
const CAMERA_ALTITUDE_ABOVE_TERRAIN = 500;  // meters above terrain
const TERRAIN_EXAGGERATION = 1.5;            // higher = more dramatic terrain relief
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
  enabled: boolean; // To toggle visibility in the UI
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

  // Manual pause: tracks wall-clock time when user paused, so resume is seamless
  const manualPauseWallTimeRef = useRef<number>(0);

  // Bearing smoothing: prevents model wobble on tight trail curves
  const smoothedBearingRef = useRef<number | null>(null);

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Slideshow State
  const [slideshowQueue, setSlideshowQueue] = useState<PhotoMarker[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(-1);

  // Stats Refs
  const totalElevationGainRef = useRef<number>(0);
  const statsWidgetRef = useRef<HTMLDivElement>(null);
  const elevationProfileRef = useRef<{ dist: number; ele: number }[]>([]);

  // Ref to always hold the latest animationStep closure (avoids stale-closure bug
  // when useCallback deps change and the isAnimating useEffect re-runs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const animationStepRef = useRef<(timestamp: number) => void>(() => {});

  const calculateElevationGain = (geojson: GeoJSON.Feature<GeoJSON.LineString>) => {
    let gain = 0;
    const coords = geojson.geometry.coordinates;
    for (let i = 1; i < coords.length; i++) {
      const diff = coords[i][2] - coords[i - 1][2];
      if (diff > 0) gain += diff;
    }
    return gain;
  };

  const getElevationAtDistance = (targetDist: number) => {
    const profile = elevationProfileRef.current;
    if (profile.length === 0) return 0;
    if (targetDist <= 0) return profile[0].ele;
    if (targetDist >= profile[profile.length - 1].dist) return profile[profile.length - 1].ele;

    // Binary search or linear search (linear is fine for animation if we track index, but binary is safer/easier to implement stateless)
    // Optimization: Since we move forward, we could cache index, but let's stick to simple binary search for now or just find.
    // Given the number of points might be large, binary search is better.

    let low = 0, high = profile.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (profile[mid].dist < targetDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // 'low' is the index of the first element > targetDist
    // So we interpolate between low-1 and low
    const p2 = profile[low];
    const p1 = profile[low - 1];

    if (!p1) return p2.ele; // Should not happen if check bounds
    if (!p2) return p1.ele;

    const t = (targetDist - p1.dist) / (p2.dist - p1.dist);
    return p1.ele + (p2.ele - p1.ele) * t;
  };

  const handleCaptureKeyframe = () => {
    const map = mapRef.current;
    if (!map) return;

    const camera = map.getFreeCameraOptions();
    if (!camera.position || !camera.orientation) return;

    const dist = currentDistanceRef.current;
    console.log(`[Keyframe] Capturing at distance=${dist.toFixed(1)}m | manualPauseWall=${manualPauseWallTimeRef.current} | totalPaused=${totalPausedTimeRef.current}ms | animStart=${animationStartTimeRef.current}`);

    const newKeyframe: Keyframe = {
      distance: dist,
      position: camera.position,
      orientation: camera.orientation as [number, number, number, number],
    };

    setKeyframes((prev) => {
      const newFrames = [...prev, newKeyframe].sort((a, b) => a.distance - b.distance);
      console.log(`[Keyframe] Total keyframes now: ${newFrames.length}`);
      // Auto-enable keyframe mode once we have at least 2
      if (newFrames.length >= 2) {
        setUseKeyframes(true);
      }
      return newFrames;
    });
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
        preserveDrawingBuffer: true, // Required for canvas.captureStream() recording
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
          map.setTerrain({ source: "mapbox-dem", exaggeration: TERRAIN_EXAGGERATION });
        }

        // Add 3D Character Layer
        const customLayer = new ThreeCustomLayer("3d-character-layer");
        map.addLayer(customLayer);
        threeLayerRef.current = customLayer;

        let terrainCheckAttempts = 0;
        const MAX_TERRAIN_ATTEMPTS = 15; // 15 seconds max
        const checkReady = () => {
          terrainCheckAttempts++;
          const demLoaded = map.isSourceLoaded("mapbox-dem");
          const terrainSet = !!map.getTerrain();
          const elevFnAvailable = typeof map.queryTerrainElevation === "function";

          console.log(`Verificando terreno (intento ${terrainCheckAttempts}):`, { demLoaded, terrainSet, elevFnAvailable });

          if ((demLoaded && terrainSet && elevFnAvailable) || terrainCheckAttempts >= MAX_TERRAIN_ATTEMPTS) {
            if (terrainCheckAttempts >= MAX_TERRAIN_ATTEMPTS && !demLoaded) {
              console.warn("Terreno DEM no cargó completamente (posible bloqueador). Continuando de todas formas.");
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

      // Clamp distance to valid range to prevent turf errors on edge cases
      const safeDistance = Math.max(0, Math.min(distanceAlongPath, totalPathDistance));
      const exactTargetFeature = along(gpxFeature, safeDistance, {
        units: "meters",
      });
      const exactTargetCoords = exactTargetFeature.geometry
        .coordinates as LngLatLike;

      // Check for Photos
      const PHOTO_TRIGGER_DISTANCE = 20; // meters
      const photosToShow = photos.filter((p) => {
        return (
          p.enabled && // Only show enabled photos
          !p.shown &&
          Math.abs(p.distanceAlongPath - distanceAlongPath) <
          PHOTO_TRIGGER_DISTANCE
        );
      });

      if (photosToShow.length > 0) {
        console.log("Starting slideshow with:", photosToShow.length, "photos");
        isPausedForPhotoRef.current = true;

        // Start Slideshow
        setSlideshowQueue(photosToShow);
        setCurrentSlideIndex(0);
        setActivePhoto(photosToShow[0]);

        // Mark ALL as shown so we don't trigger them again
        const idsToShow = new Set(photosToShow.map(p => p.id));
        setPhotos((prev) =>
          prev.map((p) => (idsToShow.has(p.id) ? { ...p, shown: true } : p))
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

      // Use { exaggerated: true } so the returned elevation matches the VISUAL terrain height
      // (which is scaled by TERRAIN_EXAGGERATION). Without this, the camera flies through mountains.
      const targetElevation =
        map.queryTerrainElevation(smoothedTargetCoords, { exaggerated: true }) ?? 0;

      // Update Stats Widget
      if (statsWidgetRef.current) {
        statsWidgetRef.current.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div style="font-size: 0.7rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">Distancia</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: white;">
              ${(distanceAlongPath / 1000).toFixed(2)} <span style="font-size: 0.8rem; color: #888;">/ ${(totalPathDistance / 1000).toFixed(2)} km</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
             <div style="font-size: 0.7rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">Altitud</div>
             <div style="font-size: 1.2rem; font-weight: 700; color: white;">${getElevationAtDistance(distanceAlongPath).toFixed(0)} <span style="font-size: 0.8rem; color: #888;">m</span></div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
             <div style="font-size: 0.7rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">Desnivel +</div>
             <div style="font-size: 1.2rem; font-weight: 700; color: white;">${totalElevationGainRef.current.toFixed(0)} <span style="font-size: 0.8rem; color: #888;">m</span></div>
          </div>
        `;
      }

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

        // Use a longer lookahead (30m) for a stable, jitter-free bearing
        const lookAheadDist = Math.min(distanceAlongPath + 30, totalPathDistance - 1);
        const nextStep = along(
          gpxFeature,
          lookAheadDist,
          { units: "meters" }
        );
        const nextCoords = nextStep.geometry.coordinates;
        const rawBearing = bearing(
          point([tCoords.lng, tCoords.lat]),
          point(nextCoords)
        );

        // Smooth the bearing to prevent snapping on sharp curves
        // Lerp with short angular-wrap to avoid 359°→0° jump
        if (smoothedBearingRef.current === null) {
          smoothedBearingRef.current = rawBearing;
        } else {
          let delta = rawBearing - smoothedBearingRef.current;
          // Wrap delta to [-180, 180]
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          smoothedBearingRef.current = smoothedBearingRef.current + delta * 0.08;
        }
        const charBearing = smoothedBearingRef.current;

        // Query exaggerated elevation so the model sits on top of the VISUAL terrain
        const modelElevation =
          map.queryTerrainElevation(smoothedTargetCoords, { exaggerated: true }) ?? targetElevation;

        threeLayerRef.current.updatePosition(
          tCoords.lng,
          tCoords.lat,
          modelElevation,
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

  // Keep animationStepRef in sync so the rAF loop always uses the latest closure
  useEffect(() => {
    animationStepRef.current = animationStep;
  }, [animationStep]);

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

      // If resuming from a manual pause, account for the wall-clock time we were paused
      if (manualPauseWallTimeRef.current > 0 && animationStartTimeRef.current !== null) {
        const pausedWallMs = performance.now() - manualPauseWallTimeRef.current;
        totalPausedTimeRef.current += pausedWallMs;
        console.log(`[Resume] Resuming. pausedWallMs=${pausedWallMs.toFixed(0)}ms | totalPausedMs=${totalPausedTimeRef.current.toFixed(0)}ms | animStart=${animationStartTimeRef.current}`);
        manualPauseWallTimeRef.current = 0;
      } else {
        console.log(`[Start] Fresh start. animStart=${animationStartTimeRef.current}`);
      }

      // Reset all state only when starting fresh (not resuming)
      if (animationStartTimeRef.current === null) {
        totalPausedTimeRef.current = 0;
        pauseStartTimeRef.current = 0;
        isPausedForPhotoRef.current = false;
        smoothedBearingRef.current = null;
        manualPauseWallTimeRef.current = 0; // ← clear any stale pause timestamp
        // Reset photos shown state
        setPhotos((prev) => prev.map((p) => ({ ...p, shown: false })));
      }

      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);

      animationFrameRef.current = requestAnimationFrame((ts) => animationStepRef.current(ts));
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // *** FIX: Only record pause timestamp ONCE.
      // If keyframes/state update causes this effect to re-run while already paused,
      // we must NOT overwrite the original pause timestamp — that would shrink the
      // compensated paused duration and make the animation jump forward on resume.
      if (animationStartTimeRef.current !== null && manualPauseWallTimeRef.current === 0) {
        manualPauseWallTimeRef.current = performance.now();
        console.log(`[Pause] Pause recorded at wall=${manualPauseWallTimeRef.current.toFixed(0)} | dist=${currentDistanceRef.current.toFixed(1)}m`);
      } else if (animationStartTimeRef.current !== null) {
        console.log(`[Pause re-run] useEffect re-ran while already paused — NOT overwriting manualPauseWall (currently ${manualPauseWallTimeRef.current.toFixed(0)})`);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating, gpxFeature, isTerrainReady, statusMessage]);

  // Slideshow Timer Logic
  useEffect(() => {
    if (!activePhoto || slideshowQueue.length === 0) return;

    const timer = setTimeout(() => {
      const nextIndex = currentSlideIndex + 1;
      if (nextIndex < slideshowQueue.length) {
        // Show next photo
        setCurrentSlideIndex(nextIndex);
        setActivePhoto(slideshowQueue[nextIndex]);
      } else {
        // End of slideshow
        setActivePhoto(null);
        setSlideshowQueue([]);
        setCurrentSlideIndex(-1);
        isPausedForPhotoRef.current = false;
      }
    }, 3000); // 3 seconds per photo

    return () => clearTimeout(timer);
  }, [activePhoto, slideshowQueue, currentSlideIndex]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setStatusMessage(null);
    setGpxData(null);
    setGpxFeature(null);
    setTotalPathDistance(0);
    setIsAnimating(false);
    setPhotos([]); // Reset photos on new file
    setKeyframes([]); // Reset keyframes on new file
    setUseKeyframes(false);

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

        // Calculate stats & Build Elevation Profile
        if (geojsonData.features && geojsonData.features.length > 0) {
          const feature = geojsonData.features[0] as GeoJSON.Feature<GeoJSON.LineString>;
          totalElevationGainRef.current = calculateElevationGain(feature);

          // Build Profile
          const coords = feature.geometry.coordinates;
          const profile: { dist: number; ele: number }[] = [];
          let dist = 0;
          profile.push({ dist: 0, ele: coords[0][2] || 0 });

          for (let i = 1; i < coords.length; i++) {
            const from = point(coords[i - 1]);
            const to = point(coords[i]);
            const d = distance(from, to, { units: "meters" });
            dist += d;
            profile.push({ dist: dist, ele: coords[i][2] || 0 });
          }
          elevationProfileRef.current = profile;
        }

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
    if (!gpxFeature) {
      setError("Primero carga una ruta GPX.");
      return;
    }
    if (!isTerrainReady) {
      setError("Espera a que el terreno termine de cargar.");
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
    manualPauseWallTimeRef.current = 0;  // ← clear stale pause timestamp
    smoothedBearingRef.current = null;   // ← reset bearing smoother
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

  const handleAddPhoto = (event: React.ChangeEvent<HTMLInputElement>, waypointDistanceOverride?: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    // Use the override distance (from a specific waypoint) or current animation position
    const capturedDistance = waypointDistanceOverride ?? currentDistanceRef.current;

    // Get geographic coordinate from gpxFeature at that distance
    let coord: [number, number] = [0, 0];
    if (gpxFeature && totalPathDistance > 0) {
      try {
        const pt = along(gpxFeature, Math.max(0, Math.min(capturedDistance, totalPathDistance)), { units: "meters" });
        coord = pt.geometry.coordinates as [number, number];
      } catch { /* fallback to [0,0] */ }
    }

    setPhotos((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        url,
        coordinate: coord,
        distanceAlongPath: capturedDistance,
        shown: false,
        enabled: true,
      },
    ]);

    // Reset input so same file can be re-added
    event.target.value = "";
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

          {/* Waypoint / Photo Manager */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "#888", fontWeight: "600" }}>
                Puntos de Foto ({photos.length})
              </label>
              {photos.some(p => p.shown) && (
                <button
                  onClick={() => setPhotos(prev => prev.filter(p => !p.shown))}
                  style={{ background: "rgba(255,68,68,0.15)", border: "1px solid rgba(255,68,68,0.4)", color: "#ff6666", borderRadius: "4px", padding: "3px 8px", fontSize: "0.7rem", cursor: "pointer" }}
                  title="Eliminar todos los puntos ya visitados"
                >
                  🗑️ Limpiar pasados
                </button>
              )}
            </div>

            {/* Add new photo point at current position */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: gpxFeature ? "rgba(0, 112, 243, 0.15)" : "rgba(255,255,255,0.05)",
                border: gpxFeature ? "1px dashed rgba(0,198,255,0.5)" : "1px dashed #444",
                borderRadius: "6px",
                cursor: gpxFeature ? "pointer" : "not-allowed",
                fontSize: "0.8rem",
                color: gpxFeature ? "#00c6ff" : "#555",
                marginBottom: "8px",
              }}
              title={gpxFeature ? `Añadir foto en km ${(currentDistanceRef.current / 1000).toFixed(2)}` : "Carga una ruta primero"}
            >
              <span style={{ fontSize: "1.1rem" }}>📷</span>
              <span>+ Foto en posición actual</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                disabled={!gpxFeature}
                onChange={(e) => handleAddPhoto(e)}
              />
            </label>

            {/* Waypoint list */}
            {photos.length > 0 && (
              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "5px" }}>
                {[...photos].sort((a, b) => a.distanceAlongPath - b.distanceAlongPath).map((photo) => {
                  const isPast = photo.shown;
                  const kmLabel = (photo.distanceAlongPath / 1000).toFixed(2);
                  return (
                    <div
                      key={photo.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 8px",
                        background: isPast ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)",
                        border: isPast ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,198,255,0.2)",
                        borderRadius: "6px",
                        opacity: isPast ? 0.5 : 1,
                        transition: "opacity 0.3s",
                      }}
                    >
                      {/* Thumbnail */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt="thumb"
                        style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px", flexShrink: 0 }}
                      />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.75rem", color: isPast ? "#555" : "#ccc", display: "flex", alignItems: "center", gap: "5px" }}>
                          {isPast ? <span title="Ya visitado" style={{ fontSize: "0.65rem" }}>✅</span> : <span title="Próximo" style={{ fontSize: "0.65rem" }}>📍</span>}
                          <span style={{ fontWeight: "600" }}>km {kmLabel}</span>
                        </div>
                      </div>

                      {/* Enable toggle */}
                      <input
                        type="checkbox"
                        checked={photo.enabled}
                        onChange={(e) => setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, enabled: e.target.checked } : p))}
                        title="Activar/Desactivar punto"
                        style={{ cursor: "pointer" }}
                      />

                      {/* Delete */}
                      <button
                        onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                        style={{ background: "none", border: "none", color: "#ff4444", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: "2px" }}
                        title="Eliminar punto"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
          {/* Row 1: Checkbox */}
          <label
            style={{
              fontSize: "0.82rem",
              color: keyframes.length < 2 ? "#555" : "#ccc",
              cursor: keyframes.length < 2 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
            title={keyframes.length < 2 ? "Captura al menos 2 vistas para habilitar keyframes" : "Usa vistas de cámara guardadas"}
          >
            <input
              type="checkbox"
              checked={useKeyframes}
              onChange={(e) => setUseKeyframes(e.target.checked)}
              disabled={keyframes.length < 2}
              style={{ cursor: keyframes.length < 2 ? "not-allowed" : "pointer" }}
            />
            Usar Keyframes {keyframes.length < 2 ? "(Mín. 2)" : ""} ({keyframes.length})
          </label>

          {/* Row 2: Action Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleCaptureKeyframe}
              disabled={isAnimating || !gpxFeature}
              style={{
                flex: 1,
                padding: "9px 0",
                background: (isAnimating || !gpxFeature)
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0, 198, 255, 0.12)",
                color: (isAnimating || !gpxFeature) ? "#555" : "#00c6ff",
                border: `1px solid ${(isAnimating || !gpxFeature) ? "rgba(255,255,255,0.1)" : "rgba(0,198,255,0.45)"}`,
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: (isAnimating || !gpxFeature) ? "not-allowed" : "pointer",
                letterSpacing: "0.03em",
                transition: "background 0.2s, border-color 0.2s",
              }}
            >
              📷 Capturar Vista
            </button>

            <button
              onClick={() => { setKeyframes([]); setUseKeyframes(false); }}
              disabled={keyframes.length === 0}
              style={{
                flex: 1,
                padding: "9px 0",
                background: keyframes.length === 0
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(255, 68, 68, 0.1)",
                color: keyframes.length === 0 ? "#555" : "#ff7070",
                border: `1px solid ${keyframes.length === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,68,68,0.4)"}`,
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: keyframes.length === 0 ? "not-allowed" : "pointer",
                letterSpacing: "0.03em",
                transition: "background 0.2s, border-color 0.2s",
              }}
              title="Eliminar todos los keyframes capturados"
            >
              🗑️ Limpiar Frames
            </button>
          </div>

          <div style={{ fontSize: "0.7rem", color: "#555", fontStyle: "italic", marginTop: "8px" }}>
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
                disabled={false}
              />
              Ocultar menú al iniciar
            </label>
          </div>

          {/* Avatar Upload */}
          <div
            style={{
              marginTop: "15px",
              paddingTop: "15px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
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
              Avatar (esquina superior derecha)
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px dashed rgba(255,255,255,0.2)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "#ccc",
              }}
            >
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt="avatar preview"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid rgba(0,198,255,0.6)",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span style={{ fontSize: "1.5rem" }}>👤</span>
              )}
              <span>{avatarUrl ? "Cambiar avatar" : "Subir foto de perfil"}</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (avatarUrl) URL.revokeObjectURL(avatarUrl);
                  setAvatarUrl(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
            </label>
            {avatarUrl && (
              <button
                onClick={() => { URL.revokeObjectURL(avatarUrl); setAvatarUrl(null); }}
                style={{
                  marginTop: "6px",
                  background: "none",
                  border: "none",
                  color: "#ff6666",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                × Quitar avatar
              </button>
            )}
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

      {/* Avatar Overlay — top-right corner */}
      {avatarUrl && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            width: "90px",
            height: "90px",
            borderRadius: "50%",
            overflow: "hidden",
            zIndex: 20,
            border: "3px solid rgba(255,255,255,0.85)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,198,255,0.3)",
            pointerEvents: "none",
            animation: "avatarPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt="Avatar"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      )}

      {/* Stats Widget */}
      {gpxFeature && (
        <div
          ref={statsWidgetRef}
          style={{
            position: "absolute",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "30px",
            background: "rgba(20, 20, 20, 0.85)",
            backdropFilter: "blur(8px)",
            padding: "15px 30px",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            zIndex: 10,
            pointerEvents: "none",
            fontFamily: "'Inter', sans-serif",
            opacity: 1,
            transition: "opacity 0.3s ease",
          }}
        />
      )}


      {/* Map Container */}
      <div ref={mapContainerRef} style={{ flexGrow: 1, minHeight: 0 }} />

      {/* Photo Modal */}
      {activePhoto && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
            animation: "modalFadeIn 0.4s ease",
          }}
          onClick={closePhotoOverlay}
        >
          <div
            style={{
              maxWidth: "min(85%, 700px)",
              background: "rgba(15,15,15,0.95)",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
              overflow: "hidden",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1rem" }}>📍</span>
                <span style={{ color: "#ccc", fontSize: "0.85rem", fontWeight: "600", fontFamily: "'Inter', sans-serif" }}>
                  Punto km {(activePhoto.distanceAlongPath / 1000).toFixed(2)}
                </span>
              </div>
              <button
                onClick={closePhotoOverlay}
                style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1.3rem", lineHeight: 1 }}
              >×</button>
            </div>

            {/* Photo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhoto.url}
              alt="Punto de ruta"
              style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", display: "block", background: "#000" }}
            />

            {/* Progress bar — animated, 3s countdown */}
            <div style={{ height: "3px", background: "rgba(255,255,255,0.1)" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, #0070f3, #00c6ff)", width: "0%", animation: "photoCountdown 3s linear forwards" }} />
            </div>
          </div>

          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: "14px", fontFamily: "'Inter', sans-serif" }}>
            Continuando en 3 seg — clic para cerrar
          </p>
        </div>
      )}

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes photoCountdown {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes recPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes avatarPop {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
