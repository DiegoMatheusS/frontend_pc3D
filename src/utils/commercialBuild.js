const REQUIRED_3D_CATEGORIES = [
  'PROCESSADOR', 'PLACA_MAE', 'MEMORIA_RAM', 'ARMAZENAMENTO', 'FONTE', 'GABINETE',
]

export function isUpgradeKit(pc) {
  const value = String(pc?.category ?? pc?.categoria ?? '').trim().toUpperCase().replace(/[ -]+/g, '_')
  return value === 'KIT_UPGRADE'
}

export function buildCategoryLabel(pc) {
  if (isUpgradeKit(pc)) return 'Kit de upgrade'
  const raw = String(pc?.category ?? pc?.categoria ?? '').trim()
  return !raw || raw === 'PC_MONTADO' ? 'PC montado' : raw
}

export function hasCompleteBuilderConfiguration(pc) {
  if (isUpgradeKit(pc)) return false
  const components = Array.isArray(pc?.components) ? pc.components : []
  const types = new Set(components.map((part) => String(part.categoria ?? part.hardware?.categoria ?? '').trim().toUpperCase()))
  return REQUIRED_3D_CATEGORIES.every((category) => types.has(category))
}

export function hasVerifiedConsumption(pc) {
  return hasCompleteBuilderConfiguration(pc) && Number(pc?.estimatedConsumption) > 0
}

export function getBuilder3DUnavailableReason(pc) {
  const components = Array.isArray(pc?.components) ? pc.components : []
  const hasLinkedHardware = components.some((part) => part?.hardware?.id || part?.hardwareId)
  if (!hasLinkedHardware) return 'Este PC não tem peças vinculadas para exibir no 3D.'
  if (isUpgradeKit(pc)) return 'A visualização 3D exige uma configuração de PC completa; este anúncio é um kit de upgrade.'
  if (!hasCompleteBuilderConfiguration(pc)) return 'Faltam peças vinculadas para visualizar a configuração completa no 3D.'
  return ''
}
