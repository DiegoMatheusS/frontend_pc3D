import { ApiError, apiRequest } from './httpClient'

const DEFAULT_DATA_MODE = import.meta.env.PROD ? 'api' : 'auto'
const DATA_MODE = String(import.meta.env.VITE_DATA_MODE || DEFAULT_DATA_MODE).toLowerCase()
const state = {
  sources: {},
  updatedAt: null,
}
let snapshot = Object.freeze({ sources: {}, updatedAt: null })
const listeners = new Set()

function emit() {
  state.updatedAt = new Date().toISOString()
  snapshot = Object.freeze({
    sources: { ...state.sources },
    updatedAt: state.updatedAt,
  })
  listeners.forEach((listener) => listener(snapshot))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pcbuilder:data-source', { detail: snapshot }))
}

export function reportDataSource(key, source, error = null) {
  state.sources[key] = {
    source,
    error: error ? String(error.message || error) : null,
    status: error?.status || 0,
    at: new Date().toISOString(),
  }
  emit()
}

export function subscribeDataSources(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDataSourcesSnapshot() {
  return snapshot
}

export function extractList(payload, preferredKeys = []) {
  if (Array.isArray(payload)) return payload
  for (const key of [...preferredKeys, 'items', 'dados', 'data', 'resultados', 'results']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

export async function apiFirst({ key, path, options, fallback, transform = (value) => value }) {
  if (DATA_MODE === 'mock') {
    reportDataSource(key, 'mock')
    return typeof fallback === 'function' ? fallback() : fallback
  }

  try {
    const payload = await apiRequest(path, options)
    const result = transform(payload)
    reportDataSource(key, 'api')
    return result
  } catch (error) {
    if (DATA_MODE === 'api') throw error

    const canFallback = error instanceof ApiError || error instanceof TypeError || error instanceof Error
    if (!canFallback) throw error

    reportDataSource(key, 'mock', error)
    return typeof fallback === 'function' ? fallback(error) : fallback
  }
}

export const dataMode = DATA_MODE

export async function apiWriteFirst({ key, path, options, fallback, transform = (value) => value, fallbackStatuses = [0, 404, 405, 501] }) {
  if (DATA_MODE === 'mock') {
    reportDataSource(key, 'mock')
    return typeof fallback === 'function' ? fallback() : fallback
  }

  try {
    const payload = await apiRequest(path, options)
    const result = transform(payload)
    reportDataSource(key, 'api')
    return result
  } catch (error) {
    if (DATA_MODE === 'api') throw error

    const status = Number(error?.status || 0)
    if (!fallbackStatuses.includes(status)) throw error

    reportDataSource(key, 'mock', error)
    return typeof fallback === 'function' ? fallback(error) : fallback
  }
}
