import { useSyncExternalStore } from 'react'
import { useAuth } from '../../contexts/authContext'
import { getDiscoverySession } from '../utils/discoverySession'

export function useDiscoverySession(type) {
  const { user } = useAuth()
  const userId = String(user?.id ?? user?.email ?? '')
  const session = getDiscoverySession(type, userId)
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  return { state, setters: session.setters }
}
