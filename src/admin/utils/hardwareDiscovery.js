export function nextHardwareDiscoveryPage(result, { pagina = 1, limite = 50, catalogChanged = false } = {}) {
  // O cadastro muda o conjunto de candidatos novos. Recomeça na primeira
  // página desse conjunto para não pular modelos que mudaram de posição.
  if (catalogChanged) return 1
  const next = Number(result?.proximaPagina)
  if (Number.isInteger(next) && next > pagina) return next
  if (result?.temMais === false) return null
  if (result?.temMais === true) return pagina + 1
  // Compatibilidade com a API anterior, que não informava a continuação.
  return Number(result?.totalEncontrados ?? 0) >= limite ? pagina + 1 : null
}
