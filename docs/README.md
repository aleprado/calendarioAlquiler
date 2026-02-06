# Onboarding Rapido

## Stack
- Frontend: React 19 + Vite + TypeScript.
- Backend: Cloud Function HTTP (Express + TypeScript) en `functions/`.
- Auth: Firebase Auth (Google login).
- Datos: Firestore.

## Como correr en local
1. Instala dependencias:
```bash
npm install
npm --prefix functions install
```

2. Crea `.env.local` en la raiz:
```bash
VITE_API_BASE_URL=http://localhost:8080
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
# opcionales:
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_GOOGLE_MAPS_EMBED_API_KEY=...
```

3. Configura credenciales de Firebase Admin para la API:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/service-account.json
```

4. Levanta backend y frontend en terminales separadas:
```bash
npm --prefix functions run build
npm --prefix functions run dev
```

```bash
npm run dev
```

## Rutas principales
- `/` landing.
- `/dashboard` panel privado.
- `/public/:publicSlug` pagina promocional.
- `/public/:publicSlug/calendario` calendario publico para solicitud de reserva.

## Flujos clave
- En gestion puedes:
  - Detectar pin de Google Maps desde links largos o cortos (`maps.app.goo.gl`).
  - Activar/desactivar visibilidad de resenas de Google Maps.
  - Importar imagenes desde un album de Google Fotos sin subir archivos a storage.
  - Cargar URLs de posts de Instagram para mostrar preview embebido.

- En la web publica:
  - La promo muestra hero, galeria, ubicacion y bloque de Instagram.
  - El calendario de disponibilidad se maneja en la ruta separada `/calendario`.

## Comandos utiles
- Frontend lint: `npm run lint`
- Frontend build: `npm run build`
- Backend lint: `npm --prefix functions run lint`
- Backend build: `npm --prefix functions run build`
