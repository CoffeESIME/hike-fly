"use client";
import React from "react";
import { PhotoMarker } from "../types";

type Props = {
  photo: PhotoMarker;
  onClose: () => void;
  onAdvance?: () => void;
};

/**
 * Fullscreen overlay that shows the active photo during the slideshow.
 * Clicking the backdrop or the × button calls `onClose`.
 * The animated progress bar reflects the 3-second auto-advance timer.
 */
export function PhotoOverlay({ photo, onClose, onAdvance }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0, left: 0, width: "100%", height: "100%",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        animation: "modalFadeIn 0.4s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: "min(85%, 700px)",
          background: "rgba(15,15,15,0.95)",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1rem" }}>📍</span>
            <span style={{ color: "#ccc", fontSize: "0.85rem", fontWeight: "600", fontFamily: "'Inter', sans-serif" }}>
              Punto km {(photo.distanceAlongPath / 1000).toFixed(2)}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1.3rem", lineHeight: 1 }}
          >×</button>
        </div>

        {/* Media */}
        {photo.mediaType === "video" ? (
          <video
            src={photo.url}
            autoPlay
            playsInline
            controls
            onEnded={() => onAdvance && onAdvance()}
            style={{ width: "100%", maxHeight: "65vh", display: "block", background: "#000" }}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo.url}
            alt="Punto de ruta"
            style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", display: "block", background: "#000" }}
          />
        )}

        {/* Countdown bar (only for images since videos have their own controls/duration) */}
        {photo.mediaType !== "video" && (
          <div style={{ height: "3px", background: "rgba(255,255,255,0.1)" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #0070f3, #00c6ff)", width: "0%", animation: "photoCountdown 3s linear forwards" }} />
          </div>
        )}
      </div>

      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: "14px", fontFamily: "'Inter', sans-serif" }}>
        {photo.mediaType === "video" ? "Reproduciendo video — clic en la X o fuera para cerrar" : "Continuando en 3 seg — clic para cerrar"}
      </p>
    </div>
  );
}
