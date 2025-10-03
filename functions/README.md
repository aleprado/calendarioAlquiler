# Airbnb Calendar Cloud Functions

Función HTTP pensada para ejecutarse en Google Cloud Functions y exponer una API REST que sincroniza y persiste reservas de Airbnb (feed iCal) junto con eventos manuales.

## Endpoints

- `GET /health`: chequeo de vida (sin auth).
- `GET /properties/:propertyId/events`: lista de eventos guardados en Firestore.
- `POST /properties/:propertyId/events`: crea un evento manual.
- `DELETE /properties/:propertyId/events/:eventId`: elimina un evento.
- `POST /properties/:propertyId/airbnb/sync`: descarga el feed iCal de Airbnb y reemplaza los eventos con origen `airbnb`.

## Desarrollo local

```bash
cd functions
npm install
npm run build
npm run dev

# ejecutar peticiones autenticadas
# export BASIC_AUTH_USER=usuario BASIC_AUTH_PASSWORD=secreto antes de curl/postman
```

La ejecución local levanta `functions-framework` escuchando en `localhost:8080` y exponiendo la función `syncAirbnbCalendar`.

## Deploy manual (ejemplo)

```bash
# asegurarse de tener autenticado gcloud y el proyecto correcto
npm run build
gcloud functions deploy syncAirbnbCalendar \
  --runtime=nodejs20 \
  --region=us-central1 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point=syncAirbnbCalendar
```

Ajusta la región/permisos según tus necesidades y repite para la función `health` si deseas desplegarla de forma independiente.
