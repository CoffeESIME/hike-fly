import mapboxgl from "mapbox-gl";

// A photograph waypoint placed along the GPX route
export type PhotoMarker = {
  id: string;
  url: string;
  distanceAlongPath: number; // Meters from the route start
  coordinate: [number, number]; // [lng, lat]
  shown: boolean;   // Whether it has already been shown in the current animation run
  enabled: boolean; // Whether it is visible/active (user can toggle)
};

// A user-placed camera keyframe captured mid-animation
export type Keyframe = {
  distance: number; // Meters along the path where this keyframe was captured
  position: mapboxgl.MercatorCoordinate;
  orientation: [number, number, number, number]; // Quaternion [x, y, z, w]
};

// All user-adjustable camera and terrain parameters
export type CameraSettings = {
  cameraPitch: number;
  cameraAltitude: number;
  cameraRotation: number;
  animationDuration: number; // seconds
  terrainExaggeration: number;
};

// One point on the elevation profile derived from the GPX track
export type ElevationPoint = {
  dist: number; // meters from start
  ele: number;  // elevation in meters
};
