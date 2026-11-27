import { matchesOfferSearch, OFFER_STORES } from '../utils/offerSearchIntent.js'
import { apiRequest } from '../../services/httpClient'

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export const offerDiscoveryService = {
  status(store = "SHOPEE") {
    return apiRequest(store === "SHOPEE" ? '/api/admin/busca-ofertas/shopee/status' : '/api/admin/busca-ofertas/descobrir/status')
  },

  async search({ loja = "SHOPEE", consulta, limite = 24, somentePromocoes = false } = {}) {
    const payload = await apiRequest(loja === 'SHOPEE' ? '/api/admin/busca-ofertas/shopee/produtos' : '/api/admin/busca-ofertas/descobrir', {
      method: 'POST',
      body: {
        ...(loja !== 'SHOPEE' ? {loja} : {}),
        consulta: String(consulta || '').trim(),
        limite: Math.min(Math.max(Number(limite) || 24, 1), 100),
        somentePromocoes: Boolean(somentePromocoes),
      },
    })
    const response = asObject(payload)
    const items = Array.isArray(response.itens) ? response.itens : []
    const results = items.filter((item) => {
      // O serviço novo valida o modelo antes de marcar se o preço foi confirmado.
      if (loja !== 'SHOPEE' && typeof item?.precoConfirmado === 'boolean') return true
      return matchesOfferSearch(consulta, item?.nome)
    })
    return { ...response, itens: results.map(item => ({ ...item, marketplace: loja, parceiroNome: OFFER_STORES[loja] })) }
  },
}
