import { findExistingProductFromAi } from './catalogMatching.js'
import { findExistingHardwareFromAi } from './hardwareMatching.js'

// PCs e notebooks são anúncios comerciais: o catálogo de peças é consultado
// somente quando precisamos reconciliar um Hardware individual.
export async function resolveOfferRegistration(preview, destination, catalog) {
  const products = await catalog.products.list()
  const productMatch = findExistingProductFromAi(products, preview)
  if (productMatch.product || productMatch.ambiguous.length || destination !== 'HARDWARE') {
    return { ...productMatch, hardware: null }
  }
  const hardwares = await catalog.hardwares.list()
  const match = findExistingHardwareFromAi(hardwares, preview)
  const linked = match.hardware && products.find(product => Number(product.id)
    === Number(match.hardware.produtoId || match.hardware.produto?.id))
  return { product: linked || null, ambiguous: [], hardware: match.hardware }
}

export function newBuildOffers(rows, toPayload) {
  return rows.filter(row => !row._removed).map(row => {
    const { produtoId, ...offer } = toPayload(row, 1)
    void produtoId
    return offer
  })
}
