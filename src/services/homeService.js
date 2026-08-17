import { offerGroupsMock } from '../data/homeMock'
import { getFeaturedMountedPcs as getMountedHighlights } from './mountedPcsService'
import { apiFirst } from './dataSource'
import { normalizeOfferItem } from './normalizers'

export async function getFeaturedMountedPcs() {
  return getMountedHighlights()
}

export function getFeaturedOfferGroups() {
  return apiFirst({
    key: 'ofertas-destaques',
    path: '/api/ofertas/destaques',
    fallback: () => structuredClone(offerGroupsMock),
    transform: (payload) => {
      const definitions = [
        ['hardwares', 'Hardwares'],
        ['perifericos', 'Periféricos'],
        ['monitores', 'Monitores'],
        ['notebooks', 'Notebooks'],
        ['setup', 'Setup'],
      ]
      const directList = Array.isArray(payload) ? payload : Array.isArray(payload?.ofertas) ? payload.ofertas : []
      const normalizedDirect = directList.map(normalizeOfferItem)

      return definitions
        .map(([id, label]) => ({
          id,
          label,
          description: offerGroupsMock.find((group) => group.id === id)?.description || '',
          products: Array.isArray(payload?.[id])
            ? payload[id].map(normalizeOfferItem).slice(0, 10)
            : normalizedDirect.filter((item) => item.group === id).slice(0, 10),
        }))
        .filter((group) => group.products.length)
    },
  })
}
