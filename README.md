<![CDATA[<div align="center">

# 🚀 FlyBy Hiking

### Visor 3D de Rutas GPX con Animación Cinematográfica

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Mapbox](https://img.shields.io/badge/Mapbox_GL-3.11.0-4264FB?style=for-the-badge&logo=mapbox)](https://www.mapbox.com/)
[![Three.js](https://img.shields.io/badge/Three.js-0.181.2-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<p align="center">
  <strong>Transforma tus rutas GPX en impresionantes videos 3D con sobrevuelo cinematográfico, modelos 3D animados y galerías de fotos integradas.</strong>
</p>

</div>

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Demo](#-demo)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Arquitectura](#-arquitectura)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Scripts Disponibles](#-scripts-disponibles)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

---

## ✨ Características

### 🗺️ Visualización 3D Avanzada
- **Terreno 3D real** con datos de elevación de Mapbox (DEM)
- **Estilo satelital** con calles superpuestas
- **Exageración configurable** del terreno para mayor impacto visual

### 🎬 Animación Cinematográfica
- **Sobrevuelo automático** siguiendo la ruta GPX
- **Cámara orbital** con rotación suave de 180°
- **Interpolación LERP** para transiciones fluidas
- **Sistema de keyframes** personalizable para control total de la cámara

### 🎮 Modelo 3D Animado
- **Personaje 3D** (.GLB) que recorre la ruta
- **Rotación dinámica** según la dirección del camino
- **Integración Three.js** con capa personalizada de Mapbox

### 📸 Sistema de Fotos
- **Marcadores de fotos** a lo largo de la ruta
- **Slideshow automático** durante la animación
- **Overlay modal** con barra de progreso
- **Activación/desactivación** individual de fotos

### 📊 Panel de Estadísticas
- **Distancia recorrida** en tiempo real
- **Altitud actual** interpolada
- **Desnivel positivo** acumulado
- **Perfil de elevación** calculado desde GPX

### 🎛️ Controles de Usuario
- **Interfaz moderna** con glassmorphism
- **Pausa/Reproducción** de la animación
- **Reinicio** a posición inicial
- **Logo personalizable** para branding
- **Modo ocultar menú** para grabación limpia

---

## 🎯 Demo

| Sobrevuelo 3D | Panel de Control |
|:---:|:---:|
| Animación cinematográfica con terreno real | Interfaz moderna con estadísticas en vivo |

---

## 📦 Requisitos

- **Node.js** >= 18.x
- **npm** >= 9.x o **pnpm** >= 8.x
- **Token de Mapbox** (gratuito en [mapbox.com](https://www.mapbox.com/))

---

## 🛠️ Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/flyby-hiking.git
cd flyby-hiking/mapbox-gpx-viewer
```

### 2. Instalar Dependencias

```bash
npm install
# o
pnpm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto `mapbox-gpx-viewer`:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=tu_token_de_mapbox_aqui
```

> 💡 **Tip:** Obtén tu token gratuito en [account.mapbox.com](https://account.mapbox.com/)

### 4. Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

---

## ⚙️ Configuración

### Variables de Animación

Puedes ajustar estos valores en `app/page.tsx`:

```typescript
const CAMERA_PITCH = 60;                    // Ángulo de inclinación de la cámara
const CAMERA_ALTITUDE_ABOVE_TERRAIN = 500;  // Altura sobre el terreno (metros)
const ANIMATION_DURATION_SECONDS = 60;      // Duración total de la animación
const CAMERA_ROTATION_DEGREES = 180;        // Grados de rotación durante el vuelo
const LERP_SMOOTHING_FACTOR = 0.1;          // Suavizado de movimiento (0-1)
```

### Modelo 3D Personalizado

Para usar tu propio modelo 3D:

1. Coloca tu archivo `.glb` en `public/models/`
2. Actualiza la referencia en `app/utils/ThreeCustomLayer.ts`:

```typescript
loader.load('/models/tu-modelo.glb', (gltf) => {
  // ...
});
```

---

## 🚀 Uso

### 1. Cargar Ruta GPX
Haz clic en "Ruta GPX" y selecciona tu archivo `.gpx`

### 2. Añadir Fotos (Opcional)
Navega por el mapa, posiciona la cámara y añade fotos en puntos de interés

### 3. Configurar Keyframes (Opcional)
Pausa la animación, mueve la cámara manualmente y captura vistas personalizadas

### 4. Iniciar Animación
Presiona "INICIAR" para comenzar el sobrevuelo cinematográfico

### 5. Grabar Video
Usa herramientas de captura de pantalla (OBS, etc.) para grabar la animación

---

## 🏗️ Arquitectura

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js 15)"]
        A[page.tsx] --> B[ThreeCustomLayer]
        A --> C[Mapbox GL]
        B --> D[Three.js Scene]
        C --> E[Terrain DEM]
    end
    
    subgraph External["APIs Externas"]
        F[Mapbox Styles API]
        G[Mapbox Terrain API]
    end
    
    C --> F
    E --> G
    
    subgraph Data["Datos"]
        H[GPX Files] --> I[@tmcw/togeojson]
        I --> J[GeoJSON]
        J --> A
    end
```

---

## 📁 Estructura del Proyecto

```
flyby-hiking/
├── index.html                    # Prototipo standalone (HTML + JS)
└── mapbox-gpx-viewer/
    ├── app/
    │   ├── page.tsx              # Componente principal
    │   ├── layout.tsx            # Layout con fuentes Geist
    │   ├── globals.css           # Estilos globales + Tailwind
    │   └── utils/
    │       └── ThreeCustomLayer.ts   # Capa 3D personalizada
    ├── public/
    │   └── models/
    │       └── mixtli-model.glb  # Modelo 3D del personaje
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── eslint.config.mjs
    └── postcss.config.mjs
```

---

## 📜 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo en `localhost:3000` |
| `npm run build` | Genera build de producción optimizado |
| `npm run start` | Inicia servidor de producción |
| `npm run lint` | Ejecuta ESLint para análisis de código |

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

<div align="center">

**Desarrollado con ❤️ para la comunidad de senderismo**

[⬆ Volver arriba](#-flyby-hiking)

</div>
]]>
