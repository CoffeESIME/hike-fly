"use client";
import { useState } from "react";
import mapboxgl from "mapbox-gl";
import {
  DEFAULT_CAMERA_PITCH,
  DEFAULT_CAMERA_ALTITUDE,
  DEFAULT_TERRAIN_EXAGGERATION,
  DEFAULT_ANIMATION_DURATION,
  DEFAULT_CAMERA_ROTATION,
} from "../constants/defaults";

export type CameraSettingsState = {
  cameraPitch: number;
  setCameraPitch: (v: number) => void;
  cameraAltitude: number;
  setCameraAltitude: (v: number) => void;
  cameraRotation: number;
  setCameraRotation: (v: number) => void;
  animationDuration: number;
  setAnimationDuration: (v: number) => void;
  terrainExaggeration: number;
  /** Updates terrainExaggeration state AND live-updates the Mapbox terrain source. */
  setTerrainExaggeration: (v: number, mapRef: React.RefObject<mapboxgl.Map | null>) => void;
};

/**
 * Manages all user-adjustable camera and terrain parameters.
 * `setTerrainExaggeration` also updates the live Mapbox terrain source when a
 * map reference is provided.
 */
export function useCameraSettings(): CameraSettingsState {
  const [cameraPitch, setCameraPitch] = useState(DEFAULT_CAMERA_PITCH);
  const [cameraAltitude, setCameraAltitude] = useState(DEFAULT_CAMERA_ALTITUDE);
  const [cameraRotation, setCameraRotation] = useState(DEFAULT_CAMERA_ROTATION);
  const [animationDuration, setAnimationDuration] = useState(DEFAULT_ANIMATION_DURATION);
  const [terrainExaggeration, setTerrainExaggerationState] = useState(DEFAULT_TERRAIN_EXAGGERATION);

  const setTerrainExaggeration = (
    v: number,
    mapRef: React.RefObject<mapboxgl.Map | null>
  ) => {
    setTerrainExaggerationState(v);
    if (mapRef.current) {
      mapRef.current.setTerrain({ source: "mapbox-dem", exaggeration: v });
    }
  };

  return {
    cameraPitch,
    setCameraPitch,
    cameraAltitude,
    setCameraAltitude,
    cameraRotation,
    setCameraRotation,
    animationDuration,
    setAnimationDuration,
    terrainExaggeration,
    setTerrainExaggeration,
  };
}
