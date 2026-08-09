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

export function getMountedPcById(id) {
  return apiFirst({
    key: 'montado',
    path: `/api/builds/${encodeURIComponent(id)}`,
    fallback: () => {
      const item = structuredClone(mountedPcsMock.find((pc) => String(pc.id) === String(id)) ?? null)
      return item ? normalizeMountedPc(item) : null
    },
    transform: (payload) => normalizeMountedPc(payload?.montado || payload?.pc || payload),
  })
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
