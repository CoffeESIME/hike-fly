import mapboxgl from "mapbox-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class ThreeCustomLayer implements mapboxgl.CustomLayerInterface {
    id: string;
    type: "custom";
    renderingMode: "3d";
    map: mapboxgl.Map | null;
    camera: THREE.Camera;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer | null;
    model: THREE.Object3D | null;
    modelUrl: string | null;

    constructor(id: string, modelUrl: string | null = null) {
        this.id = id;
        this.type = "custom";
        this.renderingMode = "3d";
        this.map = null;
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        this.renderer = null;
        this.model = null;
        this.modelUrl = modelUrl;

        // Setup basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(0, -70, 100).normalize();
        this.scene.add(directionalLight);
    }

    onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
        this.map = map;

        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
        });
        this.renderer.autoClear = false;

        if (this.modelUrl) {
            const loader = new GLTFLoader();
            loader.load(
                this.modelUrl,
                (gltf) => {
                    this.model = gltf.scene;
                    this.scene.add(this.model);
                    // Initial scale adjustment - can be parameterized later
                    this.model.scale.set(10, 10, 10);
                    this.model.rotation.x = Math.PI / 2; // Adjust if needed for Z-up
                },
                undefined,
                (error) => {
                    console.error("Error loading 3D model:", error);
                    this.addPlaceholderModel();
                }
            );
        } else {
            this.addPlaceholderModel();
        }
    }

    addPlaceholderModel() {
        // Create a simple cone to represent a hiker/person
        const geometry = new THREE.ConeGeometry(2, 8, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.model = new THREE.Mesh(geometry, material);

        // Rotate to point forward (Y-up in Three.js, but Mapbox is Z-up usually, need to align)
        // Cone points up (Y). We want it to point "forward" or just stand up.
        // In Mapbox custom layer:
        // x is east, y is north, z is up.
        // Three.js default: Y is up.
        // So we rotate geometry so Y becomes Z.
        (this.model as THREE.Mesh).geometry.rotateX(Math.PI / 2);
        this.model.position.set(0, 0, 0);

        this.scene.add(this.model);
    }

    render(gl: WebGLRenderingContext, matrix: number[]) {
        if (!this.renderer || !this.map) return;

        // Sync Mapbox matrix with Three.js camera
        const m = new THREE.Matrix4().fromArray(matrix);
        this.camera.projectionMatrix = m;

        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
    }

    updatePosition(lng: number, lat: number, altitude: number, bearing: number) {
        if (!this.model) return;

        const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
            [lng, lat],
            altitude
        );

        // Update model position
        this.model.position.set(
            modelAsMercatorCoordinate.x,
            modelAsMercatorCoordinate.y,
            modelAsMercatorCoordinate.z
        );

        // Scale model to maintain size in meters (approx)
        // 1 unit in Mercator = 1 / metersPerPixelAtLatitude meters? No.
        // MercatorCoordinate.meterInMercatorCoordinateUnits() gives the scale factor.
        const scale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
        // We want the model to be roughly 2 meters tall (if it's a person)
        // If our cone is 8 units tall in local space, we scale it.
        // Let's say we want it to be 10 meters tall for visibility.
        const targetSizeMeters = 20;
        this.model.scale.set(
            targetSizeMeters * scale,
            targetSizeMeters * scale,
            targetSizeMeters * scale
        );

        // Rotation
        // Bearing is in degrees, clockwise from North.
        // Three.js rotation is usually counter-clockwise in radians.
        // We need to align the model's "forward" with the bearing.
        // If our cone points +Y (North in Mapbox frame), bearing 0 is correct.
        // Bearing 90 (East) -> Rotate -90 degrees (or +270).
        this.model.rotation.z = -bearing * (Math.PI / 180);
        this.model.rotation.x = Math.PI / 2; // Keep it standing up
    }
}
