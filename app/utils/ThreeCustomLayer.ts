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

    // Store model position in Mercator coordinates for use in render()
    private modelMercator: mapboxgl.MercatorCoordinate | null;
    private modelBearingRad: number;
    modelScaleMeters: number;

    constructor(id: string) {
        this.id = id;
        this.type = "custom";
        this.renderingMode = "3d";
        this.map = null;
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        this.renderer = null;
        this.model = null;
        this.modelMercator = null;
        this.modelBearingRad = 0;
        this.modelScaleMeters = 20; // meters
    }

    /** Update the 3D model scale (in meters) at runtime. */
    public setModelScale(meters: number) {
        this.modelScaleMeters = meters;
    }

    onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
        this.map = map;

        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
        });
        this.renderer.autoClear = false;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        this.scene.add(ambientLight);

        const sun = new THREE.DirectionalLight(0xffffff, 3.0);
        sun.position.set(10, 10, 100);
        this.scene.add(sun);

        this.loadModel();
    }

    public changeModel(modelUrl: string) {
        this.loadModel(modelUrl);
    }

    private loadModel(modelUrl: string = "/models/corvid.glb") {
        const loader = new GLTFLoader();
        loader.load(
            modelUrl,
            (gltf) => {
                if (this.model) {
                    this.scene.remove(this.model);
                }
                this.model = gltf.scene;

                // Render both sides of thin surfaces (both bundled GLBs are
                // single-sided). Keep texture alpha settings for custom models.
                this.model.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        const materials = Array.isArray(object.material)
                            ? object.material
                            : [object.material];
                        for (const material of materials) {
                            material.side = THREE.DoubleSide;
                            if (material instanceof THREE.MeshStandardMaterial) {
                                material.metalness = 0;
                                material.roughness = 0.8;
                            }
                            material.needsUpdate = true;
                        }
                    }
                });

                // The model is positioned at scene origin (0,0,0).
                // Its world position is controlled entirely by the modelMatrix
                // built in render() from this.modelMercator.
                // We do NOT set position/rotation/scale here — those are applied
                // in render() via the matrix multiplication.
                this.model.rotation.set(0, 0, 0);
                this.model.position.set(0, 0, 0);
                this.model.scale.set(1, 1, 1);

                this.scene.add(this.model);
            },
            undefined,
            (err) => console.error("Error loading model:", err)
        );
    }

    /**
     * Called every frame by Mapbox.
     * `matrix` is the Mapbox world-to-clip matrix (mercator coords → NDC).
     * We build the model's transform matrix and multiply it into the projection.
     */
    render(_gl: WebGLRenderingContext, matrix: number[]) {
        if (!this.renderer || !this.map || !this.model || !this.modelMercator) return;

        const merc = this.modelMercator;

        // Scale factor: converts meters to Mercator units at this latitude
        const scale = merc.meterInMercatorCoordinateUnits() * this.modelScaleMeters;

        /*
         * Build the model matrix in Mercator space.
         *
         * Mapbox uses a coordinate system where:
         *   - X: longitude (0→1 across the world)
         *   - Y: latitude (0→1 top-to-bottom)
         *   - Z: altitude (in Mercator units, positive up)
         *
         * Three.js uses Y-up. To reconcile:
         *   1. Rotate +90° around X to map Three.js Y-up to Z-up.
         *   2. Scale to meters and reflect Y for Mercator's south-positive axis.
         *   3. Rotate around vertical Z to face the camera, keeping the model upright.
         *   4. Translate to the model's Mercator position.
         *
         * The final camera matrix is: mapboxMatrix * modelMatrix
         */

        const modelMatrix = new THREE.Matrix4();

        // Translation
        const T = new THREE.Matrix4().makeTranslation(merc.x, merc.y, merc.z);

        // Use the actual camera position, including keyframes, manual orbit and
        // the final overview. Route bearings must not turn the character away.
        // Local +Z is the model's front; after S * Rx it points south (+Y).
        const cameraPosition = this.map.getFreeCameraOptions().position;
        if (cameraPosition) {
            let dx = cameraPosition.x - merc.x;
            dx -= Math.round(dx); // nearest world copy across the antimeridian
            const dy = cameraPosition.y - merc.y;
            if (Math.hypot(dx, dy) > 1e-12) {
                this.modelBearingRad = Math.atan2(-dx, dy);
            }
            // Directly overhead there is no horizontal facing direction;
            // preserve the last orientation instead of snapping to zero.
        }
        const Rz = new THREE.Matrix4().makeRotationZ(this.modelBearingRad);
        const Rx = new THREE.Matrix4().makeRotationX(Math.PI / 2); // Three Y-up → Mercator Z-up

        // Mercator and Three.js have opposite handedness. The reflection is
        // necessary to preserve the mesh's front faces in the map projection.
        const S = new THREE.Matrix4().makeScale(scale, -scale, scale);

        // Compose: T * Rz * S * Rx
        modelMatrix.multiplyMatrices(T, Rz);
        modelMatrix.multiply(S);
        modelMatrix.multiply(Rx);

        // Combine with Mapbox's world-to-clip matrix
        const mapboxMatrix = new THREE.Matrix4().fromArray(matrix);
        const finalMatrix = new THREE.Matrix4().multiplyMatrices(mapboxMatrix, modelMatrix);

        this.camera.projectionMatrix = finalMatrix;

        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
    }

    /**
     * Called from page.tsx every animation frame with the new geographic position.
     * @param lng  Longitude
     * @param lat  Latitude
     * @param altitude  Terrain elevation in meters
     */
    updatePosition(lng: number, lat: number, altitude: number) {
        const ALTITUDE_OFFSET = 35; // meters above terrain

        this.modelMercator = mapboxgl.MercatorCoordinate.fromLngLat(
            [lng, lat],
            altitude + ALTITUDE_OFFSET
        );

    }
}
