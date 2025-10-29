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

# configurar variables de entorno del frontend
cat <<'ENV' > .env.local
VITE_API_BASE_URL=https://REGION-PROJECT.cloudfunctions.net/calendar-api
VITE_PROPERTY_ID=default-property
# credenciales codificadas en base64 con formato usuario:password
VITE_API_BASIC_AUTH=bXktdXNlcjpteS1wYXNz
ENV

# levantar el frontend (http://localhost:5173)
npm run dev

# comprobaciones rápidas
npm run lint
npm run build
```

### Probar la Cloud Function en local

```bash
cd functions
npm install
npm run build
npm run dev   # expone calendarApi en http://localhost:8080
```

Las rutas expuestas (con Basic Auth) son:

- `GET /health` – chequeo de vida (no requiere auth).
- `GET /properties/:propertyId/events` – lista de eventos persistidos en Firestore.
- `POST /properties/:propertyId/events` – crea un evento manual (`title`, `start`, `end`).
- `DELETE /properties/:propertyId/events/:eventId` – elimina un evento.
- `POST /properties/:propertyId/airbnb/sync` – recibe `{ icalUrl, includeTentative? }`, descarga el feed de Airbnb y reemplaza los eventos fuente `airbnb`.

> Los feeds iCal de Airbnb tienen la forma `https://www.airbnb.com/calendar/ical/<listing_id>/<secret>.ics` y se obtienen desde _Disponibilidad → Exportar calendario_ en el panel del hospedaje.

> Define las variables `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD` al lanzar `npm run dev` para autenticarte en local (`ALLOW_UNAUTHENTICATED=true` desactiva el check para pruebas).

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
