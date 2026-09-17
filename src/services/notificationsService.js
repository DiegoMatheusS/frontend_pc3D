import { apiRequest } from './httpClient'

export async function getNotifications(limit = 30) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100)
  const payload = await apiRequest(`/api/notificacoes?limite=${safeLimit}`)
  return {
    unread: Number(payload?.naoLidas) || 0,
    notifications: Array.isArray(payload?.notificacoes) ? payload.notificacoes : [],
  }
}

export function markNotificationRead(id) {
  return apiRequest(`/api/notificacoes/${encodeURIComponent(id)}/lida`, {
    method: 'PATCH',
  })
}

export function markAllNotificationsRead() {
  return apiRequest('/api/notificacoes/ler-todas', {
    method: 'PATCH',
  })
}
