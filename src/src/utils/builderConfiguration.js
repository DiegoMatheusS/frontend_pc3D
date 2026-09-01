const CATEGORY_TO_BUILDER = {
  PROCESSADOR: 'processador',
  COOLER: 'cooler',
  PLACA_MAE: 'placamae',
  MEMORIA_RAM: 'memoria',
  PLACA_VIDEO: 'placavideo',
  ARMAZENAMENTO: 'armazenamento',
  FONTE: 'fonte',
  GABINETE: 'gabinete',
  VENTOINHA: 'ventoinhas',
}

const ARRAY_CATEGORIES = new Set(['memoria', 'armazenamento', 'ventoinhas'])

function normalizedCategory(component = {}) {
  return String(
    component.categoria
      || component.category
      || component.hardware?.categoria
      || component.hardware?.category
      || component.produto?.categoria
      || component.produto?.category
      || '',
  ).toUpperCase()
}

function builderId(component = {}) {
  const hardware = component.hardware || component.produto || component
  return component.hardwareId3D
    ?? component.builderId
    ?? component.id3D
    ?? hardware?.hardwareId3D
    ?? hardware?.builderId
    ?? hardware?.id3D
    ?? component.hardwareId
    ?? hardware?.hardwareId
    ?? hardware?.id
    ?? component.id
    ?? null
}

function builderValue(component = {}) {
  const id = builderId(component)
  if (id == null || id === '') return null
  const value = { id: String(id) }
  const flow = component.fluxo || component.flow || component.direcaoFluxo
  if (flow === 'out' || flow === 'saida' || flow === 'saída') value.fluxo = 'out'
  if (flow === 'in' || flow === 'entrada') value.fluxo = 'in'
  return value
}

export function configurationFromComponents(components = []) {
  const configuration = {}
  if (!Array.isArray(components)) return configuration

  components.forEach((component) => {
    const key = CATEGORY_TO_BUILDER[normalizedCategory(component)]
    if (!key) return
    const value = builderValue(component)
    if (!value) return

    if (ARRAY_CATEGORIES.has(key)) {
      if (!Array.isArray(configuration[key])) configuration[key] = []
      const quantity = Math.max(1, Number(component.quantidade) || 1)
      for (let index = 0; index < quantity; index += 1) {
        configuration[key].push({ ...value })
      }
      return
    }

    if (!configuration[key]) configuration[key] = value
  })

  return configuration
}

function includesAny(text, values) {
  return values.some((value) => text.includes(value))
}

function inferCpuId(text) {
  if (text.includes('intel')) return 'lga1200'
  if (includesAny(text, ['am5', 'b650', 'x670', 'ddr5', 'ryzen 7 7800', 'ryzen 7 7700', 'ryzen 7 8700', 'ryzen 5 8600', 'ryzen 5 7600'])) return 'am5'
  if (text.includes('ryzen')) return 'am4'
  return 'am4'
}

function inferMotherboardId(text) {
  if (text.includes('intel') || includesAny(text, ['b760', 'z690', 'z790', 'lga'])) return 'lga1200-atx'
  if (includesAny(text, ['b650i', 'mini-itx', 'mini itx'])) return 'am5-mini-itx'
  if (includesAny(text, ['b650', 'x670', 'am5', 'ddr5'])) return 'am5-atx'
  if (includesAny(text, ['matx', 'm-atx', 'micro'])) return 'am4-matx'
  return 'am4-atx'
}

function inferGpuId(text) {
  if (includesAny(text, ['3090', '4090', '4080', '9070'])) return 'rx9070xt'
  if (includesAny(text, ['5070', '4070', '7700 xt', '7800 xt'])) return 'rtx5070ti'
  return 'rx9060xt'
}

function inferStorageId(text) {
  return includesAny(text, ['nvme', 'm.2', 'm2']) ? 'ssd-m2' : 'ssd-sata'
}

function inferCaseId(text) {
  return includesAny(text, ['mini-itx', 'mini itx', 'compact', 'compacto', 'nr200']) ? 'compacto' : 'mid-tower'
}

function inferPsuId(watts) {
  const value = Number(watts) || 0
  if (value >= 800) return 'fonte-corsair-rm850x'
  if (value >= 700) return '750w'
  if (value >= 600) return '650w'
  return '550w'
}

export function inferMountedPcConfiguration(pc = {}) {
  const explicit = pc.builderConfiguration || pc.configuracao3D || pc.configuracao || pc.configuration
  if (explicit && typeof explicit === 'object' && hasBuilderConfiguration(explicit)) return explicit

  const componentsConfiguration = configurationFromComponents(pc.components || pc.componentes)
  if (hasBuilderConfiguration(componentsConfiguration)) return componentsConfiguration

  const cpuText = [pc.cpu, pc.motherboard, pc.ram, pc.category].filter(Boolean).join(' ').toLowerCase()
  const motherboardText = [pc.motherboard, pc.cpu, pc.ram].filter(Boolean).join(' ').toLowerCase()
  const gpuText = String(pc.gpu || '').toLowerCase()
  const storageText = String(pc.storage || '').toLowerCase()
  const caseText = String(pc.case || '').toLowerCase()
  const coolerText = String(pc.cooler || '').toLowerCase()
  const ramText = String(pc.ram || '').toLowerCase()

  const ramModules = Math.min(4, Math.max(1, Math.ceil((Number(pc.ramGb) || 16) / 16)))
  const fanCount = Math.min(4, Math.max(0, Number(pc.fans) || 0))
  const memoryId = ramText.includes('ddr5') ? 'ddr5-16gb-6000' : 'ddr4-16gb-3200'

  return {
    gabinete: { id: inferCaseId(caseText) },
    processador: { id: inferCpuId(cpuText) },
    placamae: { id: inferMotherboardId(motherboardText) },
    cooler: { id: coolerText.includes('water') ? 'wc240' : 'cooler-box' },
    memoria: Array.from({ length: ramModules }, () => ({ id: memoryId })),
    placavideo: pc.gpu && !gpuText.includes('integr') ? { id: inferGpuId(gpuText) } : null,
    armazenamento: [{ id: inferStorageId(storageText) }],
    fonte: { id: inferPsuId(pc.powerSupplyWatts) },
    ventoinhas: Array.from({ length: fanCount }, (_, index) => ({
      id: 'fan-arctic-p12',
      fluxo: index === 0 ? 'out' : 'in',
    })),
  }
}

export function hasBuilderConfiguration(configuration = {}) {
  if (!configuration || typeof configuration !== 'object') return false
  return Object.values(configuration).some((value) => (
    Array.isArray(value) ? value.some(Boolean) : Boolean(value)
  ))
}
