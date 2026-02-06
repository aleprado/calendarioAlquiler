# Calendario de Alquileres

Aplicación web estilo Google Calendar para gestionar reservas de alojamientos. El frontend está construido con React + Vite y consume una Cloud Function (Node.js) que persiste los eventos en Firestore y sincroniza reservas provenientes del iCal de Airbnb.

## Carpetas principales

- `src/` – SPA en React.
- `functions/` – Cloud Function HTTP escrita en TypeScript (calendar API + sincronización Airbnb).
- `terraform/` – Infraestructura como código (GCP: Firestore, Cloud Function, IAM, bucket de despliegue).
- `.github/workflows/` – Pipeline de GitHub Actions para build y despliegue automático.

## Desarrollo local

```bash
# instalar dependencias de la app
npm install
npm --prefix functions install

# configurar variables de entorno del frontend
cat <<'ENV' > .env.local
VITE_API_BASE_URL=http://localhost:8080
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
# opcionales
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_GOOGLE_MAPS_EMBED_API_KEY=...
ENV

# compilar y levantar la Cloud Function local (http://localhost:8080)
npm --prefix functions run build
npm --prefix functions run dev

# en otra terminal, levantar frontend (http://localhost:5173)
npm run dev
```

La API espera `Bearer <Firebase ID Token>` en rutas privadas (`/properties/*`). Antes de correr la Function local, configura credenciales de Firebase Admin:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/service-account.json
```

Rutas relevantes:

- `GET /health` (sin auth)
- `GET|POST|PATCH /properties/...` (auth requerida)
- `POST /properties/resolve-map-link` (auth requerida)
- `POST /properties/import-google-photos` (auth requerida)
- `GET /public/properties/:publicSlug` (sin auth)
- `POST /public/properties/:publicSlug/requests` (sin auth)

> Los feeds iCal de Airbnb tienen la forma `https://www.airbnb.com/calendar/ical/<listing_id>/<secret>.ics` y se obtienen desde _Disponibilidad → Exportar calendario_ en el panel del hospedaje.

## Despliegue con Terraform

```bash
npm --prefix functions install
npm --prefix functions run build
cd terraform
terraform init
terraform plan \
  -var="project_id=tu-proyecto" \
  -var="basic_auth_username=usuario" \
  -var="basic_auth_password=contraseña-segura"
terraform apply \
  -var="project_id=tu-proyecto" \
  -var="basic_auth_username=usuario" \
  -var="basic_auth_password=contraseña-segura"
```

El output `calendar_api_uri` devuelve la URL pública de la Cloud Function.

## CI/CD (GitHub Actions)

`deploy.yml` se ejecuta en cada push a `main`:

1. Lint + build del frontend.
2. Deploy a Firebase Hosting usando el artefacto generado (lee el JSON del service account ubicado en la raíz del repo).
3. Lint + build de las funciones, `terraform plan` y `terraform apply` para la infraestructura (Cloud Function + Firestore) reutilizando ese mismo JSON.

### Secrets requeridos

| Secret | Uso |
| --- | --- |
| `FIREBASE_PROJECT_ID` | ID del proyecto Firebase/GCP. |
| `GCP_PROJECT_ID` | Proyecto de GCP donde se desplegará todo. |
| `GCP_FUNCTION_BASIC_AUTH_USER` | Usuario para la autenticación básica. |
| `GCP_FUNCTION_BASIC_AUTH_PASSWORD` | Contraseña para la autenticación básica. |
| `SENDGRID_API_KEY` | Clave de API para SendGrid (notificaciones por correo). |
| `NOTIFY_FROM_EMAIL` | Dirección remitente verificada en SendGrid. |

> ⚠️ Por simplicidad el workflow lee el archivo `calendarioalquiler-60e74-231618c6a9bb.json` del repositorio. Evita exponerlo en repos públicos; lo ideal es mantenerlo fuera del control de versiones y cargarlo como secret en GitHub.

## Próximos pasos

- Integrar un mecanismo de sincronización periódica de iCal (scheduler / PubSub).
- Gestionar múltiples alojamientos y usuarios (rol-based access).
- Añadir persistencia de configuraciones (URLs iCal) y panel de administración seguro.
