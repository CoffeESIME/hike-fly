"use client";
import Head from "next/head";
import React, { useState, useRef, useMemo, ChangeEvent } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as GeoJSON from "geojson";

// Types & constants
import { PhotoMarker, Keyframe } from "./types";


// Hooks
import { useMapInit }       from "./hooks/useMapInit";
import { useGpxProcessor }  from "./hooks/useGpxProcessor";
import { useAnimation }     from "./hooks/useAnimation";
import { useSlideshow }     from "./hooks/useSlideshow";
import { usePhotoMarkers }  from "./hooks/usePhotoMarkers";
import { useCameraSettings } from "./hooks/useCameraSettings";

// Components
import { Sidebar }              from "./components/Sidebar";
import { PhotoOverlay }         from "./components/PhotoOverlay";
import { AvatarBadge }         from "./components/AvatarBadge";
import { StatsWidget }         from "./components/StatsWidget";
import { RouteCompleteOverlay } from "./components/RouteCompleteOverlay";

// Utilities
import { readGpx, routePointAtDistance } from "./utils/gpxUtils";
import { DEFAULT_STATISTICS, statisticsAtDistance } from "./utils/statistics";
import { StatisticsControls } from "./components/StatisticsControls";
import { RouteCard } from "./components/RouteCard";
import { ElevationProfile } from "./components/ElevationProfile";
import { buildElevationChart, elevationChartAvailability } from "./utils/elevationChart";
import { getVideoClipDuration } from "./utils/videoClip";


mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

// ---------------------------------------------------------------------------
// Page component — acts as orchestrator only
// ---------------------------------------------------------------------------
export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const statsWidgetRef  = useRef<HTMLDivElement | null>(null);
  const elevationProgressRef = useRef<((distance: number) => void) | null>(null);
  const [showElevationProfile, setShowElevationProfile] = useState(true);

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
  const [onlyDistance,    setOnlyDistance]    = useState(false);
  const [avatarUrl,           setAvatarUrl]           = useState<string | null>(null);
  const [customModelUrl,      setCustomModelUrl]      = useState<string | null>(null);
  const [modelType,           setModelType]           = useState<"mixtli" | "corvid" | "custom">("corvid");
  const [modelScale,          setModelScaleState]     = useState<number>(20);
  const [showRouteComplete,   setShowRouteComplete]   = useState(false);

  const [statisticsSettings, setStatisticsSettings] = useState(DEFAULT_STATISTICS);

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
    elevationProfileRef, profile, summary,
  } = useGpxProcessor(
    gpxData, isMapLoaded, cameraPitch, mapRef, setStatusMessage,
    setError, statisticsSettings.elevationThreshold
  );

  const elevationChart = useMemo(() => gpxFeature ? buildElevationChart(profile, gpxFeature.properties.segmentStarts) : null, [profile, gpxFeature]);
  const elevationUnavailableReason = useMemo(() => elevationChartAvailability(profile), [profile]);

  // ---- Slideshow ---------------------------------------------------------
  const {
    activePhoto, setActivePhoto,
    setSlideshowQueue,
    setCurrentSlideIndex,
    isPausedForPhotoRef, closePhotoOverlay, advanceSlideshow,
  } = useSlideshow();

  // ---- Animation ---------------------------------------------------------
  const {
    isAnimating, isOverview, setIsAnimating,
    activeKeyframeIndex, setActiveKeyframeIndex,
    currentDistanceRef,
    handleToggleAnimation, handleResetAnimation, handleCaptureKeyframe,
  } = useAnimation(
    mapRef, threeLayerRef,
    isTerrainReady, statusMessage, setStatusMessage,
    (err) => setError(err),
    gpxFeature, totalPathDistance, startBearing,
    elevationProfileRef, statisticsSettings, statsWidgetRef,
    photos, setPhotos,
    isPausedForPhotoRef, setActivePhoto, setSlideshowQueue, setCurrentSlideIndex,
    keyframes, useKeyframes, setKeyframes, setUseKeyframes,
    cameraPitch, cameraAltitude, cameraRotation, animationDuration,
    hideMenuOnStart, setIsMenuVisible,
    onlyDistance,
    () => setShowRouteComplete(true),
    elevationProgressRef,
  ) as ReturnType<typeof useAnimation> & {
    setActiveKeyframeIndex: React.Dispatch<React.SetStateAction<number>>;
  };

  // ---- Photo markers on map ----------------------------------------------
  usePhotoMarkers(photos, mapRef);

  // ---- Active error (map init error takes precedence) --------------------
  const displayError = error || mapError;

  // ---- GPX Loading Helpers -----------------------------------------------
  const resetGpxState = () => {
    setError(null);
    setStatusMessage(null);
    setGpxData(null);
    setIsAnimating(false);
    setPhotos([]);
    setKeyframes([]);
    setUseKeyframes(false);
    setShowRouteComplete(false);
    setStatisticsSettings(DEFAULT_STATISTICS);
    handleResetAnimation();
  };

  const loadGpxString = (gpxContent: string) => {
    try {
      const parser     = new DOMParser();
      const doc        = parser.parseFromString(gpxContent, "application/xml");
      const geojsonData = readGpx(doc);
      setGpxData(geojsonData);


      setStatusMessage("Archivo GPX leído. Procesando...");
    } catch (err) {
      console.error("Error leyendo archivo GPX:", err);
      setError(`Error leyendo GPX: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- handleFileChange --------------------------------------------------
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetGpxState();

    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("Selecciona un archivo .gpx válido.");
      return;
    }

    setIsLoading(true);
    setStatusMessage("Leyendo archivo...");

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const gpxContent = e.target?.result as string;
      loadGpxString(gpxContent);
    };
    reader.onerror = () => { setIsLoading(false); setError("Error de lectura en el archivo GPX."); };
    reader.readAsText(file);
  };

  // ---- handleLoadDefaultGpx ----------------------------------------------
  const handleLoadDefaultGpx = async () => {
    resetGpxState();
    setIsLoading(true);
    setStatusMessage("Cargando ruta de ejemplo...");
    try {
      const res = await fetch("/gpx/cascada-congelada-y-laguna-de-nahualac-sin-pasar-por-nexcola.gpx");
      if (!res.ok) throw new Error("No se pudo cargar la ruta de ejemplo.");
      const text = await res.text();
      loadGpxString(text);
    } catch (err) {
      setIsLoading(false);
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ---- handleAddPhoto ----------------------------------------------------
  const handleAddPhoto = async (
    event: React.ChangeEvent<HTMLInputElement>,
    waypointDistanceOverride?: number
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const url = URL.createObjectURL(file);
    const capturedDistance = waypointDistanceOverride ?? currentDistanceRef.current;

    let coord: [number, number] = [0, 0];
    if (gpxFeature && totalPathDistance > 0) {
      try {
        const pt = routePointAtDistance(profile, Math.max(0, Math.min(capturedDistance, totalPathDistance)));
        coord = pt.geometry.coordinates as [number, number];
      } catch { /* fallback to [0,0] */ }
    }

    let duration: number | undefined;
    if (isVideo) {
      const video = document.createElement("video");
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("No se pudo leer la duración del video.")), 15000);
          video.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            duration = video.duration;
            if (!Number.isFinite(duration) || duration <= 0) {
              reject(new Error("El video no tiene una duración válida."));
            } else {
              resolve();
            }
          };
          video.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error("No se pudo abrir el video. Prueba con otro archivo."));
          };
          video.preload = "metadata";
          video.src = url;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo abrir el video.");
        URL.revokeObjectURL(url);
        event.target.value = "";
        return;
      } finally {
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
        video.load();
      }

      if (duration !== undefined && duration > 10) {
        alert("El video supera el límite de 10 segundos. Se usarán solo los primeros 10 segundos; puedes reducir el fragmento de 1 a 10 segundos en este punto de la ruta.");
      }
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
        mediaType: isVideo ? "video" : "image",
        duration,
        clipDuration: isVideo ? getVideoClipDuration(duration) : undefined,
      },
    ]);
    event.target.value = "";
  };

  // ---- handleModelTypeChange ---------------------------------------------
  const handleModelTypeChange = (type: "mixtli" | "corvid" | "custom") => {
    setModelType(type);
    if (threeLayerRef.current) {
      if (type === "mixtli") {
        threeLayerRef.current.changeModel("/models/mixtli-model.glb");
        setStatusMessage("Modelo 3D cambiado a Mixtli.");
      } else if (type === "corvid") {
        threeLayerRef.current.changeModel("/models/corvid.glb");
        setStatusMessage("Modelo 3D cambiado a Corvid.");
      } else if (type === "custom" && customModelUrl) {
        threeLayerRef.current.changeModel(customModelUrl);
        setStatusMessage("Modelo 3D cambiado a Personalizado.");
      }
    }
  };

  // ---- handleModelChange -------------------------------------------------
  const handleModelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (customModelUrl) {
      URL.revokeObjectURL(customModelUrl);
    }

    const url = URL.createObjectURL(file);
    setCustomModelUrl(url);
    setModelType("custom");
    if (threeLayerRef.current) {
      threeLayerRef.current.changeModel(url);
      setStatusMessage("Modelo 3D personalizado actualizado.");
    }
    event.target.value = "";
  };

  // ---- Camera slider definitions -----------------------------------------
  // Handler that syncs model scale to both state and the live THREE layer
  const handleModelScaleChange = (v: number) => {
    setModelScaleState(v);
    if (threeLayerRef.current) {
      threeLayerRef.current.setModelScale(v);
    }
  };

  const cameraSliders = [
    { label: "Altitud cámara", unit: "m", value: cameraAltitude, min: 50, max: 2000, step: 50, onChange: setCameraAltitude, tip: "Altura de la cámara sobre el terreno (metros)" },
    { label: "Inclinación cámara", unit: "°", value: cameraPitch, min: 0, max: 85, step: 5, onChange: setCameraPitch, tip: "0° = vista cenital, 85° = horizonte" },
    { label: "Rotación orbital", unit: "°", value: cameraRotation, min: 0, max: 720, step: 10, onChange: setCameraRotation, tip: "Grados que rota la cámara durante todo el recorrido" },
    { label: "Duración animación", unit: "s", value: animationDuration, min: 15, max: 300, step: 5, onChange: setAnimationDuration, tip: "Duración total del recorrido animado" },
    {
      label: "Exageración terreno", unit: "x", value: terrainExaggeration, min: 0.5, max: 4, step: 0.1,
      onChange: (v: number) => setTerrainExaggeration(v, mapRef),
      tip: "Amplifica visualmente la altura de montañas y valles",
    },
    {
      label: "Tamaño modelo 3D", unit: "m", value: modelScale, min: 5, max: 200, step: 5,
      onChange: handleModelScaleChange,
      tip: "Tamaño del modelo 3D en metros (escala real sobre el terreno)",
    },
  ];

  const liveItems = useMemo(() => statisticsAtDistance(profile, statisticsSettings, currentDistanceRef.current, false, summary).filter(item => !onlyDistance || item.key === "distance"), [profile, statisticsSettings, summary, onlyDistance, currentDistanceRef]);
  const finalItems = useMemo(() => statisticsAtDistance(profile, statisticsSettings, summary.distance, true, summary).filter(item => !onlyDistance || item.key === "distance"), [profile, statisticsSettings, summary, onlyDistance]);

  // ---- Render ------------------------------------------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: "sans-serif" }}>
      <Head><title>FlyBy 3D — Visor GPX</title></Head>

      {/* Sidebar (controls panel) */}
      <Sidebar
        routeTools={gpxFeature && <>
          <StatisticsControls settings={statisticsSettings} onChange={setStatisticsSettings} summary={summary}
            showElevationProfile={showElevationProfile} onShowElevationProfileChange={setShowElevationProfile}
            elevationUnavailableReason={elevationUnavailableReason} />
          <RouteCard route={gpxFeature} items={finalItems} />
        </>}
        isMenuVisible={isMenuVisible}
        setIsMenuVisible={setIsMenuVisible}
        hideWhileRouteComplete={showRouteComplete || isOverview}
        error={displayError}
        statusMessage={statusMessage}
        isLoading={isLoading}
        isAnimating={isAnimating}
        gpxFeature={gpxFeature}
        isTerrainReady={isTerrainReady}
        handleFileChange={handleFileChange}
        handleLoadDefaultGpx={handleLoadDefaultGpx}
        photos={photos}
        setPhotos={setPhotos}
        currentDistanceKm={currentDistanceRef.current / 1000}
        handleAddPhoto={handleAddPhoto}
        handleToggleAnimation={handleToggleAnimation}
        handleResetAnimation={() => { setShowRouteComplete(false); handleResetAnimation(); }}
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
        onlyDistance={onlyDistance}
        setOnlyDistance={setOnlyDistance}
        avatarUrl={avatarUrl}
        setAvatarUrl={setAvatarUrl}
        customModelUrl={customModelUrl}
        handleModelChange={handleModelChange}
        modelType={modelType}
        handleModelTypeChange={handleModelTypeChange}
      />

      {/* Avatar badge (top-right) */}
      {avatarUrl && <AvatarBadge avatarUrl={avatarUrl} />}

      {gpxFeature && <div className={`route-hud${isMenuVisible ? " route-hud-menu-open" : ""}`}
        style={{ visibility: showRouteComplete || isOverview || activePhoto ? "hidden" : "visible" }}>
        {showElevationProfile && elevationChart && !showRouteComplete && !activePhoto && (
          <ElevationProfile profile={profile} chart={elevationChart} progressRef={elevationProgressRef}
            distanceRef={currentDistanceRef} />
        )}
        <StatsWidget statsRef={statsWidgetRef} items={liveItems} />
      </div>}

      {/* Map canvas */}
      <div ref={mapContainerRef} style={{ flexGrow: 1, minHeight: 0 }} />

      {/* Photo slideshow overlay */}
      {activePhoto && <PhotoOverlay key={activePhoto.id} photo={activePhoto} onClose={closePhotoOverlay} onAdvance={advanceSlideshow} />}

      {/* Route complete overlay */}
      {showRouteComplete && (
        <RouteCompleteOverlay
          items={finalItems}
          onClose={() => setShowRouteComplete(false)}
        />
      )}

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
