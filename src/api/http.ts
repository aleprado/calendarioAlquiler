import { getFirebaseAuth } from '../lib/firebase'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

const normalizeBaseUrl = (url: string) => (url.endsWith('/') ? url.slice(0, -1) : url)
const baseUrl = API_BASE_URL ? normalizeBaseUrl(API_BASE_URL) : ''

const ensureBaseUrl = () => {
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL no está configurado.')
  }
  return baseUrl
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean
  json?: unknown
}

const ensureIdToken = async () => {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('Usuario no autenticado')
  }
  return await user.getIdToken()
}

export const apiRequest = async <T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const { auth = false, json, headers, ...requestInit } = options

  const requestHeaders = new Headers(headers ?? {})
  if (!requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = await ensureIdToken()
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  const body = json !== undefined ? JSON.stringify(json) : undefined

  const response = await fetch(`${ensureBaseUrl()}${path}`, {
    ...requestInit,
    headers: requestHeaders,
    body,
  })

  const text = await response.text()
  let payload: unknown = undefined
  if (text) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message ?? 'No se pudo completar la operación.')
        : 'No se pudo completar la operación.'
    throw new Error(message)
  }

  return payload as T
}
