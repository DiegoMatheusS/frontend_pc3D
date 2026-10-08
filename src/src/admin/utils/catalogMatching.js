import { getAiPayload } from './aiImportContract.js'

export function identityKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function digits(value) { return String(value ?? '').replace(/\D/g, '') }

function words(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || []
}

function graphicsSignature(value) {
  const text = String(value ?? '').toUpperCase()
  const match = text.match(/\b(RTX|GTX)\s*[-_]?\s*(\d{3,4})\s*(TI)?\s*(SUPER)?\b/)
    || text.match(/\b(RX)\s*[-_]?\s*(\d{3,4})\s*(XTX|XT|GRE)?\b/)
  return match ? match.slice(1).filter(Boolean).join(' ') : ''
}

// Nomes incompletos só sugerem candidatos. Identificadores diferentes preservam variantes.
export function compareCatalogIdentity(source, item) {
  const gtin = digits(source.gtin || source.ean)
  const existingGtin = digits(item.gtin || item.ean)
  const mpn = identityKey(source.mpn)
  const existingMpn = identityKey(item.mpn)
  const brand = identityKey(source.marca)
  const existingBrand = identityKey(item.marca)
  if (gtin && gtin === existingGtin) return 'exact'
  if (mpn && mpn === existingMpn && brand && brand === existingBrand) return 'exact'
  if ((gtin && existingGtin && gtin !== existingGtin) || (mpn && existingMpn && mpn !== existingMpn)
    || (brand && existingBrand && brand !== existingBrand)) return null
  const sourceGpu = graphicsSignature(source.nome)
  const itemGpu = graphicsSignature(item.nome)
  if (sourceGpu && itemGpu && sourceGpu !== itemGpu) return null

  const name = identityKey(source.nome)
  const existingName = identityKey(item.nome)
  if (name && name === existingName) return 'exact'
  const capacities = value => [...String(value ?? '').toLowerCase().matchAll(/\b(\d+(?:[.,]\d+)?)\s*(gb|tb|mhz|hz|w)\b/g)]
    .map(match => `${match[1].replace(',', '.')}${match[2]}`).sort().join('|')
  const sourceCapacity = capacities(source.nome)
  const itemCapacity = capacities(item.nome)
  if (sourceCapacity && itemCapacity && sourceCapacity !== itemCapacity) return null
  const model = identityKey(source.modelo)
  const existingModel = identityKey(item.modelo)
  if (model && model === existingModel && brand && brand === existingBrand) return 'exact'

  const titleWords = words(source.nome)
  const itemWords = words(item.nome)
  // Capacidades, revisões e sufixos diferentes não são selecionados automaticamente.
  const distinctive = titleWords.filter(word => /\d/.test(word))
  const sharedModel = existingModel.length >= 4 && /\d/.test(existingModel) && name.includes(existingModel)
  const sharedWords = distinctive.length > 0 && distinctive.every(word => itemWords.includes(word))
    && titleWords.filter(word => word.length > 2 && itemWords.includes(word)).length >= 2
  const titleBrand = existingBrand && name.includes(existingBrand)
  return (sharedModel || sharedWords) && (!existingBrand || titleBrand || brand === existingBrand) ? 'candidate' : null
}

export function findExistingProductFromAi(products = [], preview = {}) {
  const source = getAiPayload(preview)
  const exact = []
  const candidates = []
  const isBuild = preview.destinoSugerido === 'PC_MONTADO'
    || ['PC_MONTADO', 'KIT_UPGRADE'].includes(preview.categoriaDetectada)
  for (const product of products) {
    // O nome do PC contém suas peças, mas não identifica o Produto de uma peça.
    if (isBuild && product.tipo !== 'BUILD') continue
    const result = compareCatalogIdentity(source, product)
    if (result === 'exact') exact.push(product)
    else if (result === 'candidate') candidates.push(product)
  }
  if (exact.length === 1) return { product: exact[0], ambiguous: [] }
  return { product: null, ambiguous: exact.length ? exact : candidates }
}
