import { apiFirst } from './dataSource'
import { normalizeOfferItem } from './normalizers'

const offerGroups = [
  {
    id: 'hardwares',
    label: 'Hardwares',
    description: 'Processadores, placas de vídeo, memória, armazenamento e componentes para a build.',
  },
  {
    id: 'perifericos',
    label: 'Periféricos',
    description: 'Mouse, teclado, headset, microfone e acessórios para completar o uso do computador.',
  },
  {
    id: 'monitores',
    label: 'Monitores',
    description: 'Monitores para jogos, produtividade e criação de conteúdo.',
  },
  {
    id: 'notebooks',
    label: 'Notebooks',
    description: 'Notebooks separados do hardware avulso, com comparação própria de especificações.',
  },
  {
    id: 'setup',
    label: 'Setup',
    description: 'Cadeiras, mesas, mousepads, iluminação e acessórios para o ambiente.',
  },
]

export function getOfferGroups() {
  return Promise.resolve(structuredClone(offerGroups))
}

export function getOffers() {
  return apiFirst({
    key: 'ofertas',
    path: '/api/ofertas/destaques',
    // Ofertas públicas nunca usam dados demonstrativos. Se a API estiver
    // indisponível, a interface informa que não há dados em vez de inventá-los.
    fallback: () => [],
    transform: (payload) => {
      const groups = ['hardwares', 'perifericos', 'monitores', 'notebooks', 'setup']
      const directList = Array.isArray(payload) ? payload : Array.isArray(payload?.ofertas) ? payload.ofertas : []
      if (directList.length) return directList.map(normalizeOfferItem)
      return groups.flatMap((group) => Array.isArray(payload?.[group]) ? payload[group].map(normalizeOfferItem) : [])
    },
  })
}
