# 🚀 FlyBy Hiking

### Visor 3D de Rutas GPX con Animación Cinematográfica y Modelo 3D

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Mapbox](https://img.shields.io/badge/Mapbox_GL-3.11.0-4264FB?style=for-the-badge&logo=mapbox)](https://www.mapbox.com/)
[![Three.js](https://img.shields.io/badge/Three.js-0.181.2-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

FlyBy Hiking es una aplicación web interactiva que permite a los usuarios cargar sus rutas de senderismo en formato **GPX**, proyectarlas sobre un terreno tridimensional detallado utilizando Mapbox, y disfrutar de un sobrevuelo cinematográfico automático acompañado por un personaje 3D dinámico que recorre la ruta en tiempo real.

---

## 📋 Tabla de Contenidos

- [✨ Características principales](#-características-principales)
- [📦 Requisitos y Prerrequisitos](#-requisitos-y-prerrequisitos)
- [🛠️ Instalación y Configuración](#%EF%B8%8F-instalación-y-configuración)
- [⚙️ Parámetros de Configuración](#%EF%B8%8F-parámetros-de-configuración)
- [🚀 Guía de Uso](#-guía-de-uso)
- [🎥 Grabación de Video](#-grabación-de-video)
- [🏗️ Arquitectura y Estructura del Proyecto](#%EF%B8%8F-arquitectura-y-estructura-del-proyecto)
- [📜 Scripts Disponibles](#-scripts-disponibles)

---

## ✨ Características principales

### 🗺️ Visualización de Terreno 3D Realista
- **Terreno 3D Dinámico**: Generado a partir de los datos globales de elevación de Mapbox (DEM).
- **Exageración del Terreno**: Configurada por defecto en **1.5** (`DEFAULT_TERRAIN_EXAGGERATION`) para resaltar el relieve montañoso, ajustable en tiempo real mediante el panel de control.
- **Estilo Satélite Híbrido**: Capa de imágenes satelitales detalladas combinada con la red de caminos y calles para una mejor ubicación.

### 🎬 Animación Cinematográfica y Flyby
- **Sobrevuelo Suave**: La cámara sigue el avance del recorrido con interpolación lineal (LERP), suavizando saltos y temblores de GPS con un factor de `0.1` (`LERP_SMOOTHING_FACTOR`).
- **Rotación Orbital**: Durante la reproducción de 90 segundos por defecto (`DEFAULT_ANIMATION_DURATION`), la cámara realiza una rotación orbital de 280° (`DEFAULT_CAMERA_ROTATION`) para proporcionar perspectivas dinámicas del entorno.
- **Cámara libre**: Configurada por defecto con una inclinación de 60° (`DEFAULT_CAMERA_PITCH`) y altitud constante de 800 metros sobre el terreno (`DEFAULT_CAMERA_ALTITUDE`).
- **Vista Panorámica Final (Route Overview)**: Al completarse el recorrido, la cámara realiza una animación fluiva (`fitBounds`) para encuadrar la ruta completa en el mapa antes de mostrar las estadísticas finales.

### 🎮 Modelo 3D de Personaje en Ruta
- **Personaje Animado**: El modelo 3D `.glb` (`public/models/mixtli-model.glb` por defecto) recorre la ruta de senderismo.
- **Integración WebGL**: Renderizado sobre el mapa utilizando Three.js e integrado en Mapbox mediante una capa personalizada (`ThreeCustomLayer`).
- **Alineación de Dirección**: El personaje se orienta y rota dinámicamente según la dirección del trayecto para mirar siempre hacia el frente del camino. Está elevado a 35 metros sobre el nivel del suelo (`ALTITUDE_OFFSET`) para evitar colisiones con el terreno.
- **Tamaño del Modelo Ajustable**: Configurable dinámicamente mediante el slider "Tamaño modelo 3D" en el panel lateral (rango de 5m a 200m, con valor base de 20m).

### 📸 Sistema de Hitos Multimedia (Pantalla Completa)
- **Puntos Kilométricos**: Permite asociar fotos y videos cargados por el usuario a puntos específicos de la ruta en función del kilometraje.
- **Visualización en Pantalla Completa**: Al llegar a un waypoint con multimedia, la animación se pausa automáticamente y muestra el contenido (fotos o videos de hasta 10 segundos) ocupando la mayor parte del espacio de pantalla disponible.
- **Diseño Inmersivo**: Cuenta con un ajuste de contenido (`objectFit: contain`) para no recortar la imagen/video, un encabezado flotante con degradado premium y una barra de progreso que indica el tiempo restante (3 segundos para fotos; los videos se reproducen por completo). Tras finalizar, el recorrido se reanuda automáticamente.
- **Gestión de Contenido**: Opción de habilitar/deshabilitar fotos y videos de forma individual y borrar hitos mostrados en la barra lateral.

### 🎬 Sistema de Keyframes de Cámara
- **Perspectivas Personalizadas**: Puedes pausar el recorrido, rotar/trasladar libremente la cámara del mapa a tu ángulo favorito, y guardar esa vista como un keyframe.
- **Interpolación Inteligente**: Al guardar un mínimo de 2 keyframes, puedes activar la opción **"Usar keyframes"**. La cámara interpolará suavemente su posición (lineal) y orientación (mediante cuaterniones / SLERP) entre tus keyframes en lugar del sobrevuelo automático por defecto.
- **Gestión de Keyframes**: Botones para limpiar la lista y empezar de cero. Los keyframes se borran automáticamente al cargar un nuevo archivo GPX para evitar inconsistencias.

### 👤 Avatar de Perfil Flotante
- **Carga de Avatar**: Permite al usuario subir una foto de perfil directamente desde la pestaña "Avatar" en la barra lateral.
- **Diseño Premium**: El avatar se muestra como un círculo flotante ampliado de 140px en la esquina superior derecha con bordes pulidos en blanco y azul, sombra tridimensional y una animación de entrada de rebote suave (`avatarPop`).

### 📊 HUD, Resumen y Panel de Control Premium
- **Widget de Estadísticas Ampliado**: Panel translúcido inferior (Glassmorphism) con padding y fuentes optimizadas para mostrar en tiempo real la distancia recorrida (km), la altitud actual (m) y la ganancia de elevación acumulada (m).
- **Modal de Ruta Completada**: Al finalizar la simulación, aparece un elegante modal translúcido central que presenta los datos resumidos del GPX: Distancia Total (km), Desnivel acumulado (+ m), Altitud Máxima (m) y Altitud Mínima (m).
- **Auto-ocultar Interfaz**: El menú lateral y el botón de hamburguesa flotante se ocultan de forma automática mientras se muestra el modal de ruta completada para garantizar una visualización limpia y despejada.
- **Ocultar Menú en Reproducción**: Opción para esconder el menú lateral automáticamente cuando la animación inicia.
- **Botón Flotante de Acceso**: Botón flotante `☰ MOSTRAR MENÚ` que aparece en la parte superior izquierda cuando la interfaz está oculta para regresar a los controles en cualquier momento.
- **Control de Pausa/Reproducción robusto**: Sincronización precisa de los tiempos de reproducción sin saltos bruscos al pausar y reanudar la animación.

---

## 📦 Requisitos y Prerrequisitos

Para ejecutar este proyecto en tu entorno local necesitas:
- **Node.js** >= 18.x
- **npm** >= 9.x (o yarn, pnpm)
- **Token de Mapbox**: Registra una cuenta gratuita en [Mapbox](https://www.mapbox.com/) y crea un token de acceso público.
- **Modelo 3D (.glb)**: Un modelo de personaje en formato GLTF ubicado en `public/models/mixtli-model.glb` (el visor incluye uno por defecto).

---

## 🛠️ Instalación y Configuración

### 1. Clonar el repositorio y entrar al proyecto
```bash
git clone https://github.com/tu-usuario/flyby-hiking.git
cd flyby-hiking/mapbox-gpx-viewer
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo llamado `.env.local` en el directorio raíz de `mapbox-gpx-viewer`:
```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=tu_token_de_mapbox_aqui
```

### 4. Ejecutar en modo desarrollo
```bash
npm run dev
```
Abre tu navegador en `http://localhost:3000` para ver la aplicación.

---

## ⚙️ Parámetros de Configuración

Puedes personalizar diversos aspectos de la animación y la cámara editando las constantes preestablecidas y las variables de entorno de la aplicación:

### Configuración Centralizada en `app/constants/defaults.ts`
Todas las constantes de inicialización y comportamiento por defecto se encuentran en este archivo:

| Constante | Valor por Defecto | Descripción |
|-----------|-------------------|-------------|
| `DEFAULT_CAMERA_PITCH` | `60` | Inclinación vertical inicial de la cámara de Mapbox (grados). |
| `DEFAULT_CAMERA_ALTITUDE` | `800` | Altura inicial de la cámara sobre el nivel del terreno (metros). |
| `DEFAULT_TERRAIN_EXAGGERATION` | `1.5` | Factor inicial de exageración de relieve para montañas y valles. |
| `DEFAULT_ANIMATION_DURATION` | `90` | Duración del sobrevuelo completo de la ruta (segundos). |
| `DEFAULT_CAMERA_ROTATION` | `280` | Ángulo horizontal acumulado que rota la cámara orbitalmente durante la animación (grados). |
| `LERP_SMOOTHING_FACTOR` | `0.1` | Factor de suavizado (0 a 1) para el movimiento y amortiguación de temblores GPS. |
| `PHOTO_TRIGGER_DISTANCE_M` | `20` | Rango de proximidad (metros) en la ruta que activa el waypoint multimedia de fotos y videos. |

### Configuración del Personaje 3D en `app/utils/ThreeCustomLayer.ts`
Configuraciones específicas del renderizado 3D con Three.js:

| Constante / Atributo | Valor por Defecto | Descripción |
|-----------|-------------------|-------------|
| `ALTITUDE_OFFSET` | `35` | Altura fija en metros sobre el terreno a la que se suspende el personaje para evitar colisionar con relieve o construcciones de Mapbox. |
| `modelScaleMeters` | `20` | Tamaño/escala inicial del modelo 3D en metros antes de modificarse dinámicamente. |

### Controles Interactivos en Tiempo Real (Panel Lateral)
Durante la ejecución de la app, el usuario puede manipular los siguientes rangos de parámetros desde el sidebar:
- **Altitud de cámara**: Mín: `50`m / Máx: `2000`m (pasos de `50`m).
- **Inclinación de cámara**: Mín: `0`° / Máx: `85`° (pasos de `5`°).
- **Rotación orbital**: Mín: `0`° / Máx: `720`° (pasos de `10`°).
- **Duración animación**: Mín: `15`s / Máx: `300`s (pasos de `15`s).
- **Exageración terreno**: Mín: `0.5`x / Máx: `4`x (pasos de `0.1`x).
- **Tamaño modelo 3D**: Mín: `5`m / Máx: `200`m (pasos de `5`m).

---

## 🛠️ Personalización del Modelo 3D

Es posible utilizar prácticamente **cualquier modelo 3D** en formato `.glb`/`.gltf`. Tienes tres formas de hacerlo:

1. **Subida Dinámica desde la Interfaz (Recomendada)**:
   * Abre la barra lateral.
   * Haz clic en **"Subir modelo 3D"**.
   * Selecciona cualquier archivo `.glb` o `.gltf` desde tu dispositivo. El personaje en la simulación se actualizará en tiempo real de forma instantánea.

2. **Reemplazo Directo de Archivo**:
   * Consigue tu modelo en formato `.glb`.
   * Renómbralo exactamente como `mixtli-model.glb`.
   * Reemplázalo en el directorio local: `public/models/mixtli-model.glb`.

3. **Personalizando la Ruta de Carga en el Código**:
   * Guarda tu archivo `.glb` dentro de la carpeta `public/models/` (por ejemplo, `public/models/mi-excursionista.glb`).
   * Abre [ThreeCustomLayer.ts](file:///c:/Users/USER/Desktop/Proyectos/senderismoProjects/flyby-hiking/mapbox-gpx-viewer/app/utils/ThreeCustomLayer.ts) y edita la ruta del recurso dentro de la función `loadModel()` (alrededor de la línea 58):
     ```typescript
     loader.load(
         "/models/mi-excursionista.glb",
         (gltf) => { ... }
     );
     ```

---

## 🚀 Guía de Uso

1. **Carga tu archivo GPX**: Haz clic en el botón "Seleccionar archivo GPX" en el panel lateral. El mapa se reubicará al inicio de tu ruta de forma automática y creará el perfil de elevación.
2. **Personaliza tu Avatar (Opcional)**: En la pestaña "Avatar" de la barra lateral, sube tu foto de perfil.
3. **Agrega fotos de ruta (Opcional)**:
   - Sube una o varias imágenes en la sección "Fotos del Recorrido".
   - Introduce el kilómetro donde deseas ubicar cada foto (ej. `2.5` para el kilómetro 2.5).
4. **Captura Keyframes de Cámara (Opcional)**:
   - Pausa la animación.
   - Navega en el mapa (clic derecho + arrastrar para rotar e inclinar) hasta el encuadre perfecto.
   - Haz clic en **"Agregar Keyframe"**. Captura al menos 2 keyframes para habilitar esta funcionalidad.
   - Marca la casilla **"Usar keyframes"** para que la cámara viaje a través de tus vistas guardadas.
5. **Inicia la simulación**: Pulsa el botón **"INICIAR"** para arrancar el sobrevuelo 3D.
   - Si marcaste la casilla **"Ocultar menú al iniciar"**, el panel lateral desaparecerá. Podrás recuperarlo con el botón flotante `☰ MOSTRAR MENÚ` de la parte superior izquierda.

---

## 🎥 Grabación de Video

> ⚠️ **Información sobre Exportación de Video**:
> El botón nativo de exportación de video de la aplicación ha sido removido del menú para priorizar la estabilidad, debido a incompatibilidades de rendimiento y sincronización en la codificación de frames 3D de Mapbox combinados con Three.js en varios navegadores web.
>
> **Recomendación para guardar tus rutas**:
> 1. Activa la opción **"Ocultar menú al iniciar"** en el panel de control.
> 2. Haz clic en **"INICIAR"** para reproducir tu ruta a pantalla completa con las estadísticas y fotos.
> 3. Utiliza una herramienta de captura de pantalla de alta fidelidad como:
>    - **OBS Studio** (Recomendado para PC/Mac, gratuito y de código abierto).
>    - **Grabador de pantalla nativo de Windows** (`Windows + Alt + R` o Barra de juegos).
>    - **QuickTime** (en macOS).

---

## 🏗️ Arquitectura y Estructura del Proyecto

### Estructura de Carpetas
```
flyby-hiking/
├── index.html                        # Prototipo antiguo standalone HTML/JS
└── mapbox-gpx-viewer/
    ├── app/
    │   ├── page.tsx                  # Componente principal React y UI de control
    │   ├── layout.tsx                # Definición de fuentes Geist y metadatos
    │   ├── globals.css               # Estilos globales y Tailwind CSS 4.x
    │   └── utils/
    │       └── ThreeCustomLayer.ts   # Capa WebGL que integra Three.js con Mapbox
    ├── public/
    │   └── models/
    │       └── mixtli-model.glb      # Modelo 3D del personaje
    ├── package.json                  # Dependencias y scripts npm
    └── tsconfig.json                 # Configuración de TypeScript
```

### Funcionamiento de la Capa 3D
La integración 3D se realiza en [ThreeCustomLayer.ts](file:///c:/Users/USER/Desktop/Proyectos/senderismoProjects/flyby-hiking/mapbox-gpx-viewer/app/utils/ThreeCustomLayer.ts). Mapbox permite capas personalizadas (`CustomLayerInterface`) que exponen su contexto de WebGL. 
- En el método `onAdd`, inicializamos la escena de Three.js, la cámara y el cargador de modelos GLTF (`GLTFLoader`).
- En el método `render`, convertimos las coordenadas geográficas de latitud y longitud del personaje a coordenadas de proyección Mercator nativas de Mapbox, y reposicionamos la matriz de cámara para sincronizar los mundos 3D de Mapbox y Three.js.

---

## 📜 Scripts Disponibles

En el directorio `mapbox-gpx-viewer` puedes ejecutar los siguientes scripts:

| Script | Acción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:3000` con recarga rápida. |
| `npm run build` | Compila el proyecto en una versión optimizada de producción lista para despliegue. |
| `npm run start` | Arranca la aplicación compilada en producción. |
| `npm run lint` | Ejecuta el analizador de código ESLint para buscar posibles errores de sintaxis y buenas prácticas. |

---
Desarrollado con ❤️ para los amantes del senderismo y la montaña.
