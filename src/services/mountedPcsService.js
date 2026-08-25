import { mountedPcsMock } from '../data/mountedPcsMock'
import { apiFirst, dataMode, extractList } from './dataSource'
import { apiRequest } from './httpClient'
import { normalizeMountedPc } from './normalizers'
import { inferMountedPcConfiguration } from '../utils/builderConfiguration'
import { savedBuildsService } from './savedBuildsService'


async function hydrateMountedPcRatings(items) {
  if (dataMode === 'mock' || !Array.isArray(items) || !items.length) return items

  const results = await Promise.allSettled(items.map(async (item) => {
    if (item?.id == null) return item
    try {
      const payload = await apiRequest(`/api/builds/${encodeURIComponent(item.id)}/avaliacoes?pagina=1&limite=1`)
      const rating = Number(payload?.avaliacao?.media ?? payload?.mediaAvaliacoes ?? item.rating ?? 0) || 0
      const reviewsCount = Number(payload?.avaliacao?.quantidade ?? payload?.quantidadeAvaliacoes ?? payload?.total ?? item.reviewsCount ?? 0) || 0
      return { ...item, rating, reviewsCount }
    } catch {
      return item
    }
  }))

  return results.map((result, index) => result.status === 'fulfilled' ? result.value : items[index])
}

function rankMountedPcs(items) {
  return [...items]
    .sort((a, b) => {
      const scoreA = a.rating * Math.log10(a.reviewsCount + 10) + Math.min(a.offersCount, 8) * 0.08
      const scoreB = b.rating * Math.log10(b.reviewsCount + 10) + Math.min(b.offersCount, 8) * 0.08
      return scoreB - scoreA
    })
}

export async function getMountedPcs() {
  const items = await apiFirst({
    key: 'montados',
    path: '/api/builds?pagina=1&limite=100',
    fallback: () => structuredClone(mountedPcsMock).map(normalizeMountedPc),
    transform: (payload) => extractList(payload, ['builds', 'montados', 'pcs']).map(normalizeMountedPc),
  })
  return hydrateMountedPcRatings(items)
}

function mergeHardwareCatalog(items = []) {
  const byId = new Map()
  for (const item of items) {
    const hardware = item?.hardware && typeof item.hardware === 'object' ? item.hardware : item
    const id = hardware?.id ?? item?.hardwareId
    if (id == null) continue
    const key = String(id)
    const previous = byId.get(key) || {}
    byId.set(key, {
      ...previous,
      ...hardware,
      id: hardware?.id ?? previous?.id ?? id,
      nome: hardware?.nome || previous?.nome || item?.nome || '',
      categoria: hardware?.categoria || previous?.categoria || item?.categoria || '',
      marca: hardware?.marca || previous?.marca || item?.marca || '',
      modelo: hardware?.modelo || previous?.modelo || item?.modelo || '',
    })
  }
  return byId
}

async function hydrateMountedPcComponents(pc) {
  const components = Array.isArray(pc?.components) ? pc.components : []
  if (!components.length || dataMode === 'mock') return pc

  try {
    const firstPayload = await apiRequest('/api/hardwares')
    let catalogItems = extractList(firstPayload, ['hardwares'])
    const totalPages = Math.max(1, Number(firstPayload?.totalPaginas ?? firstPayload?.paginacao?.totalPaginas ?? 1) || 1)

    if (totalPages > 1) {
      for (let page = 2; page <= totalPages; page += 1) {
        try {
          const payload = await apiRequest(`/api/hardwares?pagina=${page}`)
          catalogItems = catalogItems.concat(extractList(payload, ['hardwares']))
        } catch {
          break
        }
      }
    }

    let catalog = mergeHardwareCatalog(catalogItems)
    const missingComponents = components.filter((component) => {
      const id = component?.hardwareId ?? component?.hardware?.id
      return id != null && !catalog.has(String(id))
    })

    const missingCategories = [...new Set(missingComponents
      .map((component) => component?.categoria ?? component?.hardware?.categoria)
      .filter(Boolean)
      .map((value) => String(value).trim().toUpperCase()))]

    if (missingCategories.length) {
      const results = await Promise.allSettled(missingCategories.map((category) => (
        apiRequest(`/api/hardwares?categoria=${encodeURIComponent(category)}`)
      )))
      const extras = results.flatMap((result) => result.status === 'fulfilled'
        ? extractList(result.value, ['hardwares'])
        : [])
      catalog = mergeHardwareCatalog([...catalog.values(), ...extras])
    }

    return {
      ...pc,
      components: components.map((component) => {
        const hardwareId = component?.hardwareId ?? component?.hardware?.id
        const catalogHardware = hardwareId == null ? null : catalog.get(String(hardwareId))
        const existingHardware = component?.hardware && typeof component.hardware === 'object' ? component.hardware : {}
        const hardware = catalogHardware ? { ...catalogHardware, ...existingHardware,
          nome: existingHardware?.nome || catalogHardware?.nome || component?.nome || '',
          categoria: existingHardware?.categoria || catalogHardware?.categoria || component?.categoria || '',
          marca: existingHardware?.marca || catalogHardware?.marca || '',
          modelo: existingHardware?.modelo || catalogHardware?.modelo || '',
        } : existingHardware
        return {
          ...component,
          hardware,
          nome: component?.nome || hardware?.nome || '',
          categoria: component?.categoria || hardware?.categoria || '',
        }
      }),
    }
  } catch {
    return pc
  }
}

export async function getMountedPcById(id) {
  const pc = await apiFirst({
    key: 'montado',
    path: `/api/builds/${encodeURIComponent(id)}`,
    fallback: () => {
      const item = structuredClone(mountedPcsMock.find((pc) => String(pc.id) === String(id)) ?? null)
      return item ? normalizeMountedPc(item) : null
    },
    transform: (payload) => normalizeMountedPc(payload?.build || payload?.montado || payload?.pc || payload),
  })
  return hydrateMountedPcComponents(pc)
}

export async function getFeaturedMountedPcs() {
  const items = await apiFirst({
    key: 'montados-destaques',
    path: '/api/builds?pagina=1&limite=24',
    fallback: () => rankMountedPcs(structuredClone(mountedPcsMock).map(normalizeMountedPc)).slice(0, 4),
    transform: (payload) => extractList(payload, ['builds', 'montados']).map(normalizeMountedPc),
  })
  return rankMountedPcs(await hydrateMountedPcRatings(items)).slice(0, 4)
}

export function getMountedPcBuilderPath(pc) {
  const configuracao = inferMountedPcConfiguration(pc)
  return savedBuildsService.createBuilderPath({ configuracao })
}
