export async function verificarLotePrecos({ request, onProgress, shouldStop = () => false, limite = 50 }) {
  const results = new Map()
  let report = null
  for (let round = 0; round < limite && !shouldStop(); round += 1) {
    const response = await request(limite - results.size, [...results.keys()])
    const before = results.size
    for (const item of response?.resultados || []) {
      const id = Number(item.ofertaId)
      if (Number.isInteger(id) && id > 0 && (results.has(id) || results.size < limite)) results.set(id, item)
    }
    const rows = [...results.values()]
    const count = (statuses) => rows.filter((item) => statuses.includes(item.status)).length
    report = {
      ...response, limiteDoLote: limite, resultados: rows, verificadas: rows.length,
      atualizadas: count(['ATUALIZADO', 'ATUALIZADA']), semAlteracao: count(['SEM_ALTERACAO']),
      revisar: count(['REVISAR']), bloqueadas: count(['BLOQUEADO']), erros: count(['ERRO', 'FALHOU']),
      falharam: count(['REVISAR', 'BLOQUEADO', 'ERRO', 'FALHOU']), indisponiveis: count(['INDISPONIVEL']),
    }
    onProgress?.(report)
    if (results.size === before || results.size >= limite
        || response?.suportaContinuacao !== true || !(Number(response?.restantesElegiveis) > 0)) break
  }
  return report
}
