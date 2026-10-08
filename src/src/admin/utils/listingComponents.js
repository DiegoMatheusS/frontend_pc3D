// Somente correspondências confirmadas na análise e ainda presentes no catálogo.
export function mergeConfirmedListingComponents(current = [], detected = [], catalog = []) {
  const next = [...current]
  for (const item of Array.isArray(detected) ? detected : []) {
    if (item.vinculoConfirmadoNoAnuncio !== true || item.revisaoNecessaria) continue
    const hardware = catalog.find(row => Number(row.id) === Number(item.hardwareId)
      && row.categoria === item.categoria && row.ativo !== false)
    if (!hardware || next.some(row => row.categoria === item.categoria)) continue
    next.push({ hardwareId: Number(hardware.id), categoria: hardware.categoria, quantidade: 1, ordem: next.length })
  }
  return next
}
