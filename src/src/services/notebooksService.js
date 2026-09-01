import { notebooksMock } from '../data/notebooksMock'
import { apiFirst, extractList } from './dataSource'
import { normalizeNotebook } from './normalizers'

export function getNotebooks() {
  return apiFirst({
    key: 'notebooks',
    path: '/api/notebooks',
    fallback: () => structuredClone(notebooksMock),
    transform: (payload) => extractList(payload, ['notebooks']).map(normalizeNotebook).filter((item) => item && item.active !== false && item.published !== false),
  })
}

export function getNotebookById(id) {
  return apiFirst({
    key: 'notebook',
    path: `/api/notebooks/${encodeURIComponent(id)}`,
    fallback: () => structuredClone(notebooksMock.find((item) => String(item.id) === String(id) || item.slug === String(id)) ?? null),
    transform: (payload) => {
      const notebook = normalizeNotebook(payload?.notebook || payload)
      return notebook?.active !== false && notebook?.published !== false ? notebook : null
    },
  })
}
