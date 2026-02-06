# Onboarding Rápido

- **Stack**: React 19 + Vite + TypeScript, `react-big-calendar` con `date-fns` (locale es), Firebase en `src/api`.
- **Instalar**: `npm install`
- **Correr**: `npm run dev`
- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Páginas**: `src/pages/DashboardPage.tsx` (panel privado), `src/pages/PublicPropertyPage.tsx` (vista pública), `src/pages/LandingPage.tsx` (marketing).
- **Componentes clave**: `src/components/PropertyWorkspace.tsx` (lógica de calendario y eventos), `src/components/MultiMonthCalendar.tsx` (layout de meses), modales en `src/components/*Modal.tsx`.
- **Estilos**: CSS global en `src/App.css` (incluye la skin de `react-big-calendar`).
- **Localización de fechas**: `src/lib/dateLocalizer.ts` agrega locale es y primer día de semana.
- **Tipos**: `src/types.ts` centraliza tipos de eventos/propiedades/payloads de API.

## Reglas rápidas de calendario
- Eventos con origen `airbnb` y `public` se normalizan a medianoche local en `PropertyWorkspace.tsx` y `PublicPropertyPage.tsx`.
- El multi-mes muestra 12 meses desde el actual y **no recorta eventos**: solo filtra los que cruzan el mes para evitar “cortes” visuales.
- Estilos de días: `calendar-day--blocked` y `calendar-day--pending` se aplican vía `dayPropGetter`.

## Flujo de eventos (privado)
1) Al montar `PropertyWorkspace` se sincroniza Airbnb (`syncAirbnb`) y luego `fetchEvents`.
2) Los eventos se transforman con `toCalendarEvent` (normalización y flags `duplicateWithAirbnb`).
3) Creación manual: selección en calendario → `EventFormModal` → `createEvent`.
4) Solicitudes públicas pendientes (`source === 'public'`) se aceptan/declinan desde `EventDetailsModal` (`updateEventStatus`).
5) Eliminación disponible excepto para eventos `airbnb`.

## Flujo de disponibilidad pública
- `PublicPropertyPage` carga `fetchPublicAvailability(publicSlug)` y pinta bloqueos/pending en el calendario.
- Selecciones que intersectan eventos existentes muestran modal de “no disponible”; si está libre se abre `RequestFormModal` y se envía a `submitPublicRequest`.

## Layout/UX
- `MultiMonthCalendar` usa un grid responsivo (1 col en mobile, 2 en desktop) en `src/App.css`.
- Eventos que continúan entre meses siguen mostrando las “burbujas” `continuesPrior/continuesAfter` de `react-big-calendar` para comunicar continuidad.
