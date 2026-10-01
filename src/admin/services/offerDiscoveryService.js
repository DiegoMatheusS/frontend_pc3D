import { apiRequest } from '../../services/httpClient'

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export const offerDiscoveryService = {
  status() {
    return apiRequest('/api/admin/busca-ofertas/shopee/status')
  },

  async search({ consulta, limite = 24, somentePromocoes = false } = {}) {
    const payload = await apiRequest('/api/admin/busca-ofertas/shopee/produtos', {
      method: 'POST',
      body: {
        consulta: String(consulta || '').trim(),
        limite: Math.min(Math.max(Number(limite) || 24, 1), 100),
        somentePromocoes: Boolean(somentePromocoes),
      },
    })
    return asObject(payload)
  },
}
