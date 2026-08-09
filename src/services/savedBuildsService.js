const DRAFT_KEY = 'pcBuilderRascunhoBuild'
const SAVED_PREFIX = 'pcBuilderBuildsSalvas:'
const MAX_BUILDS = 60

const categoryLabels = {
  gabinete: 'Gabinete',
  processador: 'Processador',
  placamae: 'Placa-mãe',
  cooler: 'Cooler',
  memoria: 'Memória RAM',
  placavideo: 'Placa de vídeo',
  armazenamento: 'Armazenamento',
  fonte: 'Fonte',
  ventoinhas: 'Ventoinha',
}

function storageKey(email = '') {
  return `${SAVED_PREFIX}${encodeURIComponent(String(email).trim().toLowerCase())}`
}

function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function readBuilds(email) {
  const data = safeParse(localStorage.getItem(storageKey(email)) || '[]', [])
  return Array.isArray(data) ? data : []
}

function writeBuilds(email, builds) {
  const limited = Array.isArray(builds) ? builds.slice(0, MAX_BUILDS) : []
  localStorage.setItem(storageKey(email), JSON.stringify(limited))
  return limited
}

function getId(value) {
  if (value && typeof value === 'object') return value.id ?? value.hardwareId ?? value.nome ?? null
  return value
}

function flattenConfiguration(configuration = {}) {
  const components = []

  Object.entries(configuration || {}).forEach(([category, rawValue]) => {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    values.forEach((value, index) => {
      const id = getId(value)
      if (!id) return
      const categoryName = categoryLabels[category] || category
      const name = value && typeof value === 'object'
        ? value.nome || value.name || value.modelo || String(id)
        : String(id)

      components.push({
        categoria: categoryName,
        slot: Array.isArray(rawValue) ? `${categoryName} ${index + 1}` : categoryName,
        nome: name,
        preco: Number(value?.preco) || 0,
      })
    })
  })

  return components
}

function hasComponents(configuration = {}) {
  return Object.values(configuration || {}).some((value) => (
    Array.isArray(value) ? value.some(Boolean) : Boolean(value)
  ))
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

function buildFromConfiguration(configuration, name = 'Build importada', metadata = {}) {
  if (!hasComponents(configuration)) {
    throw new Error('A configuração não possui componentes válidos.')
  }

  const now = new Date().toISOString()
  const components = Array.isArray(metadata.componentes) && metadata.componentes.length
    ? metadata.componentes
    : flattenConfiguration(configuration)

  return {
    id: typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `build-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    nome: name,
    criadaEm: metadata.criadaEm || now,
    atualizadaEm: now,
    precoTotal: Number(metadata.precoTotal) || 0,
    consumoTotal: Number(metadata.consumoTotal) || 0,
    quantidade: Number(metadata.quantidade) || components.length,
    ...(metadata.communityBuildId ? { communityBuildId: Number(metadata.communityBuildId) || metadata.communityBuildId } : {}),
    configuracao: configuration,
    componentes: components,
  }
}

export const savedBuildsService = {
  list(email) {
    return readBuilds(email)
  },

  get(email, id) {
    return readBuilds(email).find((build) => String(build.id) === String(id)) || null
  },

  findByCommunityBuildId(email, communityBuildId) {
    return readBuilds(email).find((build) => String(build.communityBuildId || '') === String(communityBuildId || '')) || null
  },

  rename(email, id, name) {
    const builds = readBuilds(email)
    const target = builds.find((build) => String(build.id) === String(id))
    if (!target) return builds

    target.nome = String(name || '').trim() || target.nome || 'Minha build'
    target.atualizadaEm = new Date().toISOString()
    return writeBuilds(email, builds)
  },

  remove(email, id) {
    return writeBuilds(email, readBuilds(email).filter((build) => String(build.id) !== String(id)))
  },

  getDraft() {
    const draft = safeParse(localStorage.getItem(DRAFT_KEY) || 'null', null)
    return draft?.configuracao && hasComponents(draft.configuracao) ? draft : null
  },

  saveDraft(email, draft, name) {
    const build = buildFromConfiguration(draft.configuracao, name)
    return writeBuilds(email, [build, ...readBuilds(email)])
  },

  saveConfiguration(email, configuration, name, metadata = {}) {
    const build = buildFromConfiguration(configuration, name, metadata)
    const builds = writeBuilds(email, [build, ...readBuilds(email)])
    return { build, builds }
  },

  updateConfiguration(email, id, configuration, metadata = {}) {
    if (!hasComponents(configuration)) {
      throw new Error('A configuração não possui componentes válidos.')
    }

    const builds = readBuilds(email)
    const index = builds.findIndex((build) => String(build.id) === String(id))
    if (index < 0) return null

    const current = builds[index]
    const components = Array.isArray(metadata.componentes) && metadata.componentes.length
      ? metadata.componentes
      : flattenConfiguration(configuration)

    const updated = {
      ...current,
      nome: String(metadata.nome ?? current.nome ?? 'Minha build').trim() || 'Minha build',
      criadaEm: current.criadaEm || new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
      precoTotal: Object.prototype.hasOwnProperty.call(metadata, 'precoTotal') ? Number(metadata.precoTotal) || 0 : Number(current.precoTotal) || 0,
      consumoTotal: Object.prototype.hasOwnProperty.call(metadata, 'consumoTotal') ? Number(metadata.consumoTotal) || 0 : Number(current.consumoTotal) || 0,
      quantidade: Object.prototype.hasOwnProperty.call(metadata, 'quantidade') ? Number(metadata.quantidade) || components.length : Number(current.quantidade) || components.length,
      communityBuildId: Object.prototype.hasOwnProperty.call(metadata, 'communityBuildId')
        ? (Number(metadata.communityBuildId) || metadata.communityBuildId || null)
        : (current.communityBuildId ?? null),
      configuracao: configuration,
      componentes: components,
    }

    const remaining = builds.filter((_, buildIndex) => buildIndex !== index)
    return { build: updated, builds: writeBuilds(email, [updated, ...remaining]) }
  },

  createBuilderPath(build, { edit = false } = {}) {
    const params = new URLSearchParams()
    params.set('build', encodeBase64Url({ versao: 2, configuracao: build.configuracao }))
    if (edit && build?.id) params.set('editar', String(build.id))
    return `/montar?${params.toString()}`
  },

  createEditBuilderPath(build) {
    return this.createBuilderPath(build, { edit: true })
  },

  createBuilderUrl(build, options) {
    return new URL(this.createBuilderPath(build, options), window.location.origin).toString()
  },

  createEditBuilderUrl(build) {
    return new URL(this.createEditBuilderPath(build), window.location.origin).toString()
  },

  createLegacyUrl(build) {
    return this.createBuilderUrl(build)
  },

  importFromSharedUrl(email, rawUrl, customName = '') {
    let url
    try {
      url = new URL(String(rawUrl).trim())
    } catch {
      throw new Error('Cole um link válido de uma build compartilhada.')
    }

    const encoded = url.searchParams.get('build')
    if (!encoded) throw new Error('O link não contém uma build compartilhada.')

    let payload
    try {
      payload = decodeBase64Url(encoded)
    } catch {
      throw new Error('Não foi possível ler os dados dessa build.')
    }

    const configuration = payload?.configuracao || payload?.configuration
    const name = String(customName || '').trim() || 'Build importada'
    const build = buildFromConfiguration(configuration, name)
    const builds = writeBuilds(email, [build, ...readBuilds(email)])
    return { build, builds }
  },

  exportJson(build) {
    return JSON.stringify({
      versao: 1,
      exportadoEm: new Date().toISOString(),
      build,
    }, null, 2)
  },

  isLegacySameOrigin() {
    return true
  },
}
