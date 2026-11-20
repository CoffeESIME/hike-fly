export type CameraPreset = "classic" | "sweep" | "panorama";

// Ease in and out of each camera move, holding the shot outside its interval.
function transition(progress: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (progress - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export function cameraPoseAtProgress(
  preset: CameraPreset, progress: number, startBearing: number,
  pitch: number, altitude: number, rotation: number,
) {
  if (preset === "sweep") {
    const sweep = transition(progress, 0.15, 0.45) - transition(progress, 0.60, 0.90);
    return { bearing: startBearing - 45 + 90 * sweep, pitch, altitude };
  }

  if (preset === "panorama") {
    const rise = transition(progress, 0.10, 0.45) - transition(progress, 0.65, 0.98);
    return {
      bearing: startBearing + 110 * transition(progress, 0.20, 0.85),
      pitch: pitch * (1 - 0.45 * rise),
      altitude: altitude * (0.85 + 1.15 * rise),
    };
  }

  return { bearing: startBearing - progress * rotation, pitch, altitude };
}
