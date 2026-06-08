"use client";
import Head from "next/head";
import React, { useState, useRef, ChangeEvent } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { gpx } from "@tmcw/togeojson";
import * as GeoJSON from "geojson";
import * as turf from "@turf/turf";

// Types & constants
import { PhotoMarker, Keyframe } from "./types";
import {
  DEFAULT_CAMERA_PITCH,
  DEFAULT_CAMERA_ALTITUDE,
  DEFAULT_TERRAIN_EXAGGERATION,
  DEFAULT_ANIMATION_DURATION,
  DEFAULT_CAMERA_ROTATION,
} from "./constants/defaults";

// Hooks
import { useMapInit }       from "./hooks/useMapInit";
import { useGpxProcessor }  from "./hooks/useGpxProcessor";
import { useAnimation }     from "./hooks/useAnimation";
import { useSlideshow }     from "./hooks/useSlideshow";
import { usePhotoMarkers }  from "./hooks/usePhotoMarkers";
import { useCameraSettings } from "./hooks/useCameraSettings";

// Components
import { Sidebar }       from "./components/Sidebar";
import { PhotoOverlay }  from "./components/PhotoOverlay";
import { AvatarBadge }   from "./components/AvatarBadge";
import { StatsWidget }   from "./components/StatsWidget";

// Utilities
import { buildElevationProfile, calculateElevationGain } from "./utils/gpxUtils";

const { point: turfPoint, distance: turfDistance } = turf;

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

// ---------------------------------------------------------------------------
// Page component — acts as orchestrator only
// ---------------------------------------------------------------------------
export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const statsWidgetRef  = useRef<HTMLDivElement | null>(null);

  // ---- Map initialisation ------------------------------------------------
  const {
    mapRef, threeLayerRef,
    isMapLoaded, isTerrainReady,
    statusMessage, setStatusMessage,
    error: mapError,
  } = useMapInit(mapContainerRef);

  // ---- GPX state ---------------------------------------------------------
  const [gpxData, setGpxData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [photos, setPhotos]   = useState<PhotoMarker[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ---- Keyframes ---------------------------------------------------------
  const [keyframes,    setKeyframes]    = useState<Keyframe[]>([]);
  const [useKeyframes, setUseKeyframes] = useState(false);

  // ---- UI ----------------------------------------------------------------
  const [isMenuVisible,   setIsMenuVisible]   = useState(true);
  const [hideMenuOnStart, setHideMenuOnStart] = useState(false);
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null);

  // ---- Camera settings ---------------------------------------------------
  const {
    cameraPitch, setCameraPitch,
    cameraAltitude, setCameraAltitude,
    cameraRotation, setCameraRotation,
    animationDuration, setAnimationDuration,
    terrainExaggeration, setTerrainExaggeration,
  } = useCameraSettings();

  // ---- GPX processor -----------------------------------------------------
  const {
    gpxFeature, totalPathDistance, startBearing,
    totalElevationGainRef, elevationProfileRef,
  } = useGpxProcessor(
    gpxData, isMapLoaded, cameraPitch, mapRef, setStatusMessage,
    (err) => setError(err)
  );

  // ---- Slideshow ---------------------------------------------------------
  const {
    activePhoto, setActivePhoto,
    slideshowQueue, setSlideshowQueue,
    currentSlideIndex, setCurrentSlideIndex,
    isPausedForPhotoRef, closePhotoOverlay,
  } = useSlideshow();

  // ---- Animation ---------------------------------------------------------
  const {
    isAnimating, setIsAnimating,
    activeKeyframeIndex, setActiveKeyframeIndex,
    currentDistanceRef,
    handleToggleAnimation, handleResetAnimation, handleCaptureKeyframe,
  } = useAnimation(
    mapRef, threeLayerRef,
    isTerrainReady, statusMessage, setStatusMessage,
    (err) => setError(err),
    gpxFeature, totalPathDistance, startBearing,
    elevationProfileRef, totalElevationGainRef, statsWidgetRef,
    photos, setPhotos,
    isPausedForPhotoRef, setActivePhoto, setSlideshowQueue, setCurrentSlideIndex,
    keyframes, useKeyframes, setKeyframes, setUseKeyframes,
    cameraPitch, cameraAltitude, cameraRotation, animationDuration,
    hideMenuOnStart, setIsMenuVisible,
  ) as ReturnType<typeof useAnimation> & {
    setActiveKeyframeIndex: React.Dispatch<React.SetStateAction<number>>;
  };

  // ---- Photo markers on map ----------------------------------------------
  usePhotoMarkers(photos, mapRef);

  // ---- Active error (map init error takes precedence) --------------------
  const displayError = error || mapError;

  // ---- handleFileChange --------------------------------------------------
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setStatusMessage(null);
    setGpxData(null);
    setIsAnimating(false);
    setPhotos([]);
    setKeyframes([]);
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
        const parser     = new DOMParser();
        const doc        = parser.parseFromString(gpxContent, "application/xml");
        const geojsonData = gpx(doc);
        setGpxData(geojsonData);

        // Pre-build elevation profile so it's ready before the first animation frame
        if (geojsonData.features?.length > 0) {
          const feature = geojsonData.features[0] as GeoJSON.Feature<GeoJSON.LineString>;
          totalElevationGainRef.current = calculateElevationGain(feature);
          elevationProfileRef.current   = buildElevationProfile(feature);
        }

        setStatusMessage("Archivo GPX leído. Procesando...");
      } catch (err) {
        console.error("Error leyendo archivo GPX:", err);
        setError(`Error leyendo GPX: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => { setIsLoading(false); setError("Error de lectura en el archivo GPX."); };
    reader.readAsText(file);
  };

  // ---- handleAddPhoto ----------------------------------------------------
  const handleAddPhoto = (
    event: React.ChangeEvent<HTMLInputElement>,
    waypointDistanceOverride?: number
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const capturedDistance = waypointDistanceOverride ?? currentDistanceRef.current;

    let coord: [number, number] = [0, 0];
    if (gpxFeature && totalPathDistance > 0) {
      try {
        const pt = turf.along(gpxFeature, Math.max(0, Math.min(capturedDistance, totalPathDistance)), { units: "meters" });
        coord = pt.geometry.coordinates as [number, number];
      } catch { /* fallback to [0,0] */ }
    }

    setPhotos((prev) => [
      ...prev,
      { id: Date.now().toString(), url, coordinate: coord, distanceAlongPath: capturedDistance, shown: false, enabled: true },
    ]);
    event.target.value = "";
  };

  // ---- Camera slider definitions -----------------------------------------
  const cameraSliders = [
    { label: "Altitud cámara", unit: "m", value: cameraAltitude, min: 50, max: 2000, step: 50, onChange: setCameraAltitude, tip: "Altura de la cámara sobre el terreno (metros)" },
    { label: "Inclinación cámara", unit: "°", value: cameraPitch, min: 0, max: 85, step: 5, onChange: setCameraPitch, tip: "0° = vista cenital, 85° = horizonte" },
    { label: "Rotación orbital", unit: "°", value: cameraRotation, min: 0, max: 720, step: 10, onChange: setCameraRotation, tip: "Grados que rota la cámara durante todo el recorrido" },
    { label: "Duración animación", unit: "s", value: animationDuration, min: 15, max: 300, step: 15, onChange: setAnimationDuration, tip: "Duración total del recorrido animado" },
    {
      label: "Exageración terreno", unit: "x", value: terrainExaggeration, min: 0.5, max: 4, step: 0.1,
      onChange: (v: number) => setTerrainExaggeration(v, mapRef),
      tip: "Amplifica visualmente la altura de montañas y valles",
    },
  ];

  // Suppress unused-var warnings for turf helpers only imported for tree-shaking
  void turfPoint; void turfDistance;

  // ---- Render ------------------------------------------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: "sans-serif" }}>
      <Head><title>FlyBy 3D — Visor GPX</title></Head>

      {/* Sidebar (controls panel) */}
      <Sidebar
        isMenuVisible={isMenuVisible}
        setIsMenuVisible={setIsMenuVisible}
        error={displayError}
        statusMessage={statusMessage}
        isLoading={isLoading}
        isAnimating={isAnimating}
        gpxFeature={gpxFeature}
        isTerrainReady={isTerrainReady}
        handleFileChange={handleFileChange}
        photos={photos}
        setPhotos={setPhotos}
        currentDistanceKm={currentDistanceRef.current / 1000}
        handleAddPhoto={handleAddPhoto}
        handleToggleAnimation={handleToggleAnimation}
        handleResetAnimation={handleResetAnimation}
        sliders={cameraSliders}
        keyframes={keyframes}
        setKeyframes={setKeyframes}
        useKeyframes={useKeyframes}
        setUseKeyframes={setUseKeyframes}
        activeKeyframeIndex={activeKeyframeIndex}
        setActiveKeyframeIndex={setActiveKeyframeIndex}
        handleCaptureKeyframe={handleCaptureKeyframe}
        hideMenuOnStart={hideMenuOnStart}
        setHideMenuOnStart={setHideMenuOnStart}
        avatarUrl={avatarUrl}
        setAvatarUrl={setAvatarUrl}
      />

      {/* Avatar badge (top-right) */}
      {avatarUrl && <AvatarBadge avatarUrl={avatarUrl} />}

      {/* Stats widget (bottom-center, shown when a route is loaded) */}
      {gpxFeature && <StatsWidget statsRef={statsWidgetRef} />}

      {/* Map canvas */}
      <div ref={mapContainerRef} style={{ flexGrow: 1, minHeight: 0 }} />

      {/* Photo slideshow overlay */}
      {activePhoto && <PhotoOverlay photo={activePhoto} onClose={closePhotoOverlay} />}

      {/* Global keyframe animations */}
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
