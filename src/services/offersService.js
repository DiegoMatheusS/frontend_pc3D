import { offerGroups, offersMock } from '../data/offersMock'
import { apiFirst } from './dataSource'
import { normalizeOfferItem } from './normalizers'

export function getOfferGroups() {
  return Promise.resolve(structuredClone(offerGroups))
}

export function getOffers() {
  return apiFirst({
    key: 'ofertas',
    path: '/api/ofertas/destaques',
    fallback: () => structuredClone(offersMock),
    transform: (payload) => {
      const groups = ['hardwares', 'perifericos', 'monitores', 'notebooks', 'setup']
      return groups.flatMap((group) => Array.isArray(payload?.[group]) ? payload[group].map(normalizeOfferItem) : [])
    },
  })
}
