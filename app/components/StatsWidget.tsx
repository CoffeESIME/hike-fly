"use client";
import React from "react";

type Props = {
  /** Ref forwarded to the DOM node so the animation loop can update innerHTML directly. */
  statsRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Floating stats widget rendered over the map (bottom-center).
 * Its content is updated via direct DOM manipulation (`statsRef.current.innerHTML`)
 * inside the animation loop to avoid triggering React re-renders on every frame.
 */
export function StatsWidget({ statsRef }: Props) {
  return (
    <div
      ref={statsRef}
      style={{
        position: "absolute",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "30px",
        background: "rgba(20, 20, 20, 0.85)",
        backdropFilter: "blur(8px)",
        padding: "15px 30px",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
        zIndex: 10,
        pointerEvents: "none",
        fontFamily: "'Inter', sans-serif",
        opacity: 1,
        transition: "opacity 0.3s ease",
      }}
    />
  );
}
