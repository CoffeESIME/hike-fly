"use client";
import React from "react";
import { PhotoMarker } from "../types";

type Props = {
  photo: PhotoMarker;
  onClose: () => void;
  onAdvance?: () => void;
};

/**
 * Fullscreen overlay that shows the active photo/video during the slideshow.
 *
 * - Videos: near-fullscreen layout so the content is maximally visible.
 *   A translucent floating header sits at the top; the video fills remaining space.
 * - Images: compact centred card (unchanged look).
 *
 * Clicking the backdrop or the × button calls `onClose`.
 */
export function PhotoOverlay({ photo, onClose, onAdvance }: Props) {
  const isVideo = photo.mediaType === "video";

  /* ── VIDEO layout ──────────────────────────────────────────────────────── */
  if (isVideo) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background: "rgba(0,0,0,0.92)",
          backdropFilter: "blur(6px)",
          display: "flex",
          flexDirection: "column",
          animation: "modalFadeIn 0.35s ease",
        }}
        onClick={onClose}
      >
        {/* Floating header bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.1rem" }}>🎬</span>
            <span
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: "0.85rem",
                fontWeight: "600",
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              Punto km {(photo.distanceAlongPath / 1000).toFixed(2)}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.22)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
          >
            ×
          </button>
        </div>

        {/* Video — fills all available space */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <video
            src={photo.url}
            autoPlay
            playsInline
            controls
            onEnded={() => onAdvance && onAdvance()}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              background: "#000",
            }}
          />
        </div>

        {/* Hint */}
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.3)",
            fontSize: "0.7rem",
            fontFamily: "'Inter', sans-serif",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Clic fuera del video para cerrar
        </div>
      </div>
    );
  }

  /* ── IMAGE layout (fullscreen, like video) ────────────────────────────── */
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(6px)",
        display: "flex",
        flexDirection: "column",
        animation: "modalFadeIn 0.35s ease",
      }}
      onClick={onClose}
    >
      {/* Floating header bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.1rem" }}>📍</span>
          <span
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: "0.85rem",
              fontWeight: "600",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.02em",
            }}
          >
            Punto km {(photo.distanceAlongPath / 1000).toFixed(2)}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "1.1rem",
            lineHeight: 1,
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.22)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
        >
          ×
        </button>
      </div>

      {/* Image — fills all available space */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt="Punto de ruta"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            background: "#000",
          }}
        />
      </div>

      {/* Countdown bar at the very bottom */}
      <div
        style={{ height: "3px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #0070f3, #00c6ff)",
            width: "0%",
            animation: "photoCountdown 3s linear forwards",
          }}
        />
      </div>

      {/* Hint */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.3)",
          fontSize: "0.7rem",
          fontFamily: "'Inter', sans-serif",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        Continuando en 3 seg — clic para cerrar
      </div>
    </div>
  );
}

