import { apiRequest } from './httpClient'

export const aiService = {
  chat(body) {
    return apiRequest('/api/ia/chat', {
      method: 'POST',
      body,
    })
  },

  buildPc(body) {
    return apiRequest('/api/ia/montar-pc', {
      method: 'POST',
      body,
    })
  },

  guidedBuild(body) {
    return apiRequest('/api/ia/montagem-guiada', {
      method: 'POST',
      body,
    })
  },

  recommendStore(body) {
    return apiRequest('/api/ia/loja/recomendar', {
      method: 'POST',
      body,
    })
  },
}
