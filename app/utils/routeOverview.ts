import type { Map } from "mapbox-gl";

/** Open the summary only after this camera transition has actually finished. */
export function playRouteOverview(map: Map, coordinates: number[][], onComplete: () => void) {
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of coordinates) {
    bounds[0] = Math.min(bounds[0], lng);
    bounds[1] = Math.min(bounds[1], lat);
    bounds[2] = Math.max(bounds[2], lng);
    bounds[3] = Math.max(bounds[3], lat);
  }
  const transition = {};
  let active = true;
  const cancel = () => {
    active = false;
    map.off("moveend", finish);
  };
  const finish = (event: { type: string; routeOverview?: object }) => {
    if (!active || event.routeOverview !== transition) return;
    cancel();
    onComplete();
  };

  map.stop();
  map.on("moveend", finish);
  const { clientWidth, clientHeight } = map.getContainer();
  try {
    map.fitBounds(bounds, {
      padding: Math.min(100, clientWidth * 0.12, clientHeight * 0.12),
      pitch: 0,
      bearing: 0,
      maxZoom: 16,
      duration: 3500,
      retainPadding: false,
    }, { routeOverview: transition });
  } catch (error) {
    cancel();
    throw error;
  }
  return cancel;
}
