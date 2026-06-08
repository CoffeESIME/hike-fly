"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { PhotoMarker } from "../types";
import { buildPhotoMarkerElement } from "../utils/photoUtils";

/**
 * Keeps a set of Mapbox Markers in sync with the `photos` state array.
 *
 * The dependency key is derived from only the fields that affect marker appearance
 * (id, coordinate, enabled) — NOT `shown`. This prevents the marker rebuild from
 * firing on every animation frame that marks a photo as shown, which would cause a
 * cascading render loop.
 */
export function usePhotoMarkers(
  photos: PhotoMarker[],
  mapRef: React.MutableRefObject<mapboxgl.Map | null>
): void {
  const photoMapMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // Stable key: rebuild markers only when something visually relevant changes
  const photoMarkerKey = photos
    .map((p) => `${p.id}:${p.coordinate[0]},${p.coordinate[1]}:${p.enabled}`)
    .join("|");

  useEffect(() => {
    if (!mapRef.current) return;

    // Remove all existing markers
    photoMapMarkersRef.current.forEach((m) => m.remove());
    photoMapMarkersRef.current = [];

    photos.forEach((photo) => {
      if (!photo.enabled) return;

      const kmLabel = (photo.distanceAlongPath / 1000).toFixed(2);
      const el = buildPhotoMarkerElement(kmLabel);

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(photo.coordinate)
        .addTo(mapRef.current!);

      photoMapMarkersRef.current.push(marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoMarkerKey]);
}
