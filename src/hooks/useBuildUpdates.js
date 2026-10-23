import { useEffect, useState } from 'react'
export function useBuildUpdates(owner) {
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const update = event => { if (event.detail?.owner === owner) setRevision(value => value + 1) }
    window.addEventListener('criabyte:builds-updated', update)
    return () => window.removeEventListener('criabyte:builds-updated', update)
  }, [owner])
  return revision
}
