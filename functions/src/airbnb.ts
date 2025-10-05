/**
 * Utilidades para obtener y parsear el iCal de Airbnb.
 * Cambios clave:
 *  - Nunca retornamos campos con `undefined` (solo agregamos si existen)
 *  - Estructura compatible con replaceAirbnbEvents()
 */

type ParsedEvent = {
  id?: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
  status?: 'confirmed' | 'tentative'
}

export async function downloadIcs(url: string): Promise<string> {
  // En Node 18+ `fetch` está disponible nativamente en Cloud Functions Gen2
  const resp = await fetch(url)
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`iCal fetch error: ${resp.status} ${txt}`)
  }
  return await resp.text()
}

/**
 * Parser minimalista de .ics:
 * - Separa por "BEGIN:VEVENT" ... "END:VEVENT"
 * - Extrae SUMMARY/DTSTART/DTEND/LOCATION/DESCRIPTION/STATUS/UID
 * - Devuelve dos listas: confirmed y (opcionalmente) tentative
 */
export function parseAirbnbIcs(
  icsRaw: string,
  includeTentative: boolean,
): { confirmed: ParsedEvent[]; tentative: ParsedEvent[] } {
  const blocks = icsRaw.split(/BEGIN:VEVENT\r?\n/).slice(1) // ignora cabecera
  const confirmed: ParsedEvent[] = []
  const tentative: ParsedEvent[] = []

  const rx = {
    uid: /^UID:(.+)$/m,
    summary: /^SUMMARY:(.+)$/m,
    dtStart: /^DTSTART(?:;[^:]+)?:([0-9TZ]+)$/m,
    dtEnd: /^DTEND(?:;[^:]+)?:([0-9TZ]+)$/m,
    location: /^LOCATION:(.+)$/m,
    description: /^DESCRIPTION:(.+)$/m,
    status: /^STATUS:(.+)$/m,
  }

  for (const raw of blocks) {
    const block = raw.split(/END:VEVENT/)[0]

    const uid = (block.match(rx.uid)?.[1] ?? '').trim()
    const summary = (block.match(rx.summary)?.[1] ?? '').trim()
    const dtStart = (block.match(rx.dtStart)?.[1] ?? '').trim()
    const dtEnd = (block.match(rx.dtEnd)?.[1] ?? '').trim()
    const location = (block.match(rx.location)?.[1] ?? '').trim()
    const description = (block.match(rx.description)?.[1] ?? '').trim()
    const statusRaw = (block.match(rx.status)?.[1] ?? '').trim().toUpperCase()

    // Fechas en ISO (asumiendo UTC si terminan con Z o formato yyyymmdd)
    const toIso = (s: string): string => {
      if (!s) return ''
      // Ej: 20251010T120000Z o 20251010T120000
      if (/^\d{8}T\d{6}Z?$/.test(s)) {
        const iso = s.endsWith('Z')
          ? s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')
          : s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6')
        return iso.endsWith('Z') ? iso : `${iso}Z`
      }
      // Ej: 20251010 (all-day)
      if (/^\d{8}$/.test(s)) {
        return s.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3T00:00:00Z')
      }
      return s // fallback
    }

    const startIso = toIso(dtStart)
    const endIso = toIso(dtEnd)

    if (!summary || !startIso || !endIso) continue

    // Construye el evento sin undefined: solo agrega si hay valor
    const ev: ParsedEvent = {
      title: summary,
      start: startIso,
      end: endIso,
      status: statusRaw === 'TENTATIVE' ? 'tentative' : 'confirmed',
    }
    if (uid) ev.id = uid
    if (description) ev.description = description
    if (location) ev.location = location

    if (ev.status === 'tentative') {
      if (includeTentative) tentative.push(ev)
    } else {
      confirmed.push(ev)
    }
  }

  return { confirmed, tentative }
}
