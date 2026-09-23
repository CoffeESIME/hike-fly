"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Map, LngLat, LngLatLike, MercatorCoordinate } from "mapbox-gl";
import * as THREE from "three";
import { PhotoMarker, Keyframe, ElevationPoint, StatisticsSettings } from "../types";
import { ThreeCustomLayer } from "../utils/ThreeCustomLayer";
import { lerp, lerpLngLat, computeCameraPosition, toggleMapInteractivity } from "../utils/mapUtils";
import { routePointAtDistance, summarizeProfile } from "../utils/gpxUtils";
import { statisticsAtDistance } from "../utils/statistics";
import { LERP_SMOOTHING_FACTOR, PHOTO_TRIGGER_DISTANCE_M } from "../constants/defaults";



export type UseAnimationReturn = {
  isAnimating: boolean;
  setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>;
  activeKeyframeIndex: number;
  currentDistanceRef: React.MutableRefObject<number>;
  animationStepRef: React.MutableRefObject<(timestamp: number) => void>;
  animationStartTimeRef: React.MutableRefObject<number | null>;
  totalPausedTimeRef: React.MutableRefObject<number>;
  pauseStartTimeRef: React.MutableRefObject<number>;
  manualPauseWallTimeRef: React.MutableRefObject<number>;
  previousSmoothedTargetRef: React.MutableRefObject<LngLatLike | null>;
  handleToggleAnimation: () => void;
  handleResetAnimation: () => void;
  handleCaptureKeyframe: () => void;
};

export function useAnimation(
  // Map state
  mapRef: React.MutableRefObject<Map | null>,
  threeLayerRef: React.MutableRefObject<ThreeCustomLayer | null>,
  isTerrainReady: boolean,
  statusMessage: string | null,
  setStatusMessage: (msg: string | null) => void,
  setError: (err: string | null) => void,
  // GPX state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gpxFeature: any | null,
  totalPathDistance: number,
  startBearing: number,
  elevationProfileRef: React.MutableRefObject<ElevationPoint[]>,
  statisticsSettings: StatisticsSettings,
  statsWidgetRef: React.MutableRefObject<HTMLDivElement | null>,
  // Photo slideshow (provided by useSlideshow)
  photos: PhotoMarker[],
  setPhotos: React.Dispatch<React.SetStateAction<PhotoMarker[]>>,
  isPausedForPhotoRef: React.MutableRefObject<boolean>,
  setActivePhoto: React.Dispatch<React.SetStateAction<PhotoMarker | null>>,
  setSlideshowQueue: React.Dispatch<React.SetStateAction<PhotoMarker[]>>,
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>,
  // Keyframes
  keyframes: Keyframe[],
  useKeyframes: boolean,
  setKeyframes: React.Dispatch<React.SetStateAction<Keyframe[]>>,
  setUseKeyframes: React.Dispatch<React.SetStateAction<boolean>>,
  // Camera settings
  cameraPitch: number,
  cameraAltitude: number,
  cameraRotation: number,
  animationDuration: number,
  // UI
  hideMenuOnStart: boolean,
  setIsMenuVisible: React.Dispatch<React.SetStateAction<boolean>>,
  onlyDistance: boolean,
  // Route complete callback
  onRouteComplete: () => void,
  elevationProgressRef: React.RefObject<((distance: number) => void) | null>,
): UseAnimationReturn {
  const [isAnimating,        setIsAnimating]        = useState(false);
  const [activeKeyframeIndex, setActiveKeyframeIndex] = useState(-1);

  // Timing refs
  const animationFrameRef         = useRef<number | null>(null);
  const animationStartTimeRef     = useRef<number | null>(null);
  const isAnimatingRef            = useRef<boolean>(false);
  const pauseStartTimeRef         = useRef<number>(0);
  const totalPausedTimeRef        = useRef<number>(0);
  const manualPauseWallTimeRef    = useRef<number>(0);
  const currentDistanceRef        = useRef<number>(0);
  const previousSmoothedTargetRef = useRef<LngLatLike | null>(null);

  // Always-fresh ref to the animationStep closure (avoids stale-closure bugs in rAF)
  const animationStepRef = useRef<(timestamp: number) => void>(() => { });

  const profile = elevationProfileRef.current;
  const summary = useMemo(() => summarizeProfile(profile), [profile]);
  const updateStatsWidget = useCallback((distance: number) => {
    elevationProgressRef.current?.(distance);
    const root = statsWidgetRef.current;
    if (!root) return;
    const items = statisticsAtDistance(profile, statisticsSettings, distance, false, summary);
    for (const item of items) {
      const node = root.querySelector('[data-stat="' + item.key + '"]');
      if (node && node.textContent !== item.value) node.textContent = item.value;
    }
  }, [profile, statisticsSettings, statsWidgetRef, summary, elevationProgressRef]);

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
    [mapRef]
  );

  const animationStep = useCallback(
    (timestamp: number) => {
      if (!isAnimatingRef.current || !gpxFeature || !mapRef.current || !isTerrainReady) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        return;
      }

      // Handle photo pause
      if (isPausedForPhotoRef.current) {
        if (pauseStartTimeRef.current === 0) {
          pauseStartTimeRef.current = timestamp;
        }
        // Use animationStepRef.current to always have fresh state (avoids stale-closure re-trigger)
        animationFrameRef.current = requestAnimationFrame((ts) => animationStepRef.current(ts));
        return;
      }

      // Accumulate time spent paused for photos
      if (pauseStartTimeRef.current > 0) {
        totalPausedTimeRef.current += timestamp - pauseStartTimeRef.current;
        pauseStartTimeRef.current = 0;
      }

      const map = mapRef.current;

      if (animationStartTimeRef.current === null) {
        animationStartTimeRef.current = timestamp;
      }

      const elapsedTime    = timestamp - animationStartTimeRef.current - totalPausedTimeRef.current;
      let animationPhase   = elapsedTime / (animationDuration * 1000);
      if (animationPhase >= 1.0) animationPhase = 1.0;

      // A separate layer per GPX segment avoids drawing unrecorded gaps.
      try {
        gpxFeature.properties.segmentStarts.forEach((start: number, i: number, starts: number[]) => {
          const a = profile[start].dist;
          const b = profile[(starts[i + 1] ?? profile.length) - 1].dist;
          const progress = Math.max(0, Math.min(1, b > a ? (totalPathDistance * animationPhase - a) / (b - a) : 1));
          map.setPaintProperty("route-segment-" + i, "line-gradient", [
            "step", ["line-progress"], "yellow", progress, "rgba(0,0,0,0)",
          ]);
        });
      } catch { /* route layers may not be ready */ }

      const distanceAlongPath = totalPathDistance * animationPhase;
      currentDistanceRef.current = distanceAlongPath;

      const safeDistance      = Math.max(0, Math.min(distanceAlongPath, totalPathDistance));
      const exactTargetFeature = routePointAtDistance(elevationProfileRef.current, safeDistance);
      const exactTargetCoords  = exactTargetFeature.geometry.coordinates as LngLatLike;

      // Photo trigger check
      const photosToShow = photos.filter((p) =>
        p.enabled && !p.shown &&
        Math.abs(p.distanceAlongPath - distanceAlongPath) < PHOTO_TRIGGER_DISTANCE_M
      );

      if (photosToShow.length > 0) {
        console.log("Starting slideshow with:", photosToShow.length, "photos");
        isPausedForPhotoRef.current = true;
        setSlideshowQueue(photosToShow);
        setCurrentSlideIndex(0);
        setActivePhoto(photosToShow[0]);
        const idsToShow = new Set(photosToShow.map((p) => p.id));
        setPhotos((prev) => prev.map((p) => (idsToShow.has(p.id) ? { ...p, shown: true } : p)));
        // Use ref here (not direct closure) to avoid stale-closure re-trigger on resume
        animationFrameRef.current = requestAnimationFrame((ts) => animationStepRef.current(ts));
        return;
      }

      // Smooth camera target
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
        map.queryTerrainElevation(smoothedTargetCoords, { exaggerated: true }) ?? 0;

      // Stats widget (direct DOM update — avoids React re-render on every frame)
      updateStatsWidget(distanceAlongPath);

      // Camera logic — keyframes or eagle-view
      if (useKeyframes && keyframes.length > 1) {
        let prevKf = keyframes[0];
        let nextKf = keyframes[keyframes.length - 1];
        let activePrevIdx = 0;

        for (let i = 0; i < keyframes.length - 1; i++) {
          if (keyframes[i].distance <= distanceAlongPath && keyframes[i + 1].distance > distanceAlongPath) {
            prevKf = keyframes[i];
            nextKf = keyframes[i + 1];
            activePrevIdx = i;
            break;
          }
        }
        setActiveKeyframeIndex(activePrevIdx);

        if (distanceAlongPath < keyframes[0].distance) { prevKf = nextKf = keyframes[0]; }
        if (distanceAlongPath > keyframes[keyframes.length - 1].distance) {
          prevKf = nextKf = keyframes[keyframes.length - 1];
        }

        let t = 0;
        const distDiff = nextKf.distance - prevKf.distance;
        if (distDiff > 0) t = (distanceAlongPath - prevKf.distance) / distDiff;
        t = Math.max(0, Math.min(1, t));

        const x = lerp(prevKf.position.x, nextKf.position.x, t);
        const y = lerp(prevKf.position.y, nextKf.position.y, t);
        const z = lerp(prevKf.position.z, nextKf.position.z, t);
        const newPos = new MercatorCoordinate(x, y, z);

        const qA = new THREE.Quaternion(...prevKf.orientation);
        const qB = new THREE.Quaternion(...nextKf.orientation);
        qA.slerp(qB, t);

        const newCamera = map.getFreeCameraOptions();
        newCamera.position = newPos;
        newCamera.orientation = [qA.x, qA.y, qA.z, qA.w];
        map.setFreeCameraOptions(newCamera);
      } else {
        // Eagle-view mode
        const camAlt        = targetElevation + cameraAltitude;
        const currentBearing = startBearing - animationPhase * cameraRotation;
        const cameraLngLat  = computeCameraPosition(cameraPitch, currentBearing, smoothedTargetCoords, cameraAltitude);
        updateCamera(cameraLngLat, camAlt, smoothedTargetCoords);
      }

      // 3D model position
      if (threeLayerRef.current) {
        const tCoords       = LngLat.convert(smoothedTargetCoords);

        const modelElevation =
          map.queryTerrainElevation(smoothedTargetCoords, { exaggerated: true }) ?? targetElevation;

        threeLayerRef.current.updatePosition(tCoords.lng, tCoords.lat, modelElevation);
      }

      // Continue or finish
      if (animationPhase < 1.0) {
        animationFrameRef.current = requestAnimationFrame((ts) => animationStepRef.current(ts));
      } else {
        animationFrameRef.current         = null;
        animationStartTimeRef.current     = null;
        previousSmoothedTargetRef.current = null;
        setIsAnimating(false);
        toggleMapInteractivity(map, true);

        setStatusMessage("Animación completada.");
        setIsMenuVisible(true);
        onRouteComplete();
      }
    },
    [
      gpxFeature, totalPathDistance, animationDuration, startBearing,
      isTerrainReady, updateCamera, photos, keyframes, useKeyframes,
      cameraPitch, cameraAltitude, cameraRotation,
      mapRef, threeLayerRef, isPausedForPhotoRef,
      setPhotos, setActivePhoto, setSlideshowQueue, setCurrentSlideIndex,
      setIsAnimating, setStatusMessage, setIsMenuVisible, onRouteComplete,
      updateStatsWidget, profile, elevationProfileRef,
    ]
  );

  useEffect(() => {
    currentDistanceRef.current = 0;
    animationStartTimeRef.current = null;
    totalPausedTimeRef.current = 0;
    pauseStartTimeRef.current = 0;
    manualPauseWallTimeRef.current = 0;
    previousSmoothedTargetRef.current = null;
  }, [gpxFeature]);

  // Keep stats widget synchronized when onlyDistance or route changes
  useEffect(() => {
    if (gpxFeature) {
      updateStatsWidget(currentDistanceRef.current);
    }
  }, [gpxFeature, onlyDistance, updateStatsWidget]);

  // Keep animationStepRef fresh so the rAF loop always has the latest closure
  useEffect(() => {
    animationStepRef.current = animationStep;
  }, [animationStep]);

  // Start / pause / stop the animation rAF loop
  useEffect(() => {
    const currentMap = mapRef.current;
    isAnimatingRef.current = isAnimating;

    if (isAnimating) {
      if (!gpxFeature || !isTerrainReady) {
        setError("Carga una ruta y espera a que el terreno esté listo.");
        setIsAnimating(false);
        return;
      }
      setStatusMessage("Animación en curso...");
      if (mapRef.current) toggleMapInteractivity(mapRef.current, false);

      // Resume accounting
      if (manualPauseWallTimeRef.current > 0 && animationStartTimeRef.current !== null) {
        const pausedWallMs = performance.now() - manualPauseWallTimeRef.current;
        totalPausedTimeRef.current += pausedWallMs;
        console.log(`[Resume] pausedWallMs=${pausedWallMs.toFixed(0)}ms`);
        manualPauseWallTimeRef.current = 0;
      } else {
        console.log(`[Start] Fresh start. animStart=${animationStartTimeRef.current}`);
      }

      // Full reset only on fresh start
      if (animationStartTimeRef.current === null) {
        totalPausedTimeRef.current     = 0;
        pauseStartTimeRef.current      = 0;
        isPausedForPhotoRef.current    = false;
        manualPauseWallTimeRef.current = 0;
        setPhotos((prev) => prev.map((p) => ({ ...p, shown: false })));
      }

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame((ts) => animationStepRef.current(ts));
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Record pause wall-time only once
      if (animationStartTimeRef.current !== null && manualPauseWallTimeRef.current === 0) {
        manualPauseWallTimeRef.current = performance.now();
        console.log(`[Pause] wall=${manualPauseWallTimeRef.current.toFixed(0)} | dist=${currentDistanceRef.current.toFixed(1)}m`);
      } else if (animationStartTimeRef.current !== null) {
        console.log(`[Pause re-run] NOT overwriting manualPauseWall (${manualPauseWallTimeRef.current.toFixed(0)})`);
      }
      if (mapRef.current) toggleMapInteractivity(mapRef.current, true);
      if (statusMessage === "Animación en curso...") setStatusMessage("Animación pausada.");
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (currentMap) toggleMapInteractivity(currentMap, true);
    };
  }, [isAnimating, gpxFeature, isTerrainReady, statusMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Public actions
  // -------------------------------------------------------------------------

  const handleToggleAnimation = () => {
    if (!gpxFeature) { setError("Primero carga una ruta GPX."); return; }
    if (!isTerrainReady) { setError("Espera a que el terreno termine de cargar."); return; }
    setError(null);
    setIsAnimating((prev) => {
      const next = !prev;
      if (next && hideMenuOnStart) setIsMenuVisible(false);
      return next;
    });
  };

  const handleResetAnimation = () => {
    setError(null);
    setIsAnimating(false);
    animationStartTimeRef.current     = null;
    previousSmoothedTargetRef.current = null;
    totalPausedTimeRef.current        = 0;
    pauseStartTimeRef.current         = 0;
    isPausedForPhotoRef.current       = false;
    currentDistanceRef.current        = 0;
    manualPauseWallTimeRef.current    = 0;
    updateStatsWidget(0);
    setStatusMessage("Animación reiniciada.");

    const map = mapRef.current;
    if (map) {
      try {
        gpxFeature?.properties.segmentStarts.forEach((_: number, i: number) => map.setPaintProperty("route-segment-" + i, "line-gradient", [
          "step", ["line-progress"], "yellow", 0, "rgba(0,0,0,0)",
        ]));
      } catch { /* ignore */ }

      if (gpxFeature?.geometry?.coordinates?.length) {
        const startCoords = gpxFeature.geometry.coordinates[0];
        map.flyTo({
          center: startCoords as [number, number],
          zoom: 15,
          pitch: cameraPitch,
          bearing: startBearing,
          duration: 1500,
        });
      }
    }
  };

  const handleCaptureKeyframe = () => {
    const map = mapRef.current;
    if (!map) return;
    const camera = map.getFreeCameraOptions();
    if (!camera.position || !camera.orientation) return;

    const dist = currentDistanceRef.current;
    console.log(`[Keyframe] Capturing at dist=${dist.toFixed(1)}m`);

    const newKeyframe: Keyframe = {
      distance: dist,
      position: camera.position,
      orientation: camera.orientation as [number, number, number, number],
    };

    setKeyframes((prev) => {
      const newFrames = [...prev, newKeyframe].sort((a, b) => a.distance - b.distance);
      if (newFrames.length >= 2) setUseKeyframes(true);
      return newFrames;
    });
  };

  return {
    isAnimating,
    setIsAnimating,
    activeKeyframeIndex,
    currentDistanceRef,
    animationStepRef,
    animationStartTimeRef,
    totalPausedTimeRef,
    pauseStartTimeRef,
    manualPauseWallTimeRef,
    previousSmoothedTargetRef,
    handleToggleAnimation,
    handleResetAnimation,
    handleCaptureKeyframe,
  };
}
