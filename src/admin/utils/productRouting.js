function normalizeType(item) {
  return String(item?.tipo || '').toUpperCase()
}

export function getSpecializedProductTarget(item) {
  const type = normalizeType(item)

  if ((type === 'NOTEBOOK' || item?.notebook?.id) && item?.notebook?.id) {
    return {
      kind: 'NOTEBOOK',
      id: Number(item.notebook.id),
      route: `/admin/notebooks/${item.notebook.id}`,
      label: 'Notebook',
    }
  }

  if ((type === 'BUILD' || item?.build?.id) && item?.build?.id) {
    return {
      kind: 'BUILD',
      id: Number(item.build.id),
      route: `/admin/montados/${item.build.id}`,
      label: 'PC montado',
    }
  }

  return null
}

