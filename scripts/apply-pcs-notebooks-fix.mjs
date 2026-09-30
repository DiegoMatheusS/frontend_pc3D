import { readFileSync, writeFileSync } from 'node:fs'

const normalizerFiles = ['src/services/normalizers.js', 'src/src/services/normalizers.js']
const notebookDetailsFiles = ['src/pages/NotebookDetails/NotebookDetails.jsx', 'src/src/pages/NotebookDetails/NotebookDetails.jsx']
const mountedCardFiles = ['src/components/MountedPcCard/MountedPcCard.jsx', 'src/src/components/MountedPcCard/MountedPcCard.jsx']
const mountedCssFiles = ['src/components/MountedPcCard/MountedPcCard.css', 'src/src/components/MountedPcCard/MountedPcCard.css']

const normalizeNotebookSpecs = `function normalizeNotebookSpecs(rawSpecs = {}) {
  const spec = rawSpecs && typeof rawSpecs === 'object' ? rawSpecs : {}
  const width = number(spec.resolucaoLargura ?? spec.resolutionWidth, 0)
  const height = number(spec.resolucaoAltura ?? spec.resolutionHeight, 0)
  const resolution = text(spec.resolution ?? spec.resolucaoTela ?? spec.resolucao, '') || (width && height ? String(width) + 'x' + String(height) : '')
  const upgradeRamRaw = spec.upgradeRam ?? spec.ramExpansivel
  const upgradeStorageRaw = spec.upgradeArmazenamento ?? spec.upgradeStorage ?? spec.armazenamentoExpansivel
  const storageGb = number(spec.storageGb ?? spec.armazenamentoGb ?? spec.capacidadeArmazenamentoGb, 0)
  const storageType = text(spec.storageType ?? spec.tipoArmazenamento, '')
  const booleanValue = (value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLocaleLowerCase('pt-BR')
      if (['true', 'sim', 'yes', '1'].includes(normalized)) return true
      if (['false', 'não', 'nao', 'no', '0'].includes(normalized)) return false
    }
    return undefined
  }
  const yesNo = (value) => {
    const parsed = booleanValue(value)
    if (parsed === undefined) return text(value, '—')
    return parsed ? 'Sim' : 'Não'
  }
  const dimensionValues = [number(spec.larguraMm, 0), number(spec.profundidadeMm, 0), number(spec.alturaMm, 0)]
  const dimensions = text(spec.dimensions ?? spec.dimensoes, '') || (dimensionValues.every((value) => value > 0) ? dimensionValues.join(' × ') + ' mm' : '')

  return {
    ...spec,
    cpu: text(spec.cpu ?? spec.processador ?? spec.processadorModelo ?? spec.processadorNome),
    cpuBrand: text(spec.cpuBrand ?? spec.marcaProcessador ?? spec.processadorMarca, ''),
    cpuGeneration: text(spec.cpuGeneration ?? spec.geracaoProcessador ?? spec.processadorGeracao, ''),
    cpuCores: number(spec.cpuCores ?? spec.nucleosProcessador ?? spec.nucleos, 0),
    cpuThreads: number(spec.cpuThreads ?? spec.threadsProcessador ?? spec.threads, 0),
    cpuBaseClockGhz: number(spec.cpuBaseClockGhz ?? spec.clockBaseGhz, 0) || (number(spec.clockBaseMhz, 0) / 1000 || 0),
    cpuBoostClockGhz: number(spec.cpuBoostClockGhz ?? spec.clockTurboGhz, 0) || (number(spec.clockTurboMhz, 0) / 1000 || 0),
    cpuTdpWatts: number(spec.cpuTdpWatts ?? spec.tdpProcessador ?? spec.tdpCpu ?? spec.tdpWatts, 0),
    gpu: text(spec.gpu ?? spec.placaVideo ?? spec.placaDeVideo ?? spec.gpuNome, ''),
    dedicatedGpu: booleanValue(spec.dedicatedGpu ?? spec.gpuDedicada ?? spec.placaVideoDedicada),
    vramGb: number(spec.vramGb ?? spec.memoriaVideoGb ?? spec.vram, 0),
    gpuTgpWatts: number(spec.gpuTgpWatts ?? spec.tgpGpu ?? spec.tgp ?? spec.tgpWatts, 0),
    ramGb: number(spec.ramGb ?? spec.memoriaRamGb ?? spec.memoriaInstaladaGb ?? spec.ramInstaladaGb, 0),
    ramModel: text(spec.ramModel ?? spec.modeloRam ?? spec.modeloMemoriaRam ?? spec.memoriaRamModelo ?? spec.memoriaModelo, ''),
    ramType: text(spec.ramType ?? spec.tipoMemoria ?? spec.tipoRam, ''),
    ramFrequencyMhz: number(spec.ramFrequencyMhz ?? spec.frequenciaRamMhz ?? spec.frequenciaMhz, 0),
    maxRamGb: number(spec.maxRamGb ?? spec.memoriaMaximaGb ?? spec.ramMaximaGb, 0),
    ramSlots: number(spec.ramSlots ?? spec.slotsRam ?? spec.slotsRamTotal, 0),
    freeRamSlots: number(spec.freeRamSlots ?? spec.slotsRamLivres, 0),
    solderedRamGb: number(spec.solderedRamGb ?? spec.ramSoldadaGb, 0),
    storageGb,
    storageType,
    storageLabel: [storageGb > 0 ? String(storageGb) + ' GB' : '', storageType].filter(Boolean).join(' '),
    m2Slots: number(spec.m2Slots ?? spec.slotsM2 ?? spec.slotsM2Total, 0),
    freeM2Slots: number(spec.freeM2Slots ?? spec.slotsM2Livres, 0),
    screenInches: number(spec.screenInches ?? spec.telaPolegadas ?? spec.polegadas ?? spec.tamanhoTelaPolegadas, 0),
    resolution,
    refreshRateHz: number(spec.refreshRateHz ?? spec.taxaAtualizacaoHz ?? spec.hz, 0),
    panel: text(spec.panel ?? spec.painelTela ?? spec.tipoPainel, ''),
    brightnessNits: number(spec.brightnessNits ?? spec.brilhoNits, 0),
    touch: booleanValue(spec.touch ?? spec.telaTouch ?? spec.touchscreen),
    batteryWh: number(spec.batteryWh ?? spec.bateriaWh, 0),
    chargerWatts: number(spec.chargerWatts ?? spec.potenciaCarregadorWatts ?? spec.carregadorWatts, 0),
    weightKg: number(spec.weightKg ?? spec.pesoKg, 0),
    dimensions,
    wifi: text(spec.wifi ?? spec.wiFi ?? spec.wireless, ''),
    bluetooth: text(spec.bluetooth ?? spec.bluetoothVersao, ''),
    usbA: number(spec.usbA ?? spec.usbTipoA ?? spec.portasUsbA, 0),
    usbC: number(spec.usbC ?? spec.usbTipoC ?? spec.portasUsbC, 0),
    thunderbolt: number(spec.thunderbolt ?? spec.portasThunderbolt, 0),
    hdmi: number(spec.hdmi ?? spec.portasHdmi, 0),
    ethernet: booleanValue(spec.ethernet ?? spec.redeEthernet ?? spec.rj45),
    os: text(spec.os ?? spec.sistemaOperacional ?? spec.sistema ?? spec.operatingSystem, ''),
    webcam: booleanValue(spec.webcam ?? spec.possuiWebcam ?? spec.cameraWebcam),
    webcamResolution: text(spec.webcamResolution ?? spec.resolucaoWebcam, ''),
    backlitKeyboard: booleanValue(spec.backlitKeyboard ?? spec.tecladoIluminado ?? spec.tecladoRetroiluminado ?? spec.keyboardBacklight),
    numericKeypad: booleanValue(spec.numericKeypad ?? spec.tecladoNumerico ?? spec.numpad),
    fingerprint: booleanValue(spec.fingerprint ?? spec.leitorDigital ?? spec.sensorDigital ?? spec.biometria),
    upgradeRam: yesNo(upgradeRamRaw),
    upgradeStorage: yesNo(upgradeStorageRaw),
  }
}`

function patchNormalizers(file) {
  const source = readFileSync(file, 'utf8')
  const next = source.replace(/function normalizeNotebookSpecs\(rawSpecs = \{\}\) \{[\s\S]*?\n\}\n\nexport function normalizeNotebook/, normalizeNotebookSpecs + '\n\nexport function normalizeNotebook')
  if (next === source) throw new Error(`normalizeNotebookSpecs não encontrado em ${file}`)
  writeFileSync(file, next)
}

function patchNotebookDetails(file) {
  const source = readFileSync(file, 'utf8')
  const replacement = `function displayValue(key, value, suffix = '') {
  if ((key === 'vramGb' || key === 'gpuTgpWatts') && (value === 0 || value === null)) return 'Não se aplica'
  if (value === null || value === undefined || value === '') return 'Não informado'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'string') {
    const normalized = value.trim().toLocaleLowerCase('pt-BR')
    if (['true', 'sim', 'yes', '1'].includes(normalized)) return 'Sim'
    if (['false', 'não', 'nao', 'no', '0'].includes(normalized)) return 'Não'
  }
  return String(value) + (typeof value === 'number' ? suffix : '')
}`
  const next = source.replace(/function displayValue\(key, value, suffix = ''\) \{[\s\S]*?\n\}/, replacement)
  if (next === source) throw new Error(`displayValue não encontrado em ${file}`)
  writeFileSync(file, next)
}

function patchMountedCard(file) {
  let source = readFileSync(file, 'utf8')
  source = source.replace(/const offersCount = Math\.max\(0, asNumber\(pc\.offersCount, 0\)\)\n/, "const offersCount = Math.max(0, asNumber(pc.offersCount, 0))\n  const detailsPath = '/montados/' + pc.id\n")
  source = source.replace(/<div className="mounted-card__visual" aria-hidden="true">([\s\S]*?)<\/div>\n\n      <div className="mounted-card__content">/, '<Link className="mounted-card__visual" to={detailsPath} aria-label={\'Ver detalhes de \' + name}>$1</Link>\n\n      <div className="mounted-card__content">')
  source = source.replace(/<h3>\{name\}<\/h3>/, '<h3><Link className="mounted-card__title" to={detailsPath}>{name}</Link></h3>')
  source = source.replace(/to=\{`\/montados\/\$\{pc\.id\}`\}/g, 'to={detailsPath}')
  if (!source.includes('mounted-card__title') || !source.includes("aria-label={'Ver detalhes de ' + name}")) throw new Error(`Links do PC montado não foram aplicados em ${file}`)
  writeFileSync(file, source)
}

function patchMountedCss(file) {
  let source = readFileSync(file, 'utf8')
  if (!source.includes('.mounted-card__visual {')) throw new Error(`CSS visual não encontrado em ${file}`)
  if (!source.includes('.mounted-card__visual {\n  color: inherit;')) source = source.replace('.mounted-card__visual {\n', '.mounted-card__visual {\n  color: inherit;\n  text-decoration: none;\n')
  if (!source.includes('.mounted-card__title {')) source = source.replace('.mounted-card h3 {\n', '.mounted-card__title {\n  color: inherit;\n  text-decoration: none;\n}\n\n.mounted-card__title:hover {\n  color: var(--color-primary);\n}\n\n.mounted-card__visual:focus-visible,\n.mounted-card__title:focus-visible {\n  outline: 2px solid var(--color-primary);\n  outline-offset: 3px;\n}\n\n.mounted-card h3 {\n')
  writeFileSync(file, source)
}

normalizerFiles.forEach(patchNormalizers)
notebookDetailsFiles.forEach(patchNotebookDetails)
mountedCardFiles.forEach(patchMountedCard)
mountedCssFiles.forEach(patchMountedCss)

console.log('Correções de PCs montados e notebooks aplicadas nas duas árvores do frontend.')
