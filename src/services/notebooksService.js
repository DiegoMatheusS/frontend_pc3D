import { notebooksMock } from '../data/notebooksMock'
import { apiFirst, extractList } from './dataSource'
import { normalizeNotebook } from './normalizers'

export function getNotebooks() {
  return apiFirst({
    key: 'notebooks',
    path: '/api/notebooks',
    fallback: () => structuredClone(notebooksMock),
    transform: (payload) => extractList(payload, ['notebooks']).map(normalizeNotebook),
  })
}

export function getNotebookById(id) {
  return apiFirst({
    key: 'notebook',
    path: `/api/notebooks/${encodeURIComponent(id)}`,
    fallback: () => structuredClone(notebooksMock.find((item) => String(item.id) === String(id) || item.slug === String(id)) ?? null),
    transform: (payload) => normalizeNotebook(payload?.notebook || payload),
  })
}
