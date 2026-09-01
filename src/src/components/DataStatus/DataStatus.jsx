import { useSyncExternalStore } from 'react'
import { getDataSourcesSnapshot, subscribeDataSources } from '../../services/dataSource'
import './DataStatus.css'

export default function DataStatus() {
  const snapshot = useSyncExternalStore(subscribeDataSources, getDataSourcesSnapshot, getDataSourcesSnapshot)
  const entries = Object.entries(snapshot.sources)
  if (!entries.length) return null

  const mockEntries = entries.filter(([, value]) => value.source === 'mock')
  if (!mockEntries.length) return null

  const failed = mockEntries.filter(([, value]) => value.error)
  const title = failed.length
    ? `A API ainda não respondeu para: ${failed.map(([key]) => key).join(', ')}. O site usou dados locais de demonstração.`
    : 'O site está usando dados locais de demonstração.'

  return (
    <div className="data-status data-status--mock" title={title}>
      <span className="data-status__dot" aria-hidden="true" />
      Dados locais
    </div>
  )
}
