const stores = [
  { key: 'mercadoLivre', name: 'Mercado Livre', marketplace: 'MERCADO_LIVRE', slug: 'mercado-livre' },
  { key: 'magalu', name: 'Magazine Luiza', marketplace: 'MAGALU', slug: 'magazine-luiza' },
  { key: 'shopee', name: 'Shopee', marketplace: 'SHOPEE', slug: 'shopee' },
]

const failureStatuses = new Set(['ERRO', 'BLOQUEADO', 'FALHA_TEMPORARIA', 'TEMPO_LIMITE', 'NAO_CONFIGURADA'])

function sourceHasFailure(source) {
  return Boolean(source && (source.erro || source.configurada === false || failureStatuses.has(source.statusBusca)
    || Number(source.falhasColeta) > 0 || source.tentativas?.some((attempt) => failureStatuses.has(attempt.status) && attempt.status !== 'NAO_CONFIGURADA')))
}

export function identicalOffersHasFailures(result) {
  return Object.values(result?.fontes || {}).some(sourceHasFailure)
}

export function identicalOffersSources(result) {
  return stores.map((store) => {
    const source = result?.fontes?.[store.key]
    const found = Number(source?.encontrados || 0)
    const created = (result?.cadastradas || []).filter((offer) => offer.marketplace === store.marketplace
      || offer.parceiro?.slug === store.slug || offer.parceiro?.nome === store.name).length
    const duplicates = (result?.ignoradas || []).filter((offer) => offer.marketplace === store.marketplace && offer.motivo === 'JA_CADASTRADA').length
    const partial = sourceHasFailure(source)
    let message = 'Nenhuma oferta idêntica confirmada.'
    if (!source) message = 'A loja não informou o resultado da busca.'
    else if (source.statusBusca === 'TEMPO_LIMITE') message = 'A loja excedeu o tempo de busca. Tente novamente.'
    else if (source.statusBusca === 'BLOQUEADO' || source.tentativas?.some((attempt) => attempt.status === 'BLOQUEADO')) message = 'A loja ou o serviço de busca bloqueou a consulta. Tente novamente mais tarde.'
    else if (source.configurada === false || source.statusBusca === 'NAO_CONFIGURADA') message = 'Integração da loja não configurada.'
    else if (partial) message = 'Parte da consulta falhou. Tente novamente mais tarde.'
    else if (found > 0) message = duplicates === found ? 'As ofertas confirmadas já estavam cadastradas.' : 'Ofertas idênticas confirmadas.'
    else if (Number(source.semPreco) > 0) message = 'Produto correspondente encontrado, mas sem uma oferta válida e disponível em reais.'
    else if (Number(source.rejeitadosPorIdentidade) > 0) message = 'Os candidatos encontrados não confirmaram o mesmo GTIN, MPN ou modelo.'
    return { ...store, found, created, duplicates, partial, message }
  })
}

export function identicalOffersFeedback(result, productName) {
  const found = Number(result?.quantidadeEncontrada || 0)
  const created = Number(result?.quantidadeCadastrada || 0)
  const skipped = Number(result?.quantidadeIgnorada || 0)

  if (created > 0) {
    return `${created} nova(s) oferta(s) cadastrada(s) para “${productName}”.${skipped ? ` ${skipped} já existia(m) ou foi(ram) ignorada(s).` : ''}${identicalOffersHasFailures(result) ? ' A busca ficou incompleta em uma ou mais lojas; confira o resultado por loja.' : ''}`
  }
  if (found > 0) {
    const ignored = Array.isArray(result?.ignoradas) ? result.ignoradas : []
    if (ignored.length === found && ignored.every((offer) => offer.motivo === 'JA_CADASTRADA')) {
      return 'As ofertas idênticas encontradas já estavam cadastradas para este Produto.'
    }
    return 'Nenhuma nova oferta foi cadastrada. Confira se os resultados já existem ou estão sem parceiro, preço ou link válido.'
  }
  if (identicalOffersHasFailures(result)) {
    return 'Nenhuma oferta foi confirmada. Uma ou mais lojas não puderam ser consultadas; tente novamente mais tarde.'
  }
  return 'Nenhum produto idêntico foi confirmado no Mercado Livre, Magazine Luiza ou Shopee.'
}
