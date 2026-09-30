// Preserve missing data separately from explicit negative answers.
const missing = /^(?:—|-|null|undefined|não informado|nao informado|não encontrado|nao encontrado|not found|unknown|n\/a)$/i

function clean(value) {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' && missing.test(value.trim()) ? null : value
}

export function notebookBoolean(value) {
  value = clean(value)
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return null
  const token = value.trim().toLocaleLowerCase('pt-BR')
  if (['sim', 'true', 'yes', 'possui', 'com'].includes(token)) return true
  if (['não', 'nao', 'false', 'no', 'sem', 'não possui', 'nao possui'].includes(token)) return false
  return null
}

const aliases = {
  cpu: ['processador', 'processadorModelo', 'processadorNome'],
  cpuBrand: ['marcaProcessador', 'processadorMarca'],
  cpuGeneration: ['geracaoProcessador', 'processadorGeracao'],
  cpuCores: ['nucleosProcessador', 'nucleos'],
  cpuThreads: ['threadsProcessador', 'threads'],
  cpuTdpWatts: ['tdpProcessador', 'tdpCpu', 'tdpWatts'],
  gpu: ['placaVideo', 'placaDeVideo', 'gpuNome'],
  dedicatedGpu: ['gpuDedicada', 'placaVideoDedicada'],
  vramGb: ['memoriaVideoGb', 'vram'],
  gpuTgpWatts: ['tgpGpu', 'tgp', 'tgpWatts'],
  ramGb: ['memoriaRamGb', 'memoriaInstaladaGb', 'ramInstaladaGb'],
  ramModel: ['modeloRam', 'modeloMemoriaRam', 'memoriaRamModelo', 'memoriaModelo'],
  ramType: ['tipoMemoria', 'tipoRam'],
  ramFrequencyMhz: ['frequenciaMhz'],
  maxRamGb: ['memoriaMaximaGb', 'ramMaximaGb'],
  ramSlots: ['slotsRamTotal'], freeRamSlots: ['slotsRamLivres'], solderedRamGb: ['ramSoldadaGb'],
  storageGb: ['armazenamentoGb', 'capacidadeArmazenamentoGb'],
  storageType: ['tipoArmazenamento'],
  m2Slots: ['slotsM2', 'slotsM2Total'], freeM2Slots: ['slotsM2Livres'],
  screenInches: ['telaPolegadas', 'polegadas', 'tamanhoTelaPolegadas'],
  resolution: ['resolucaoTela', 'resolucao'],
  refreshRateHz: ['taxaAtualizacaoHz', 'hz'], panel: ['painelTela', 'tipoPainel'],
  brightnessNits: ['brilhoNits'], batteryWh: ['bateriaWh'], weightKg: ['pesoKg'],
  chargerWatts: ['potenciaCarregadorWatts'], batteryLifeHours: ['autonomiaInformadaHoras'],
  upgradeRam: ['ramExpansivel'], upgradeStorage: ['upgradeArmazenamento', 'armazenamentoExpansivel'],
  os: ['sistemaOperacional', 'sistema'], wifi: ['wiFi', 'wi_fi'], bluetooth: [],
  webcam: ['possuiWebcam'], webcamResolution: ['resolucaoWebcam'],
  backlitKeyboard: ['tecladoIluminado'], numericKeypad: ['tecladoNumerico'],
  fingerprint: ['leitorDigital', 'leitorBiometrico'], touch: [], ethernet: [], cardReader: ['leitorCartao'],
  usbA: [], usbC: [], thunderbolt: [], hdmi: [], displayPort: [],
}
const booleans = new Set(['dedicatedGpu', 'upgradeRam', 'upgradeStorage', 'webcam', 'backlitKeyboard', 'numericKeypad', 'fingerprint', 'touch', 'ethernet', 'cardReader'])
const numbers = new Set(['cpuCores', 'cpuThreads', 'cpuTdpWatts', 'vramGb', 'gpuTgpWatts', 'ramGb', 'ramFrequencyMhz', 'maxRamGb', 'ramSlots', 'freeRamSlots', 'solderedRamGb', 'storageGb', 'm2Slots', 'freeM2Slots', 'screenInches', 'refreshRateHz', 'brightnessNits', 'batteryWh', 'weightKg', 'chargerWatts', 'batteryLifeHours', 'usbA', 'usbC', 'thunderbolt', 'hdmi', 'displayPort'])

function numeric(value) {
  value = clean(value)
  if (value === null || typeof value === 'boolean') return null
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeNotebookSpecs(source = {}) {
  const spec = source && typeof source === 'object' && !Array.isArray(source) ? source : {}
  const out = { ...spec }
  for (const [key, names] of Object.entries(aliases)) {
    const value = [key, ...names].map((name) => clean(spec[name])).find((item) => item !== null)
    out[key] = booleans.has(key) ? notebookBoolean(value)
      : numbers.has(key) ? numeric(value) : clean(value)
  }
  const width = numeric(spec.resolucaoLargura ?? spec.resolutionWidth)
  const height = numeric(spec.resolucaoAltura ?? spec.resolutionHeight)
  out.resolution ||= width && height ? `${width} × ${height}` : null
  out.cpuBaseClockGhz = numeric(spec.cpuBaseClockGhz) ?? (numeric(spec.clockBaseMhz) === null ? null : numeric(spec.clockBaseMhz) / 1000)
  out.cpuBoostClockGhz = numeric(spec.cpuBoostClockGhz) ?? (numeric(spec.clockTurboMhz) === null ? null : numeric(spec.clockTurboMhz) / 1000)
  out.dimensions = clean(spec.dimensions) || ['larguraMm', 'profundidadeMm', 'alturaMm'].every((key) => numeric(spec[key]) !== null)
    && `${[spec.larguraMm, spec.profundidadeMm, spec.alturaMm].map((value) => numeric(value).toLocaleString('pt-BR')).join(' × ')} mm` || null
  out.storageLabel = [out.storageGb ? `${out.storageGb} GB` : '', out.storageType].filter(Boolean).join(' ')
  return out
}

export function notebookSpecValue(key, value, suffix = '') {
  value = clean(value)
  if (value === null) return 'Não informado'
  if (booleans.has(key) || typeof value === 'boolean') {
    const result = notebookBoolean(value)
    return result === null ? 'Não informado' : result ? 'Sim' : 'Não'
  }
  if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) return notebookBoolean(value) ? 'Sim' : 'Não'
  if (typeof value === 'number') return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${suffix}`
  return String(value).replaceAll('_', ' ')
}

export function notebookPath(notebook = {}) {
  return `/notebooks/${encodeURIComponent(notebook.slug || notebook.id)}`
}
