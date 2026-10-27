import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { STORE_CATEGORY_LABELS, STORE_GROUP_LABELS, STORE_SECTION_LABELS } from '../../data/storeNavigation'

const DEFAULT_DESCRIPTION = 'Monte seu PC, compare peças, notebooks e computadores montados, confira compatibilidade e encontre ofertas.'

function storeMeta(search) {
  const params = new URLSearchParams(search)
  const label = STORE_CATEGORY_LABELS[params.get('categoria')]
    || STORE_SECTION_LABELS[params.get('secao')]
    || STORE_GROUP_LABELS[params.get('grupo')]
  return label
    ? [`${label} — CriaByte`, `Compare ${label.toLowerCase()}, especificações e ofertas disponíveis.`]
    : ['Todos os produtos — CriaByte', 'Explore o catálogo de hardware, periféricos, monitores, notebooks e itens para setup.']
}

const metas = [
  [/^\/$/, 'CriaByte — Monte, compare e encontre ofertas', DEFAULT_DESCRIPTION],
  [/^\/montar/, 'Monte seu PC — CriaByte', 'Monte seu computador em 3D, escolha as peças e acompanhe compatibilidade, consumo e configuração em tempo real.'],
  [/^\/pecas/, 'Peças para computador — CriaByte', 'Pesquise e compare peças de computador, especificações técnicas, avaliações e ofertas.'],
  [/^\/produto\//, 'Produto — CriaByte', 'Veja especificações, avaliações e ofertas disponíveis para este produto.'],
  [/^\/ofertas/, 'Ofertas — CriaByte', 'Compare ofertas por categoria, preço e loja antes de comprar.'],
  [/^\/notebooks\//, 'Notebook — CriaByte', 'Veja especificações, possibilidade de upgrade, avaliações e ofertas deste notebook.'],
  [/^\/notebooks/, 'Notebooks — CriaByte', 'Compare notebooks por processador, GPU, memória, tela, bateria, peso, upgrades e preço.'],
  [/^\/montados\//, 'PC Montado — CriaByte', 'Confira a configuração completa, avaliações, ofertas e opções de compra deste PC montado.'],
  [/^\/montados/, 'PCs Montados — CriaByte', 'Compare computadores montados por configuração, avaliação, consumo e preço.'],
  [/^\/comunidade\/publicar$/, 'Publicar Build — CriaByte', 'Compartilhe sua configuração com a comunidade e ajude outras pessoas a montar um PC.'],
  [/^\/comunidade\//, 'Build da Comunidade — CriaByte', 'Veja detalhes, componentes, comentários e avaliações desta build compartilhada.'],
  [/^\/comunidade/, 'Comunidade — CriaByte', 'Descubra builds reais, compartilhe configurações, avalie e troque ideias com a comunidade.'],
  [/^\/minhas-builds/, 'Minhas Builds — CriaByte', 'Organize, edite, compartilhe e reabra suas configurações salvas.'],
  [/^\/conta\/editar/, 'Alterar cadastro — CriaByte', 'Atualize seus dados de conta e configurações de segurança.'],
  [/^\/conta/, 'Minha Conta — CriaByte', 'Acesse suas builds, publicações e configurações de conta.'],
  [/^\/sobre/, 'Sobre — CriaByte', 'Conheça a proposta do CriaByte e como a plataforma ajuda na escolha e montagem de computadores.'],
  [/^\/contato/, 'Contato — CriaByte', 'Envie dúvidas, sugestões, correções ou propostas relacionadas ao CriaByte.'],
  [/^\/privacidade/, 'Privacidade — CriaByte', 'Consulte a política de privacidade e entenda como os dados podem ser utilizados.'],
  [/^\/termos/, 'Termos de uso — CriaByte', 'Consulte os termos e condições para utilização do CriaByte.'],
  [/^\/cookies/, 'Cookies — CriaByte', 'Entenda como cookies e armazenamento do navegador podem ser utilizados no CriaByte.'],
  [/^\/entrar/, 'Entrar — CriaByte', 'Entre na sua conta para acessar builds, comunidade e recursos personalizados.'],
  [/^\/cadastro/, 'Criar conta — CriaByte', 'Crie sua conta para salvar configurações e participar da comunidade.'],
]

function upsertMeta(selector, attrs, content) {
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value))
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

function upsertLink(selector, attrs) {
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('link')
    document.head.appendChild(node)
  }
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value))
}

export default function RouteEffects() {
  const location = useLocation()
  const previousPageRef = useRef(null)
  const params = new URLSearchParams(location.search)
  const pageKey = JSON.stringify([location.pathname,
    ...(['/loja', '/pecas'].includes(location.pathname)
      ? ['secao', 'grupo', 'categoria'].map((key) => params.get(key)) : []),
  ])

  useEffect(() => {
    let title
    let description
    if (location.pathname === '/loja') [title, description] = storeMeta(location.search)
    else {
      const match = metas.find(([pattern]) => pattern.test(location.pathname))
      title = match?.[1] || 'CriaByte'
      description = match?.[2] || DEFAULT_DESCRIPTION
    }

    // A aba do navegador usa somente a marca. Os títulos detalhados continuam
    // nos metadados sociais/SEO para não perder contexto de compartilhamento.
    document.title = 'CriaByte'
    upsertMeta('meta[name="description"]', { name: 'description' }, description)
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title)
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description)
    upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'website')

    const privateRoute = /^(\/entrar|\/cadastro|\/recuperar-senha|\/redefinir-senha|\/conta(?:\/|$)|\/minhas-builds(?:\/|$)|\/comunidade\/publicar)/.test(location.pathname)
    upsertMeta('meta[name="robots"]', { name: 'robots' }, privateRoute ? 'noindex,nofollow' : 'index,follow')

    const canonicalUrl = `${window.location.origin}${location.pathname}`
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl })
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)

  }, [location.pathname, location.search])

  useEffect(() => {
    const previousPage = previousPageRef.current
    previousPageRef.current = pageKey

    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        const target = document.getElementById(location.hash.slice(1))
        target?.scrollIntoView({ block: 'start' })
      } else if (previousPage !== pageKey) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      }
      document.getElementById('conteudo-principal')?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pageKey, location.hash])

  return null
}
