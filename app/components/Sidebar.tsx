"use client";
import React, { useState } from "react";
import { PhotoMarker, Keyframe } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SliderConfig = {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  tip: string;
};

type Props = {
  // Visibility
  isMenuVisible: boolean;
  setIsMenuVisible: React.Dispatch<React.SetStateAction<boolean>>;
  hideWhileRouteComplete?: boolean;
  // Status
  error: string | null;
  statusMessage: string | null;
  isLoading: boolean;
  isAnimating: boolean;
  // GPX
  gpxFeature: unknown;
  isTerrainReady: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLoadDefaultGpx: () => void;
  // Photos
  photos: PhotoMarker[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoMarker[]>>;
  currentDistanceKm: number;
  handleAddPhoto: (e: React.ChangeEvent<HTMLInputElement>, distanceOverride?: number) => void;
  // Playback
  handleToggleAnimation: () => void;
  handleResetAnimation: () => void;
  // Camera sliders
  sliders: SliderConfig[];
  // Keyframes
  keyframes: Keyframe[];
  setKeyframes: React.Dispatch<React.SetStateAction<Keyframe[]>>;
  useKeyframes: boolean;
  setUseKeyframes: React.Dispatch<React.SetStateAction<boolean>>;
  activeKeyframeIndex: number;
  setActiveKeyframeIndex: React.Dispatch<React.SetStateAction<number>>;
  handleCaptureKeyframe: () => void;
  // Options
  hideMenuOnStart: boolean;
  setHideMenuOnStart: React.Dispatch<React.SetStateAction<boolean>>;
  // Avatar
  avatarUrl: string | null;
  setAvatarUrl: React.Dispatch<React.SetStateAction<string | null>>;
  // Model
  customModelUrl: string | null;
  handleModelChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  modelType: "mixtli" | "corvid" | "custom";
  handleModelTypeChange: (type: "mixtli" | "corvid" | "custom") => void;
};

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------
export function Sidebar({
  isMenuVisible, setIsMenuVisible,
  hideWhileRouteComplete = false,
  error, statusMessage, isLoading, isAnimating,
  gpxFeature, isTerrainReady, handleFileChange, handleLoadDefaultGpx,
  photos, setPhotos, currentDistanceKm, handleAddPhoto,
  handleToggleAnimation, handleResetAnimation,
  sliders,
  keyframes, setKeyframes, useKeyframes, setUseKeyframes,
  activeKeyframeIndex, setActiveKeyframeIndex,
  handleCaptureKeyframe,
  hideMenuOnStart, setHideMenuOnStart,
  avatarUrl, setAvatarUrl,
  customModelUrl, handleModelChange,
  modelType, handleModelTypeChange,
}: Props) {
  const [showInfo, setShowInfo] = useState(false);

  // The sidebar is suppressed while the route-complete modal is shown
  const panelVisible = isMenuVisible && !hideWhileRouteComplete;
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Main sidebar panel                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display: panelVisible ? "block" : "none",
          position: "absolute",
          top: "20px",
          left: "20px",
          width: "320px",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: "rgba(20, 20, 20, 0.95)",
          backdropFilter: "blur(10px)",
          borderRadius: "12px",
          padding: "20px",
          color: "#ffffff",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          zIndex: 10,
          border: "1px solid rgba(255, 255, 255, 0.1)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Title */}
        <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 20px 0", fontSize: "1.5rem", fontWeight: "700" }}>
          <span style={{ background: "linear-gradient(45deg, #0070f3, #00c6ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FlyBy 3D</span>
          <button onClick={() => setShowInfo(true)} style={{ background: "transparent", border: "none", color: "#ccc", fontSize: "1.2rem", cursor: "pointer" }} title="Información">ℹ️</button>
        </h2>

        {/* Info Modal */}
        {showInfo && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Inter', sans-serif"
          }}>
            <div style={{
              background: "#1a1a1a",
              padding: "20px",
              borderRadius: "12px",
              maxWidth: "400px",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
              <h3 style={{ marginTop: 0, color: "#00c6ff" }}>Acerca de FlyBy 3D</h3>
              <p style={{ fontSize: "0.9rem", lineHeight: "1.5", color: "#ccc" }}>
                Esta aplicación te permite visualizar y animar rutas GPX en un entorno 3D de alta calidad.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "#aaa", paddingLeft: "20px", lineHeight: "1.6" }}>
                <li><strong>Cargar ruta:</strong> Puedes subir tu propio archivo GPX o cargar una ruta de ejemplo.</li>
                <li><strong>Puntos de interés:</strong> Añade fotos y videos (hasta 10s) en puntos específicos de la ruta.</li>
                <li><strong>Personalización:</strong> Cambia el modelo 3D (Mixtli, Corvid o el tuyo propio) y sube tu avatar.</li>
                <li><strong>Cámara:</strong> Ajusta la altitud, inclinación, exageración de terreno y duración de la animación.</li>
                <li><strong>Ocultar Menú:</strong> Activa "Ocultar menú al iniciar" en la configuración para tener una vista limpia durante el recorrido.</li>
              </ul>
              <div style={{ background: "rgba(255, 165, 0, 0.1)", borderLeft: "4px solid orange", padding: "10px", marginTop: "15px", fontSize: "0.85rem", color: "#ffd085" }}>
                <strong>💡 Recomendación para grabar:</strong> La aplicación no cuenta con funcionalidad nativa para grabar el recorrido. Te sugerimos activar la opción de ocultar el menú y utilizar un software de grabación de pantalla (como OBS Studio o la herramienta integrada de tu sistema) para capturar la animación.
              </div>
              <div style={{ textAlign: "right", marginTop: "20px" }}>
                <button onClick={() => setShowInfo(false)} style={{ background: "#0070f3", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status dot + message */}
        <div style={{ marginBottom: "20px", padding: "10px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: error ? "#ff4444" : isAnimating ? "#00c6ff" : "#00ff88", boxShadow: error ? "0 0 8px #ff4444" : isAnimating ? "0 0 8px #00c6ff" : "0 0 8px #00ff88" }} />
          <span style={{ opacity: 0.9 }}>{error || statusMessage || "Listo para iniciar"}</span>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* GPX file input                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ position: "relative" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "#888", fontWeight: "600" }}>
              Ruta GPX
            </label>
            <input
              type="file"
              accept=".gpx"
              onChange={handleFileChange}
              disabled={isLoading || isAnimating}
              style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "0.9rem", marginBottom: "8px" }}
            />
            <button
              onClick={handleLoadDefaultGpx}
              disabled={isLoading || isAnimating}
              style={{ width: "100%", padding: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", color: "#00c6ff", fontSize: "0.8rem", cursor: (isLoading || isAnimating) ? "not-allowed" : "pointer", fontWeight: "600", transition: "background 0.2s" }}
            >
              🚀 Cargar ruta de ejemplo
            </button>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Photo waypoints                                                  */}
          {/* -------------------------------------------------------------- */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "#888", fontWeight: "600" }}>
                Puntos de Foto ({photos.length})
              </label>
              {photos.some((p) => p.shown) && (
                <button
                  onClick={() => setPhotos((prev) => prev.filter((p) => !p.shown))}
                  style={{ background: "rgba(255,68,68,0.15)", border: "1px solid rgba(255,68,68,0.4)", color: "#ff6666", borderRadius: "4px", padding: "3px 8px", fontSize: "0.7rem", cursor: "pointer" }}
                  title="Eliminar todos los puntos ya visitados"
                >
                  🗑️ Limpiar pasados
                </button>
              )}
            </div>

            {/* Add photo at current position */}
            <label
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: gpxFeature ? "rgba(0,112,243,0.15)" : "rgba(255,255,255,0.05)", border: gpxFeature ? "1px dashed rgba(0,198,255,0.5)" : "1px dashed #444", borderRadius: "6px", cursor: gpxFeature ? "pointer" : "not-allowed", fontSize: "0.8rem", color: gpxFeature ? "#00c6ff" : "#555", marginBottom: "8px" }}
              title={gpxFeature ? `Añadir foto/video en km ${currentDistanceKm.toFixed(2)}` : "Carga una ruta primero"}
            >
              <span style={{ fontSize: "1.1rem" }}>📷</span>
              <span>+ Media en posición actual</span>
              <input type="file" accept="image/*,video/*" style={{ display: "none" }} disabled={!gpxFeature} onChange={(e) => handleAddPhoto(e)} />
            </label>

            {/* Photo list */}
            {photos.length > 0 && (
              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "5px" }}>
                {[...photos].sort((a, b) => a.distanceAlongPath - b.distanceAlongPath).map((photo) => {
                  const isPast = photo.shown;
                  const kmLabel = (photo.distanceAlongPath / 1000).toFixed(2);
                  return (
                    <div key={photo.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", background: isPast ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)", border: isPast ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,198,255,0.2)", borderRadius: "6px", opacity: isPast ? 0.5 : 1, transition: "opacity 0.3s" }}>
                      {photo.mediaType === "video" ? (
                        <div style={{ width: "32px", height: "32px", background: "rgba(0,0,0,0.5)", borderRadius: "4px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", border: "1px solid rgba(255,255,255,0.1)" }} title="Video">
                          🎥
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={photo.url} alt="thumb" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.75rem", color: isPast ? "#555" : "#ccc", display: "flex", alignItems: "center", gap: "5px" }}>
                          {isPast ? <span title="Ya visitado" style={{ fontSize: "0.65rem" }}>✅</span> : <span title="Próximo" style={{ fontSize: "0.65rem" }}>📍</span>}
                          <span style={{ fontWeight: "600" }}>km {kmLabel}</span>
                        </div>
                      </div>
                      <input type="checkbox" checked={photo.enabled} onChange={(e) => setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, enabled: e.target.checked } : p))} title="Activar/Desactivar punto" style={{ cursor: "pointer" }} />
                      <button onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id))} style={{ background: "none", border: "none", color: "#ff4444", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: "2px" }} title="Eliminar punto">×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Playback buttons                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ marginTop: "25px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <button
            onClick={handleToggleAnimation}
            disabled={!gpxFeature || !isTerrainReady || isLoading}
            style={{ padding: "12px", background: isAnimating ? "rgba(255,68,68,0.2)" : "linear-gradient(135deg, #0070f3, #00c6ff)", color: isAnimating ? "#ff4444" : "white", border: isAnimating ? "1px solid #ff4444" : "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem", transition: "all 0.2s ease", boxShadow: isAnimating ? "none" : "0 4px 12px rgba(0,112,243,0.3)" }}
          >
            {isAnimating ? "PAUSAR" : "INICIAR"}
          </button>
          <button
            onClick={handleResetAnimation}
            disabled={!gpxFeature || isLoading}
            style={{ padding: "12px", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem", transition: "all 0.2s ease" }}
          >
            REINICIAR
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Camera settings sliders                                           */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: "0.7rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
            ⚙️ Configuración de Vista
          </div>
          {sliders.map((s) => (
            <div key={s.label} style={{ marginBottom: "12px" }} title={s.tip}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "#aaa" }}>{s.label}</span>
                <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#00c6ff", background: "rgba(0,198,255,0.1)", padding: "1px 7px", borderRadius: "4px", minWidth: "44px", textAlign: "center" }}>
                  {s.value.toFixed(s.step < 1 ? 1 : 0)}{s.unit}
                </span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => s.onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "#00c6ff", cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "#444", marginTop: "1px" }}>
                <span>{s.min}{s.unit}</span>
                <span>{s.max}{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Keyframe controls                                                 */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {/* Enable checkbox */}
          <label
            style={{ fontSize: "0.82rem", color: keyframes.length < 2 ? "#555" : "#ccc", cursor: keyframes.length < 2 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}
            title={keyframes.length < 2 ? "Captura al menos 2 vistas para habilitar keyframes" : "Usa vistas de cámara guardadas"}
          >
            <input type="checkbox" checked={useKeyframes} onChange={(e) => setUseKeyframes(e.target.checked)} disabled={keyframes.length < 2} style={{ cursor: keyframes.length < 2 ? "not-allowed" : "pointer" }} />
            Usar Keyframes {keyframes.length < 2 ? "(Mín. 2)" : ""} ({keyframes.length})
          </label>

          {/* Capture button */}
          <button
            onClick={handleCaptureKeyframe}
            disabled={isAnimating || !gpxFeature}
            style={{ width: "100%", padding: "9px 0", background: (isAnimating || !gpxFeature) ? "rgba(255,255,255,0.04)" : "rgba(0,198,255,0.12)", color: (isAnimating || !gpxFeature) ? "#555" : "#00c6ff", border: `1px solid ${(isAnimating || !gpxFeature) ? "rgba(255,255,255,0.1)" : "rgba(0,198,255,0.45)"}`, borderRadius: "8px", fontSize: "0.78rem", fontWeight: "700", cursor: (isAnimating || !gpxFeature) ? "not-allowed" : "pointer", letterSpacing: "0.03em", transition: "background 0.2s, border-color 0.2s", marginBottom: "8px" }}
          >
            📷 Capturar Vista
          </button>

          {/* Keyframe list */}
          {keyframes.length > 0 && (
            <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px", paddingRight: "2px" }}>
              {keyframes.map((kf, idx) => {
                const isActive = useKeyframes && isAnimating && idx === activeKeyframeIndex;
                const kmPos = (kf.distance / 1000).toFixed(2);
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 8px", borderRadius: "6px", background: isActive ? "rgba(0,198,255,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${isActive ? "rgba(0,198,255,0.4)" : "rgba(255,255,255,0.07)"}`, transition: "background 0.3s, border-color 0.3s" }}>
                    <span style={{ minWidth: "20px", height: "20px", borderRadius: "50%", background: isActive ? "#00c6ff" : "rgba(255,255,255,0.12)", color: isActive ? "#000" : "#888", fontSize: "0.65rem", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.3s, color 0.3s" }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: "0.75rem", color: isActive ? "#00c6ff" : "#bbb", fontWeight: isActive ? "700" : "400", transition: "color 0.3s" }}>
                      📍 km {kmPos}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: "0.6rem", color: "#00c6ff", fontWeight: "700", background: "rgba(0,198,255,0.15)", padding: "1px 5px", borderRadius: "4px", letterSpacing: "0.05em", flexShrink: 0 }}>
                        ▶ ACTIVO
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const updated = keyframes.filter((_, i) => i !== idx);
                        setKeyframes(updated);
                        if (updated.length < 2) setUseKeyframes(false);
                        setActiveKeyframeIndex(-1);
                      }}
                      title={`Eliminar keyframe ${idx + 1}`}
                      style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: "2px 4px", borderRadius: "4px", flexShrink: 0, transition: "color 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ff7070")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Clear all keyframes */}
          {keyframes.length > 0 && (
            <button
              onClick={() => { setKeyframes([]); setUseKeyframes(false); setActiveKeyframeIndex(-1); }}
              style={{ width: "100%", padding: "7px 0", background: "rgba(255,68,68,0.08)", color: "#ff7070", border: "1px solid rgba(255,68,68,0.35)", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", letterSpacing: "0.03em", marginBottom: "8px" }}
              title="Eliminar todos los keyframes capturados"
            >
              🗑️ Limpiar todos los frames
            </button>
          )}

          <div style={{ fontSize: "0.7rem", color: "#555", fontStyle: "italic" }}>
            Pausa, mueve la cámara y captura para crear una ruta personalizada.
          </div>

          {/* Hide-menu-on-start option */}
          <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <label style={{ fontSize: "0.8rem", color: "#ccc", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={hideMenuOnStart} onChange={(e) => setHideMenuOnStart(e.target.checked)} />
              Ocultar menú al iniciar
            </label>
          </div>

          {/* Avatar upload */}
          <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "#888", fontWeight: "600" }}>
              Avatar (esquina superior derecha)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem", color: "#ccc" }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar preview" style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(0,198,255,0.6)", flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: "1.5rem" }}>👤</span>
              )}
              <span>{avatarUrl ? "Cambiar avatar" : "Subir foto de perfil"}</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (avatarUrl) URL.revokeObjectURL(avatarUrl);
                  setAvatarUrl(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
            </label>
            {avatarUrl && (
              <button
                onClick={() => { URL.revokeObjectURL(avatarUrl); setAvatarUrl(null); }}
                style={{ marginTop: "6px", background: "none", border: "none", color: "#ff6666", fontSize: "0.75rem", cursor: "pointer", padding: 0 }}
              >
                × Quitar avatar
              </button>
            )}
          </div>

          {/* Model Selection */}
          <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "#888", fontWeight: "600" }}>
              Modelo 3D
            </label>
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px", fontSize: "0.8rem", color: "#ccc" }}>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <input type="radio" name="modelType" value="mixtli" checked={modelType === "mixtli"} onChange={() => handleModelTypeChange("mixtli")} style={{ cursor: "pointer", accentColor: "#00c6ff" }} />
                Mixtli
              </label>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <input type="radio" name="modelType" value="corvid" checked={modelType === "corvid"} onChange={() => handleModelTypeChange("corvid")} style={{ cursor: "pointer", accentColor: "#00c6ff" }} />
                Corvid
              </label>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <input type="radio" name="modelType" value="custom" checked={modelType === "custom"} onChange={() => handleModelTypeChange("custom")} style={{ cursor: "pointer", accentColor: "#00c6ff" }} />
                Personalizado
              </label>
            </div>

            {modelType === "custom" && (
              <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem", color: "#ccc" }}>
                <span style={{ fontSize: "1.5rem" }}>🧊</span>
                <span>{customModelUrl ? "Cambiar modelo 3D (.glb, .gltf)" : "Subir modelo 3D (.glb, .gltf)"}</span>
                <input
                  type="file"
                  accept=".glb,.gltf"
                  style={{ display: "none" }}
                  onChange={handleModelChange}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Restore menu button (shown when sidebar is hidden)                  */}
      {/* ------------------------------------------------------------------ */}
      {!isMenuVisible && !hideWhileRouteComplete && (
        <button
          onClick={() => setIsMenuVisible(true)}
          style={{ position: "absolute", top: "20px", left: "20px", padding: "10px 15px", background: "rgba(20,20,20,0.8)", backdropFilter: "blur(5px)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", cursor: "pointer", zIndex: 10, fontWeight: "600", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
        >
          <span style={{ fontSize: "1.2rem" }}>☰</span> MOSTRAR MENÚ
        </button>
      )}
    </>
  );
}
