export function identicalOffersFeedback(result, productName) {
  const found = Number(result?.quantidadeEncontrada || 0)
  const created = Number(result?.quantidadeCadastrada || 0)
  const skipped = Number(result?.quantidadeIgnorada || 0)

  if (created > 0) {
    return `${created} nova(s) oferta(s) cadastrada(s) para “${productName}”.${skipped ? ` ${skipped} já existia(m) ou foi(ram) ignorada(s).` : ''}`
  }
  if (found > 0) {
    const ignored = Array.isArray(result?.ignoradas) ? result.ignoradas : []
    if (ignored.length === found && ignored.every((offer) => offer.motivo === 'JA_CADASTRADA')) {
      return 'As ofertas idênticas encontradas já estavam cadastradas para este Produto.'
    }
    return 'Nenhuma nova oferta foi cadastrada. Confira se os resultados já existem ou estão sem parceiro, preço ou link válido.'
  }
  const sources = Object.values(result?.fontes || {})
  if (sources.some((source) => source?.erro || source?.statusBusca === 'ERRO' || Number(source?.falhasColeta) > 0)) {
    return 'Nenhuma oferta foi confirmada. Uma ou mais lojas não puderam ser consultadas; tente novamente mais tarde.'
  }
  return 'Nenhum produto idêntico foi confirmado no Mercado Livre, Magazine Luiza ou Shopee.'
}
