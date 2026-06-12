import { LngLat, LngLatLike, Map } from "mapbox-gl";

// ---------------------------------------------------------------------------
// Numeric / coordinate helpers
// ---------------------------------------------------------------------------

/** Linear interpolation between two numbers. */
export const lerp = (start: number, end: number, amt: number): number =>
  (1 - amt) * start + amt * end;

/** Linear interpolation between two LngLat-compatible values. */
export const lerpLngLat = (
  start: LngLatLike,
  end: LngLatLike,
  amt: number
): LngLatLike => {
  const startArr = LngLat.convert(start).toArray();
  const endArr = LngLat.convert(end).toArray();
  return [lerp(startArr[0], endArr[0], amt), lerp(startArr[1], endArr[1], amt)];
};

// ---------------------------------------------------------------------------
// Camera math
// ---------------------------------------------------------------------------

/**
 * Given the camera pitch, bearing, a target LngLat and an altitude above terrain,
 * returns the LngLat the camera should be placed at so it looks toward the target
 * at the requested pitch angle.
 */
export const computeCameraPosition = (
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

// ---------------------------------------------------------------------------
// Map interaction
// ---------------------------------------------------------------------------

/** Enable or disable all default Mapbox map interactions. */
export const toggleMapInteractivity = (map: Map | null, enable: boolean): void => {
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
