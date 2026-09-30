const extraLabels = {
 mpn: 'MPN', gtin: 'GTIN / EAN', ean: 'EAN', sku: 'SKU', urlOriginal: 'Link do produto', urlAfiliada: 'Link afiliado',
 codigoMarketplace: 'Código do anúncio', fontePreco: 'Fonte do preço', disponivel: 'Disponibilidade', descricao: 'Descrição', imagemUrl: 'Imagem',
 nfc: 'NFC', cincoG: '5G', bateriaMah: 'Capacidade da bateria', bateriaMAh: 'Capacidade da bateria',
 processadorNome: 'Processador', ramGb: 'Memória RAM', armazenamentoGb: 'Armazenamento',
 tamanhoTelaPolegadas: 'Tamanho da tela', resolucao: 'Resolução', taxaAtualizacaoHz: 'Taxa de atualização',
 tipoTela: 'Tecnologia da tela', cameraPrincipalMp: 'Câmera traseira', cameraFrontalMp: 'Câmera frontal',
 carregamentoWatts: 'Potência de carregamento', sistemaOperacional: 'Sistema operacional',
 pesoGramas: 'Peso', resistenciaAgua: 'Resistência à água', cor: 'Cor',
 nucleos: 'Núcleos', tipoMemoria: 'Tipo de memória', capacidadePorModuloGb: 'Capacidade por módulo',
 quantidadeModulos: 'Quantidade de módulos', frequenciaMhz: 'Frequência', tensaoVolts: 'Tensão',
 consumoWatts: 'Consumo de energia', potenciaWatts: 'Potência', memoriaVideoGb: 'Memória de vídeo',
 suportaXmp: 'Suporte a XMP', suportaExpo: 'Suporte a EXPO', possuiVideoIntegrado: 'Vídeo integrado',
 frequenciasMemoriaJedecMhz: 'Frequências de memória padrão', frequenciasMemoriaOcMhz: 'Frequências de memória com overclock',
}
const labels = {
  socket: 'Socket', generation: 'Geração', architecture: 'Arquitetura', cores: 'Núcleos', threads: 'Threads',
  baseClockGhz: 'Clock base', boostClockGhz: 'Clock turbo', cacheL3Mb: 'Cache L3', tdpWatts: 'TDP', integratedGraphics: 'Vídeo integrado', memory: 'Memória suportada', pcie: 'PCIe',
  vramGb: 'VRAM', memoryType: 'Tipo de memória', memoryBusBits: 'Barramento', boostClockMhz: 'Clock boost', tgpWatts: 'TGP', recommendedPsuWatts: 'Fonte recomendada', lengthMm: 'Comprimento', slots: 'Slots',
  chipset: 'Chipset', formFactor: 'Formato', ramSlots: 'Slots RAM', maxRamGb: 'RAM máxima', m2Slots: 'Slots M.2', sataPorts: 'Portas SATA', wifi: 'Wi-Fi', bluetooth: 'Bluetooth',
  capacityGb: 'Capacidade', modules: 'Módulos', frequencyMhz: 'Frequência', latency: 'Latência', voltage: 'Tensão', rgb: 'Com iluminação RGB', type: 'Tipo', interface: 'Interface', readMbps: 'Leitura', writeMbps: 'Gravação',
  coolingType: 'Tipo de refrigeração', sockets: 'Sockets suportados', thermalCapacityWatts: 'Capacidade térmica', radiatorMm: 'Radiador', fanCount: 'Quantidade de fans', noiseDb: 'Nível de ruído', lifeHours: 'Vida útil', maxRpm: 'Velocidade máxima', depthMm: 'Profundidade',
  powerWatts: 'Potência', certification: 'Certificação', modularity: 'Modularidade', pcie5: 'PCIe 5', fanMm: 'Ventoinha',
  sensor: 'Sensor', dpiMax: 'DPI máximo', pollingRateHz: 'Polling rate', buttons: 'Botões', weightGrams: 'Peso', connection: 'Conexão', layout: 'Layout', size: 'Tamanho', switch: 'Switch', hotSwap: 'Hot swap',
  driverMm: 'Driver', microphone: 'Microfone', surround: 'Surround', sizeInches: 'Tamanho', resolution: 'Resolução', refreshRateHz: 'Taxa de atualização', panel: 'Painel', responseTimeMs: 'Tempo de resposta', hdr: 'HDR', displayPort: 'DisplayPort', hdmi: 'HDMI', vesa: 'VESA',
  cpu: 'Processador', gpu: 'Placa de vídeo', ramGb: 'RAM', storageGb: 'Armazenamento', screenInches: 'Tela', weightKg: 'Peso', upgradeRam: 'Upgrade de RAM', upgradeStorage: 'Upgrade de armazenamento',
  material: 'Material', maxWeightKg: 'Peso máximo', armrest: 'Apoio de braço', reclining: 'Reclinação', lumbarSupport: 'Apoio lombar', headrest: 'Apoio de cabeça',
  widthMm: 'Largura', heightMm: 'Altura', thicknessMm: 'Espessura', surface: 'Superfície', base: 'Base',
}
const unitFor = (key) => ({
  baseClockGhz: ' GHz', boostClockGhz: ' GHz', cacheL3Mb: ' MB', tdpWatts: ' W', vramGb: ' GB', memoryBusBits: ' bits', boostClockMhz: ' MHz', tgpWatts: ' W', recommendedPsuWatts: ' W', lengthMm: ' mm', maxRamGb: ' GB', capacityGb: ' GB', frequencyMhz: ' MHz', readMbps: ' MB/s', writeMbps: ' MB/s', powerWatts: ' W', fanMm: ' mm', pollingRateHz: ' Hz', weightGrams: ' g', driverMm: ' mm', sizeInches: '”', refreshRateHz: ' Hz', responseTimeMs: ' ms', ramGb: ' GB', storageGb: ' GB', screenInches: '”', weightKg: ' kg', maxWeightKg: ' kg', widthMm: ' mm', heightMm: ' mm', depthMm: ' mm', thicknessMm: ' mm', thermalCapacityWatts: ' W', radiatorMm: ' mm', noiseDb: ' dB', lifeHours: ' horas', maxRpm: ' RPM',
}[key] ?? '')
export function specLabel(key) {
 if (extraLabels[key] || labels[key]) return extraLabels[key] || labels[key]
 return String(key).replace(/^especificacao/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ').replace(/\b(nfc|ram|ssd|usb|hdmi|rgb|cpu|gpu|pcie|tdp)\b/gi, x => x.toUpperCase())
  .replace(/\b(Gb|Mb|Mhz|Ghz|Mm|Watts|Volts|Mah|Mp)\b/g, '').replace(/\s+/g, ' ').trim().replace(/^./, x => x.toUpperCase())
}
export function specValue(key, value) {
 if (value === null || value === undefined || value === '') return 'Não informado'
 if (typeof value === 'boolean' || /^(true|false)$/i.test(String(value))) return String(value).toLowerCase() === 'true' ? 'Sim' : 'Não'
 if (Array.isArray(value)) return value.map(v => specValue(key, v)).join(', ')
 if (typeof value === 'object') return Object.entries(value).map(([k,v]) => `${specLabel(k)}: ${specValue(k,v)}`).join(' · ')
 const suffixes = { Gb: ' GB', Mb: ' MB', Mhz: ' MHz', Ghz: ' GHz', Mm: ' mm', Watts: ' W', Volts: ' V', Mah: ' mAh', MAh: ' mAh', Mp: ' MP', Hz: ' Hz', Gramas: ' g', Polegadas: '″' }
 const unit = unitFor(key) || Object.entries(suffixes).find(([suffix]) => key.endsWith(suffix))?.[1] || ''
 let numeric = value
 if (unit && typeof value === 'string') {
  const raw = value.trim().replace(/\s*(?:mAh|GB|MB|MHz|GHz|mm|W|V|MP|Hz|g)$/i, '').trim()
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) numeric = Number(raw.replace(/[.,]/g, ''))
  else if (/^\d+(?:[.,]\d+)?$/.test(raw)) numeric = Number(raw.replace(',', '.'))
 }
 return typeof numeric === 'number' && Number.isFinite(numeric)
  ? numeric.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + unit : String(value)
}
