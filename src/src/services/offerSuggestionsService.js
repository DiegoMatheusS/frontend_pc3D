import { apiRequest } from './httpClient'

function extractSuggestions(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.sugestoes)) return payload.sugestoes
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export const offerSuggestionsService = {
  fields: () => apiRequest('/api/ofertas/sugestoes/campos'),
  create: (body) => apiRequest('/api/ofertas/sugestoes', { method: 'POST', body }),
  async mine() {
    const payload = await apiRequest('/api/ofertas/sugestoes/minhas')
    return {
      total: Number(payload?.total ?? extractSuggestions(payload).length),
      sugestoes: extractSuggestions(payload),
    }
  },
  getMine: (id) => apiRequest(`/api/ofertas/sugestoes/minhas/${id}`),
}
