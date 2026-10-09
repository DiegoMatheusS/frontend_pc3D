const VERSION = 1
const sessions = new Map()

function initialState(type) {
  if (type === 'hardware') return {
    categoria: 'PROCESSADOR', marca: '', statusFilter: '', pagina: 1, limite: 50,
    result: null, selected: new Set(), error: '', batchErrors: {}, batchSummary: null,
    iaTecnicaErrors: {}, loading: false, addingIds: new Set(), batchBusy: false,
    metaAiBusyIds: new Set(), iaTecnicaBusyIds: new Set(),
  }
  if (type === 'offers') return {
    query: '', onlyPromotions: false, limit: 24, results: [], searchWarnings: [],
    analyses: {}, catalogReviews: {}, error: '', loading: false,
    analyzingId: null, checkingId: null,
  }
  throw new Error('Tipo de descoberta inválido.')
}

const TRANSIENT_FIELDS = new Set([
  'loading', 'addingIds', 'batchBusy', 'metaAiBusyIds', 'iaTecnicaBusyIds',
  'analyzingId', 'checkingId',
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function restoreState(defaults, saved) {
  if (saved?.version !== VERSION || !isRecord(saved.state)) return defaults
  const state = { ...defaults }
  for (const [field, fallback] of Object.entries(defaults)) {
    if (TRANSIENT_FIELDS.has(field)) continue
    const value = saved.state[field]
    if (fallback instanceof Set) {
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) state[field] = new Set(value)
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) {
        state[field] = field === 'results' ? value.filter(isRecord) : value.filter((item) => typeof item === 'string')
      }
    } else if (fallback === null) {
      if (isRecord(value) && (field !== 'result' || Array.isArray(value.itens))) {
        state[field] = field === 'result' ? { ...value, itens: value.itens.filter(isRecord) } : value
      }
    } else if (isRecord(fallback)) {
      if (isRecord(value)) state[field] = value
    } else if (typeof value === typeof fallback && (typeof value !== 'number' || (Number.isFinite(value) && value > 0))) {
      state[field] = value
    }
  }
  return state
}

// O estado vive fora da página: respostas recebidas depois de trocar de rota
// ainda atualizam a sessão. Apenas dados concluídos são salvos para recargas.
export function createDiscoverySession(type, storage, storageKey) {
  let state = initialState(type)
  const listeners = new Set()
  try {
    state = restoreState(state, JSON.parse(storage?.getItem(storageKey) || 'null'))
  } catch { /* Cache ausente, inválido ou bloqueado: usa o estado inicial. */ }

  function persist() {
    const saved = {}
    for (const [field, value] of Object.entries(state)) {
      if (!TRANSIENT_FIELDS.has(field)) saved[field] = value instanceof Set ? [...value] : value
    }
    try {
      storage?.setItem(storageKey, JSON.stringify({ version: VERSION, state: saved }))
    } catch { /* Sem armazenamento, a navegação continua preservada em memória. */ }
  }

  const setters = Object.fromEntries(Object.keys(state).map((field) => [
    `set${field[0].toUpperCase()}${field.slice(1)}`,
    (value) => {
      const next = typeof value === 'function' ? value(state[field]) : value
      if (Object.is(next, state[field])) return
      state = { ...state, [field]: next }
      if (!TRANSIENT_FIELDS.has(field)) persist()
      listeners.forEach((listener) => listener())
    },
  ]))

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setters,
  }
}

export function getDiscoverySession(type, userId) {
  const key = `criabyteAdminDiscovery:v${VERSION}:${encodeURIComponent(userId)}:${type}`
  if (!sessions.has(key)) {
    let storage
    try { storage = userId ? globalThis.window?.sessionStorage : undefined } catch { /* opcional */ }
    sessions.set(key, createDiscoverySession(type, storage, key))
  }
  return sessions.get(key)
}
