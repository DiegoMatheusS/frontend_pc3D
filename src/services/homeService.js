import { getFeaturedMountedPcs as getMountedHighlights } from './mountedPcsService'
import { apiFirst } from './dataSource'
import { normalizeOfferItem } from './normalizers'

const offerGroupDefinitions = [
  ['hardwares', 'Hardwares', 'Processadores, placas de vídeo, memória, armazenamento e outros componentes.'],
  ['perifericos', 'Periféricos', 'Mouse, teclado, headset e acessórios para completar o uso do computador.'],
  ['monitores', 'Monitores', 'Opções para jogos, produtividade e criação, separadas do restante do catálogo.'],
  ['notebooks', 'Notebooks', 'Notebooks com ofertas reais cadastradas no catálogo.'],
  ['setup', 'Setup', 'Itens para completar o ambiente e o setup.'],
]

function discountOf(item) {
  const current = Number(item?.price || 0)
  const previous = Number(item?.previousPrice || 0)
  if (!current || !previous || previous <= current) return 0
  return ((previous - current) / previous) * 100
}

function bestDiscountFirst(items) {
  return [...items].sort((a, b) => {
    const discountDifference = discountOf(b) - discountOf(a)
    if (discountDifference) return discountDifference
    return Number(a?.price || 0) - Number(b?.price || 0)
  })
}

export async function getFeaturedMountedPcs() {
  return getMountedHighlights()
}

export function getFeaturedOfferGroups() {
  return apiFirst({
    key: 'ofertas-destaques',
    path: '/api/ofertas/destaques',
    // A Home também exibe somente ofertas reais da API.
    fallback: () => [],
    transform: (payload) => {
      const directList = Array.isArray(payload) ? payload : Array.isArray(payload?.ofertas) ? payload.ofertas : []
      const normalizedDirect = directList.map(normalizeOfferItem)

      return offerGroupDefinitions
        .map(([id, label, description]) => {
          const products = Array.isArray(payload?.[id])
            ? payload[id].map(normalizeOfferItem)
            : normalizedDirect.filter((item) => item.group === id)

          return {
            id,
            label,
            description,
            products: bestDiscountFirst(products).slice(0, 10),
          }
        })
        .filter((group) => group.products.length)
    },
  })
}
