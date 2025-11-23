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
        const ambientLight = new THREE.AmbientLight(0xffffff, 6); // Increased intensity
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 6.0); // Increased intensity
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
            this.addPlaceholderModel();
        } else {
            this.addPlaceholderModel();
        }
    }

    addPlaceholderModel() {
        // ... configuración del loader ...
        const loader = new GLTFLoader();

        loader.load('/models/mixtli-model.glb', (gltf) => {
            this.model = gltf.scene;

            // 1. ARREGLAR MATERIALES (Para que se vea sólido)
            this.model.traverse((object) => {
                // Verificamos el tipo de clase
                if (object instanceof THREE.Mesh) {
                    // Aquí dentro, TypeScript ya sabe que 'object' es un Mesh
                    // y te dejará acceder a .material sin errores.

                    // A veces el material puede ser un array, así que es bueno castearlo
                    const material = object.material as THREE.MeshStandardMaterial;

                    material.metalness = 0;
                    material.roughness = 0.8;
                }
            });

            // 2. ARREGLAR ROTACIÓN (Para que no esté de cabeza)
            // En Mapbox custom layer, a veces hay que rotar X para levantarlo.
            this.model.rotation.x = -Math.PI / 2;

            // Ajusta la escala si es necesario (Blender suele exportar muy grande)
            this.model.scale.set(10, 10, 10);

            this.scene.add(this.model);
        });

        // 3. LUCES (Vital para ver el modelo)
        const ambient = new THREE.AmbientLight(0xffffff, 2.5);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 3.0);
        sun.position.set(10, 10, 100);
        this.scene.add(sun);
    }
    render(gl: WebGLRenderingContext, matrix: number[]) {
        if (!this.renderer || !this.map) return;
        const m = new THREE.Matrix4().fromArray(matrix);
        this.camera.projectionMatrix = m;
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
    }

    updatePosition(lng: number, lat: number, altitude: number, bearing: number) {
        if (!this.model) return;

        // Add altitude offset to prevent z-fighting/clipping with terrain
        const ALTITUDE_OFFSET = 35; // meters
        const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
            [lng, lat],
            altitude + ALTITUDE_OFFSET
        );

        this.model.position.set(
            modelAsMercatorCoordinate.x,
            modelAsMercatorCoordinate.y,
            modelAsMercatorCoordinate.z
        );

        const scale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();
        const targetSizeMeters = 20;
        this.model.scale.set(
            targetSizeMeters * scale,
            targetSizeMeters * scale,
            targetSizeMeters * scale
        );

        this.model.rotation.set(0, 0, 0);
        this.model.rotation.x = Math.PI / 2;
        this.model.rotation.z = -bearing * (Math.PI / 180);
    }
}
