const LABELS = {
  socket: 'Encaixe do processador', generation: 'Geração', architecture: 'Arquitetura', cores: 'Núcleos', threads: 'Threads',
  baseClockGhz: 'Frequência base', boostClockGhz: 'Frequência turbo', cacheL3Mb: 'Cache L3', tdpWatts: 'Consumo (TDP)', integratedGraphics: 'Vídeo integrado', memory: 'Memória compatível', pcie: 'PCIe',
  vramGb: 'Memória de vídeo', memoryType: 'Tipo de memória', memoryBusBits: 'Barramento da memória', boostClockMhz: 'Frequência turbo', tgpWatts: 'Consumo da placa de vídeo', recommendedPsuWatts: 'Fonte recomendada', lengthMm: 'Comprimento', slots: 'Slots ocupados',
  chipset: 'Chipset', formFactor: 'Formato', ramSlots: 'Slots de memória RAM', maxRamGb: 'Memória RAM máxima', m2Slots: 'Slots M.2', sataPorts: 'Portas SATA', wifi: 'Wi-Fi', bluetooth: 'Bluetooth',
  capacityGb: 'Capacidade', modules: 'Quantidade de módulos', frequencyMhz: 'Frequência', latency: 'Latência', voltage: 'Tensão', rgb: 'Iluminação RGB', type: 'Tipo', interface: 'Interface', readMbps: 'Velocidade de leitura', writeMbps: 'Velocidade de gravação',
  coolingType: 'Tipo de refrigeração', sockets: 'Encaixes compatíveis', thermalCapacityWatts: 'Capacidade térmica', radiatorMm: 'Tamanho do radiador', fanCount: 'Quantidade de ventoinhas', noiseDb: 'Nível de ruído', lifeHours: 'Vida útil', maxRpm: 'Rotação máxima', depthMm: 'Profundidade',
  powerWatts: 'Potência', certification: 'Certificação', modularity: 'Modularidade', pcie5: 'Compatível com PCIe 5', fanMm: 'Tamanho da ventoinha',
  sensor: 'Sensor', dpiMax: 'DPI máximo', pollingRateHz: 'Taxa de resposta', buttons: 'Quantidade de botões', weightGrams: 'Peso', connection: 'Conectividade', layout: 'Layout', size: 'Tamanho', switch: 'Tipo de switch', hotSwap: 'Troca de switches',
  driverMm: 'Tamanho do driver', microphone: 'Microfone', surround: 'Áudio surround', sizeInches: 'Tamanho da tela', resolution: 'Resolução', refreshRateHz: 'Taxa de atualização', panel: 'Tipo de painel', responseTimeMs: 'Tempo de resposta', hdr: 'HDR', displayPort: 'DisplayPort', hdmi: 'HDMI', vesa: 'Padrão VESA',
  cpu: 'Processador', gpu: 'Placa de vídeo', ramGb: 'Memória RAM', storageGb: 'Armazenamento', screenInches: 'Tamanho da tela', weightKg: 'Peso', upgradeRam: 'Expansão de RAM', upgradeStorage: 'Expansão de armazenamento',
  material: 'Material', maxWeightKg: 'Peso máximo', armrest: 'Apoio de braço', reclining: 'Reclinação', lumbarSupport: 'Apoio lombar', headrest: 'Apoio para cabeça',
  widthMm: 'Largura', heightMm: 'Altura', thicknessMm: 'Espessura', surface: 'Superfície', base: 'Base',
  nfc: 'NFC', possuiNfc: 'NFC', possuiNFC: 'NFC', suporteNfc: 'NFC',
  bateria: 'Bateria', bateriaMah: 'Capacidade da bateria', bateriaMAh: 'Capacidade da bateria', capacidadeBateriaMah: 'Capacidade da bateria', capacidadeBateriaMAh: 'Capacidade da bateria', batteryCapacityMah: 'Capacidade da bateria', batteryMah: 'Capacidade da bateria',
  tela: 'Tela', tamanhoTela: 'Tamanho da tela', resolucaoTela: 'Resolução da tela', taxaAtualizacaoTelaHz: 'Taxa de atualização da tela',
  armazenamentoInternoGb: 'Armazenamento interno', memoriaRamGb: 'Memória RAM', cameraPrincipalMp: 'Câmera principal', cameraFrontalMp: 'Câmera frontal',
  dualSim: 'Dual SIM', esim: 'eSIM', sistemaOperacional: 'Sistema operacional', versaoAndroid: 'Versão do Android', carregamentoWatts: 'Potência do carregamento',
}

const UNIT_BY_KEY = {
  baseClockGhz: ' GHz', boostClockGhz: ' GHz', cacheL3Mb: ' MB', tdpWatts: ' W',
  vramGb: ' GB', memoryBusBits: ' bits', boostClockMhz: ' MHz', tgpWatts: ' W',
  recommendedPsuWatts: ' W', lengthMm: ' mm', maxRamGb: ' GB', capacityGb: ' GB',
  frequencyMhz: ' MHz', readMbps: ' MB/s', writeMbps: ' MB/s', powerWatts: ' W',
  fanMm: ' mm', pollingRateHz: ' Hz', weightGrams: ' g', driverMm: ' mm',
  sizeInches: '”', refreshRateHz: ' Hz', responseTimeMs: ' ms', ramGb: ' GB',
  storageGb: ' GB', screenInches: '”', weightKg: ' kg', maxWeightKg: ' kg',
  widthMm: ' mm', heightMm: ' mm', depthMm: ' mm', thicknessMm: ' mm',
  thermalCapacityWatts: ' W', radiatorMm: ' mm', noiseDb: ' dB',
  lifeHours: ' horas', maxRpm: ' RPM', cameraPrincipalMp: ' MP',
  cameraFrontalMp: ' MP', armazenamentoInternoGb: ' GB', memoriaRamGb: ' GB',
  taxaAtualizacaoTelaHz: ' Hz', carregamentoWatts: ' W',
}

const NFC = /^(?:possui|suporte)?nfc$/i
const BATTERY = /(?:bateria|battery)(?:capacity|capacidade)?(?:mah)?|^(?:capacidade|capacity)(?:battery|bateria)mah$/i
const internalKeys = new Set(['id', 'produtoid', 'hardwareid', 'categoriaid', 'parceiroid', 'modelo3did', 'hardwareid3d', 'criadoem', 'atualizadoem'])

function normalizedKey(key) {
  return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export function isPublicSpec(key, value) {
  return !internalKeys.has(normalizedKey(key)) && value !== null && value !== undefined && value !== ''
}

export function publicSpecLabel(key) {
  const name = String(key || '').trim()
  if (NFC.test(normalizedKey(name))) return 'NFC'
  if (LABELS[name]) return LABELS[name]
  const normalized = normalizedKey(name)
  const match = Object.entries(LABELS).find(([candidate]) => normalizedKey(candidate) === normalized)
  if (match) return match[1]
  return name.replace(/([a-zà-ú])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
    .replace(/\bmah\b/gi, 'mAh').replace(/\bnfc\b/gi, 'NFC')
    .replace(/^./, (first) => first.toLocaleUpperCase('pt-BR'))
}

function batteryMah(value) {
  if (typeof value === 'number') return value > 0 ? value : null
  const text = String(value || '').trim()
  const match = text.match(/(\d[\d.,]*)\s*(mAh|Ah)?/i)
  if (!match) return null
  const numeric = match[1].replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  const parsed = Number(numeric)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return /^ah$/i.test(match[2] || '') ? parsed * 1000 : parsed
}

export function publicSpecValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  const normalized = normalizedKey(key)
  if (BATTERY.test(normalized)) {
    const mah = batteryMah(value)
    if (mah !== null) return `${mah.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mAh`
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') {
    const digits = normalized === 'noisedb' ? 1 : Number.isInteger(value) ? 0 : 2
    const numeric = value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
    return `${numeric}${UNIT_BY_KEY[key] || ''}`
  }
  if (typeof value === 'string') {
    if (/^true$/i.test(value.trim())) return 'Sim'
    if (/^false$/i.test(value.trim())) return 'Não'
    const unit = UNIT_BY_KEY[key] || ''
    return unit && /^\d+(?:[.,]\d+)?$/.test(value.trim()) ? `${value}${unit}` : value
  }
  if (Array.isArray(value)) return value.map((part) => publicSpecValue('', part)).join(', ')
  if (typeof value === 'object') {
    const pairs = Object.entries(value).filter(([childKey, val]) => isPublicSpec(childKey, val))
    return pairs.map(([childKey, val]) => `${publicSpecLabel(childKey)}: ${publicSpecValue(childKey, val)}`).join('; ') || '—'
  }
  return String(value)
}

export function publicProductDescription(description, name) {
  const raw = String(description || '').trim().replace(/\s+/g, ' ')
  const title = String(name || '').trim().replace(/\s+/g, ' ')
  if (!raw) return ''
  if (title && raw.localeCompare(title, 'pt-BR', { sensitivity: 'base' }) === 0) return ''
  if (title && raw.toLocaleLowerCase('pt-BR').startsWith(title.toLocaleLowerCase('pt-BR'))) {
    return raw.slice(title.length).replace(/^[\s.,:;\-–—|]+/, '').trim()
  }
  return raw
}
