# Notas de calendario y eventos

## Normalización de fechas
- Airbnb envía medianoches UTC; se convierten a medianoche local en `PropertyWorkspace.toCalendarEvent` y `PublicPropertyPage`.
- Si un fin es igual o anterior al inicio, se ajusta a +1 día para garantizar rangos válidos.
- Se usan claves `YYYY-MM-DD` (`toUtcDateKey`) para mapear estados de día.

## Fuentes y estados
- `source`: `manual`, `airbnb`, `public`.
- `status`: `confirmed`, `tentative`, `pending`, `declined`.
- Un evento público `pending` no se trata como bloqueo “manual”; solo se bloquea si se confirma.
- Eventos manuales/públicos confirmados que se superponen con Airbnb confirmado se marcan con `duplicateWithAirbnb` y el Airbnb queda oculto para evitar duplicados.

## Render en multi-mes
- `MultiMonthCalendar` muestra 12 meses desde el actual.
- Los eventos **no se recortan**: se filtran los que cruzan el mes (`filterEventsForMonth`), conservando inicio/fin original para que los indicadores `continuesPrior/continuesAfter` mantengan continuidad visual.
- `MonthEventRenderer`:
  - Airbnb: texto “Reservado/Tentativo en Airbnb”.
  - Público pendiente: “Solicitud pendiente”; declinado muestra estilo atenuado.
  - Manual/público confirmado: badge “Bloqueado en Airbnb” o “No bloqueado en Airbnb” según duplicidad.
  - Se oculta contenido en celdas fuera del mes visible para evitar artefactos.

## Selección y bloqueos
- Propietario: `PropertyWorkspace.handleSelectSlot` abre `EventFormModal` con rango seleccionado.
- Público: `PublicPropertyPage.handleSelectSlot` evita rangos que se superponen con eventos (pending/confirmed) y abre `RequestFormModal` solo si está libre.
- Coloreo de días (vista pública):
  - `calendar-day--blocked`: día ocupado.
  - `calendar-day--pending`: día con solicitud pendiente (solo se usa si no hay bloqueo confirmado).
