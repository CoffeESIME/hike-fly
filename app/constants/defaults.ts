// ---------------------------------------------------------------------------
// Default values for all user-adjustable camera and terrain parameters.
// These are the initial values shown in the "Configuración de Vista" sliders.
// ---------------------------------------------------------------------------

export const DEFAULT_CAMERA_PITCH = 60;          // degrees (0 = top-down, 85 = horizon)
export const DEFAULT_CAMERA_ALTITUDE = 800;       // meters above terrain
export const DEFAULT_TERRAIN_EXAGGERATION = 1.5; // multiplier; higher = more dramatic relief
export const DEFAULT_ANIMATION_DURATION = 90;     // seconds for a full route flyby
export const DEFAULT_CAMERA_ROTATION = 280;       // degrees of orbital rotation over full animation

// Internal animation smoothing — not exposed in the UI
export const LERP_SMOOTHING_FACTOR = 0.1;

// Radius (in meters along the path) within which a photo waypoint triggers the slideshow
export const PHOTO_TRIGGER_DISTANCE_M = 20;
