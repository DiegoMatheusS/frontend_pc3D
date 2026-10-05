import { getAiPayload } from './aiImportContract.js'
import { compareCatalogIdentity } from './catalogMatching.js'

function normalizeToken(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeGtin(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 32)
}

const GRAPHICS_BRANDS = ['ZOTAC', 'ASUS', 'MSI', 'GIGABYTE', 'ASROCK', 'SAPPHIRE', 'POWERCOLOR', 'XFX', 'PALIT', 'PNY', 'GALAX', 'GAINWARD', 'INNO3D', 'EVGA', 'BIOSTAR', 'COLORFUL', 'AFOX', 'LEADTEK', 'YESTON', 'MAXSUN']

function graphicsIdentity(...values) {
  const text = values.filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const nvidia = text.match(/\b(RTX|GTX)\s*[-_]?\s*(\d{3,4})\s*(TI)?\s*(SUPER)?\b/)
  const amd = text.match(/\bRX\s*[-_]?\s*(\d{3,4})\s*(XTX|XT|GRE)?\b/)
  const intel = text.match(/\bARC\s*[-_]?\s*([AB]\d{3})\b/)
  const signature = nvidia ? nvidia.slice(1).filter(Boolean).join(' ')
    : amd ? ['RX', ...amd.slice(1).filter(Boolean)].join(' ')
      : intel ? `ARC ${intel[1]}` : ''
  const brands = GRAPHICS_BRANDS.filter(brand => new RegExp(`\\b${brand}\\b`).test(text))
  const memory = text.match(/\b(\d{1,3})\s*GB\b/)?.[1] || ''
  return { signature, brand: brands.length === 1 ? normalizeToken(brands[0]) : '', memory }
}

function graphicsModelKey(value) {
  return normalizeToken(String(value || '').replace(/\b(?:NVIDIA|GEFORCE|AMD|RADEON|INTEL|ARC)\b/gi, ''))
}

function processorModelSignature(...values) {
  const text = values.filter(Boolean).join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  // Intel Core i3/i5/i7/i9: aceita "i5-9500", "i5 9500" e "i59500".
  const intel = text.match(/\b(I[3579])\s*[-_ ]?\s*(\d{4,5}[A-Z]{0,3})\b/i)
  if (intel) return `${intel[1].toUpperCase()}-${intel[2].toUpperCase()}`

  // Intel Core Ultra.
  const ultra = text.match(/\bCORE\s+ULTRA\s+([3579])\s+([0-9]{3}[A-Z]{0,2})\b/i)
  if (ultra) return `CORE-ULTRA-${ultra[1]}-${ultra[2].toUpperCase()}`

  // AMD Ryzen.
  const ryzen = text.match(/\bRYZEN\s+([3579])\s+([0-9]{4}[A-Z0-9]{0,4})\b/i)
  if (ryzen) return `RYZEN-${ryzen[1]}-${ryzen[2].toUpperCase()}`

  return ''
}

export function findExistingHardwareFromAi(hardwareItems = [], preview = {}) {
  const source = getAiPayload(preview)
  const targetCategory = normalizeToken(source.categoria || preview?.categoriaDetectada || preview?.categoriaSugerida)
  const isGraphics = targetCategory === 'placavideo'
  const targetGraphics = isGraphics ? graphicsIdentity(source.nome, source.modelo, source.marca) : {}
  const targetBrand = targetGraphics.brand || normalizeToken(source.marca)
  const targetModel = isGraphics ? graphicsModelKey(source.modelo || targetGraphics.signature) : normalizeToken(source.modelo)
  const genericGraphicsModel = isGraphics && (!source.modelo || targetModel === graphicsModelKey(targetGraphics.signature))
  const candidates = []
  const targetMpn = normalizeToken(source.mpn)
  const targetGtin = normalizeGtin(source.gtin || source.ean)
  const targetName = normalizeToken(source.nome)
  const targetProcessorSignature = targetCategory === 'processador'
    ? processorModelSignature(source.modelo, source.nome, source.mpn)
    : ''

  const scored = (Array.isArray(hardwareItems) ? hardwareItems : []).flatMap((hardware) => {
    const hardwareCategory = normalizeToken(hardware?.categoria)
    if (targetCategory && hardwareCategory && targetCategory !== hardwareCategory) return []

    const graphics = isGraphics ? graphicsIdentity(hardware?.nome, hardware?.modelo, hardware?.marca, hardware?.produto?.nome, hardware?.produto?.modelo) : {}
    const brand = graphics.brand || normalizeToken(hardware?.marca || hardware?.produto?.marca)
    const modelValue = hardware?.modelo || hardware?.produto?.modelo
    const model = isGraphics ? graphicsModelKey(modelValue) : normalizeToken(modelValue)
    const mpn = normalizeToken(hardware?.mpn || hardware?.produto?.mpn)
    const gtin = normalizeGtin(hardware?.gtin || hardware?.produto?.gtin)
    const name = normalizeToken(hardware?.nome || hardware?.produto?.nome)
    const processorSignature = targetProcessorSignature
      ? processorModelSignature(hardware?.modelo, hardware?.nome, hardware?.mpn, hardware?.produto?.modelo, hardware?.produto?.nome)
      : ''

    const sameGraphics = isGraphics && targetGraphics.signature && targetGraphics.signature === graphics.signature
      && (!targetBrand || targetBrand === brand)
      && (!targetGraphics.memory || !graphics.memory || targetGraphics.memory === graphics.memory)
    const identityMatch = compareCatalogIdentity(source, { ...hardware?.produto, ...hardware })
    const identified = (targetGtin && gtin === targetGtin) || (targetMpn && mpn === targetMpn && targetBrand && brand === targetBrand)
    if (!identified && ((targetGtin && gtin && targetGtin !== gtin) || (targetMpn && mpn && targetMpn !== mpn))) return []
    // Chipset, fabricante e capacidade diferentes nunca confirmam uma GPU pelo modelo genérico.
    if (isGraphics && ((targetGraphics.signature && graphics.signature && targetGraphics.signature !== graphics.signature)
      || (targetBrand && brand && targetBrand !== brand)
      || (targetGraphics.memory && graphics.memory && targetGraphics.memory !== graphics.memory))) return []
    if (sameGraphics || identityMatch === 'candidate') candidates.push(hardware)

    let score = 0
    const reasons = []
    if (targetGtin && gtin && targetGtin === gtin) { score += 140; reasons.push('GTIN') }
    if (targetMpn && mpn && targetMpn === mpn && targetBrand && targetBrand === brand) { score += 110; reasons.push('MPN') }
    if (targetBrand && brand && targetBrand === brand) { score += 25; reasons.push('marca') }
    if (targetProcessorSignature && processorSignature && targetProcessorSignature === processorSignature) {
      score += 100
      reasons.push(`modelo CPU ${targetProcessorSignature}`)
    }
    if (targetModel && model && targetModel === model) { score += 70; reasons.push('modelo') }
    else if (targetModel && name && name.includes(targetModel)) { score += 65; reasons.push('modelo no nome') }
    if (targetName && name && targetName === name) { score += 100; reasons.push('nome') }
    if (identityMatch === 'exact' && !isGraphics) score += 100

    // Não vincula automaticamente por nome/modelo fraco. GTIN/MPN ou marca+modelo exatos são seguros.
    if (score < 90) return []
    return [{ hardware, score, reasons }]
  }).sort((a, b) => b.score - a.score)

  const identified = scored.filter(item => item.reasons.includes('GTIN') || item.reasons.includes('MPN'))
  if (!identified.length && genericGraphicsModel && candidates.length && !scored.some(item => item.reasons.includes('nome'))) return { hardware: null, ambiguous: [...new Map(candidates.map(item => [item.id, item])).values()] }
  if (!scored.length) return { hardware: null, ambiguous: [...new Map(candidates.map(item => [item.id, item])).values()] }
  const best = scored[0]
  const tied = scored.filter((item) => item.score === best.score)
  if (tied.length > 1) return { hardware: null, ambiguous: tied.map((item) => item.hardware) }
  return { hardware: best.hardware, ambiguous: [] }
}
