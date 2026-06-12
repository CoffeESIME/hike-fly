"use client";
import React, { useEffect, useState } from "react";

type Props = {
  totalDistanceKm: number;
  totalElevationGain: number;
  maxAltitude: number;
  minAltitude: number;
  onClose: () => void;
};

/**
 * Full-screen cinematic overlay shown at the end of the route flyby.
 * Fades in, shows route stats, and lets the user dismiss it.
 */
export function RouteCompleteOverlay({
  totalDistanceKm,
  totalElevationGain,
  maxAltitude,
  minAltitude,
  onClose,
}: Props) {
  const [visible, setVisible] = useState(false);

  // Trigger entrance animation on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 400);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: visible ? "auto" : "none",
        background: visible
          ? "rgba(0,0,0,0.55)"
          : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        transition: "background 0.6s ease, backdrop-filter 0.6s ease",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "linear-gradient(145deg, rgba(10,10,20,0.97) 0%, rgba(20,25,45,0.97) 100%)",
          border: "1px solid rgba(0,198,255,0.25)",
          borderRadius: "20px",
          padding: "40px 50px",
          maxWidth: "480px",
          width: "90%",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,198,255,0.08), inset 0 1px 0 rgba(255,255,255,0.07)",
          textAlign: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
          transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.175,0.885,0.32,1.275)",
          pointerEvents: "auto",
          fontFamily: "'Inter', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trophy icon */}
        <div
          style={{
            fontSize: "3.5rem",
            marginBottom: "12px",
            animation: visible ? "trophyBounce 0.6s 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both" : "none",
          }}
        >
          🏔️
        </div>

        {/* Title */}
        <h2
          style={{
            margin: "0 0 6px 0",
            fontSize: "1.7rem",
            fontWeight: "800",
            background: "linear-gradient(90deg, #00c6ff, #0070f3)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}
        >
          ¡Ruta completada!
        </h2>
        <p
          style={{
            margin: "0 0 32px 0",
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.04em",
          }}
        >
          Vista panorámica del recorrido
        </p>

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "36px",
          }}
        >
          <StatCard
            icon="📏"
            label="Distancia"
            value={totalDistanceKm.toFixed(2)}
            unit="km"
            visible={visible}
            delay="0.1s"
          />
          <StatCard
            icon="⛰️"
            label="Desnivel +"
            value={Math.round(totalElevationGain).toString()}
            unit="m"
            visible={visible}
            delay="0.18s"
          />
          <StatCard
            icon="🔺"
            label="Altitud Máx"
            value={Math.round(maxAltitude).toString()}
            unit="m"
            visible={visible}
            delay="0.26s"
          />
          <StatCard
            icon="🔻"
            label="Altitud Mín"
            value={Math.round(minAltitude).toString()}
            unit="m"
            visible={visible}
            delay="0.34s"
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            padding: "12px 36px",
            background: "linear-gradient(135deg, #0070f3, #00c6ff)",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontSize: "0.9rem",
            fontWeight: "700",
            cursor: "pointer",
            letterSpacing: "0.04em",
            boxShadow: "0 6px 24px rgba(0,112,243,0.4)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,112,243,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,112,243,0.4)";
          }}
        >
          Ver mapa completo
        </button>

        <p style={{ margin: "12px 0 0 0", fontSize: "0.7rem", color: "rgba(255,255,255,0.2)" }}>
          Haz clic en cualquier lugar para cerrar
        </p>
      </div>

      <style>{`
        @keyframes trophyBounce {
          from { opacity: 0; transform: scale(0.4) rotate(-15deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: individual stat card
// ---------------------------------------------------------------------------
function StatCard({
  icon,
  label,
  value,
  unit,
  visible,
  delay,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  visible: boolean;
  delay: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        padding: "14px 10px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 0.4s ${delay} ease, transform 0.4s ${delay} ease`,
      }}
    >
      <div style={{ fontSize: "1.4rem", marginBottom: "6px" }}>{icon}</div>
      <div
        style={{
          fontSize: "1.25rem",
          fontWeight: "800",
          color: "#fff",
          lineHeight: 1.1,
          whiteSpace: "nowrap",
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", marginLeft: "3px" }}>
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: "0.65rem",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: "3px",
        }}
      >
        {label}
      </div>
    </div>
  );
}
