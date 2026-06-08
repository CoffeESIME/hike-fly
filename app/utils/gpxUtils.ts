import * as GeoJSON from "geojson";
import * as turf from "@turf/turf";
import { ElevationPoint } from "../types";

const { lineString, length: turfLength } = turf;

// ---------------------------------------------------------------------------
// GPX feature extraction
// ---------------------------------------------------------------------------

/**
 * Extracts and merges all LineString / MultiLineString segments from a
 * GeoJSON FeatureCollection (as produced by @tmcw/togeojson).
 *
 * Returns the merged LineString feature, or throws if no valid geometry is found.
 */
export function parseGpxFeatureCollection(
  data: GeoJSON.FeatureCollection
): GeoJSON.Feature<GeoJSON.LineString> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lineFeature: any = null;
  const mergedCoords: GeoJSON.Position[] = [];

  data.features.forEach((feature) => {
    if (feature.geometry.type === "LineString") {
      if (!lineFeature) {
        lineFeature = feature as GeoJSON.Feature<GeoJSON.LineString>;
      }
      mergedCoords.push(...(feature.geometry as GeoJSON.LineString).coordinates);
    } else if (feature.geometry.type === "MultiLineString") {
      (feature.geometry as GeoJSON.MultiLineString).coordinates.forEach((line) => {
        mergedCoords.push(...line);
      });
    }
  });

  if (!lineFeature && mergedCoords.length >= 2) {
    lineFeature = lineString(mergedCoords);
  } else if (lineFeature && mergedCoords.length > lineFeature.geometry.coordinates.length) {
    lineFeature = lineString(mergedCoords);
  }

  if (!lineFeature || lineFeature.geometry.coordinates.length < 2) {
    throw new Error("No se encontró una LineString válida con al menos 2 puntos.");
  }

  return lineFeature;
}

// ---------------------------------------------------------------------------
// Elevation helpers
// ---------------------------------------------------------------------------

/**
 * Calculates total positive elevation gain (meters) from a LineString feature.
 * Requires the third coordinate element [lng, lat, elevation].
 */
export function calculateElevationGain(
  geojson: GeoJSON.Feature<GeoJSON.LineString>
): number {
  let gain = 0;
  const coords = geojson.geometry.coordinates;
  for (let i = 1; i < coords.length; i++) {
    const diff = (coords[i][2] ?? 0) - (coords[i - 1][2] ?? 0);
    if (diff > 0) gain += diff;
  }
  return gain;
}

/**
 * Builds a dense elevation profile array from a LineString feature.
 * Each entry has the cumulative distance (m) from the start and the elevation (m).
 */
export function buildElevationProfile(
  geojson: GeoJSON.Feature<GeoJSON.LineString>
): ElevationPoint[] {
  const coords = geojson.geometry.coordinates;
  const profile: ElevationPoint[] = [];
  let cumDist = 0;

  for (let i = 0; i < coords.length; i++) {
    if (i > 0) {
      const segFeature = lineString([coords[i - 1], coords[i]]);
      cumDist += turfLength(segFeature, { units: "meters" });
    }
    profile.push({ dist: cumDist, ele: coords[i][2] ?? 0 });
  }

  return profile;
}

/**
 * Returns the interpolated elevation at the given distance along the profile.
 * Uses binary search for O(log n) performance.
 */
export function getElevationAtDistance(
  profile: ElevationPoint[],
  targetDist: number
): number {
  if (profile.length === 0) return 0;
  if (targetDist <= 0) return profile[0].ele;
  if (targetDist >= profile[profile.length - 1].dist) return profile[profile.length - 1].ele;

  let low = 0;
  let high = profile.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (profile[mid].dist < targetDist) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const p1 = profile[low - 1];
  const p2 = profile[low];

  if (!p1) return p2.ele;
  if (!p2) return p1.ele;

  const t = (targetDist - p1.dist) / (p2.dist - p1.dist);
  return p1.ele + (p2.ele - p1.ele) * t;
}
