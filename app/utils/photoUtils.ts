/**
 * Builds the DOM element used as a custom Mapbox Marker for photo waypoints.
 *
 * Returns the root `div` element (pill + stem). The caller is responsible for
 * creating the `mapboxgl.Marker` and calling `.addTo(map)`.
 *
 * @param kmLabel  The distance label to display (e.g. "2.45")
 */
export function buildPhotoMarkerElement(kmLabel: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    pointer-events: auto;
  `;

  const pill = document.createElement("div");
  pill.style.cssText = `
    background: rgba(10, 10, 20, 0.82);
    backdrop-filter: blur(6px);
    border: 1.5px solid rgba(0,198,255,0.55);
    border-radius: 20px;
    padding: 4px 10px 4px 7px;
    display: flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,198,255,0.12);
    white-space: nowrap;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  `;
  pill.innerHTML = `
    <span style="font-size:14px;line-height:1">📷</span>
    <span style="color:#00c6ff;font-size:0.72rem;font-weight:700;font-family:'Inter',sans-serif">km ${kmLabel}</span>
  `;

  // Slim stem connecting the pill to the map coordinate
  const stem = document.createElement("div");
  stem.style.cssText = `
    width: 2px;
    height: 10px;
    background: rgba(0,198,255,0.5);
    border-radius: 1px;
  `;

  // Hover highlight
  pill.addEventListener("mouseenter", () => {
    pill.style.transform = "scale(1.08)";
    pill.style.boxShadow = "0 6px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,198,255,0.4)";
  });
  pill.addEventListener("mouseleave", () => {
    pill.style.transform = "scale(1)";
    pill.style.boxShadow = "0 4px 16px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,198,255,0.12)";
  });

  el.appendChild(pill);
  el.appendChild(stem);
  return el;
}
