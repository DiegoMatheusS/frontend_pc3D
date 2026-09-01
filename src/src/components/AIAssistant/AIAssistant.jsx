import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { aiService } from '../../services/aiService'
import { savedBuildsService } from '../../services/savedBuildsService'
import './AIAssistant.css'

const BUILDER_CATEGORY = {
  PROCESSADOR: 'processador',
  COOLER: 'cooler',
  PLACA_MAE: 'placamae',
  MEMORIA_RAM: 'memoria',
  PLACA_VIDEO: 'placavideo',
  ARMAZENAMENTO: 'armazenamento',
  FONTE: 'fonte',
  GABINETE: 'gabinete',
  VENTOINHA: 'ventoinhas',
}

const ARRAY_CATEGORIES = new Set(['memoria', 'armazenamento', 'ventoinhas'])

const STEP_LABELS = {
  PROCESSADOR: 'Processador',
  PLACA_MAE: 'Placa-mãe',
  MEMORIA_RAM: 'Memória RAM',
  PLACA_VIDEO: 'Placa de vídeo',
  ARMAZENAMENTO: 'Armazenamento',
  FONTE: 'Fonte',
  GABINETE: 'Gabinete',
  COOLER: 'Cooler',
  VENTOINHA: 'Ventoinhas',
  RESUMO: 'Resumo',
}

const COMPATIBILITY_LABELS = {
  COMPATIVEL: 'Compatível',
  INCOMPATIVEL: 'Incompatível',
  COMPATIBILIDADE_PARCIAL: 'Compatibilidade parcial',
  DADOS_INSUFICIENTES: 'Dados insuficientes',
}

function contextLabel(pathname) {
  if (pathname.startsWith('/comunidade')) return 'Comunidade'
  if (pathname.startsWith('/montados')) return 'PCs Montados'
  if (pathname.startsWith('/notebooks')) return 'Notebooks'
  if (pathname.startsWith('/ofertas')) return 'Ofertas'
  if (pathname.startsWith('/pecas') || pathname.startsWith('/produto')) return 'Peças'
  if (pathname.startsWith('/loja')) return 'Loja'
  if (pathname.startsWith('/conta')) return 'Conta'
  return 'CriaByte'
}

function quickPrompts(context) {
  if (context === 'Loja' || context === 'Peças' || context === 'Ofertas') {
    return [
      'Recomende peças com bom custo-benefício',
      'Quais produtos valem mais a pena para jogos?',
      'Monta PC até R$ 4.000',
    ]
  }
  if (context === 'Notebooks') {
    return [
      'Recomende um notebook para trabalho',
      'Quero um notebook para jogos',
      'O que devo comparar antes de comprar?',
    ]
  }
  if (context === 'Comunidade' || context === 'PCs Montados') {
    return [
      'Como avaliar se uma build está equilibrada?',
      'Qual peça costuma limitar mais o desempenho?',
      'Monta PC até R$ 4.000',
    ]
  }
  return [
    'Monta PC até R$ 4.000',
    'Qual peça devo melhorar primeiro?',
    'Como escolher uma fonte adequada?',
  ]
}

function extractBudget(text) {
  const explicit = text.match(/(?:r\$|reais?|orçamento(?:\s+de)?|até)\s*([\d.]+(?:,\d{1,2})?)/i)
  const generic = text.match(/\b([1-9]\d{2,5})(?:,\d{1,2})?\b/)
  const raw = explicit?.[1] || generic?.[1]
  if (!raw) return null
  const value = Number(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

function inferUsage(text) {
  if (/\b(jogo|jogos|gamer|gaming|game)\b/i.test(text)) return 'jogos'
  if (/\b(estúdio|estudio|edição|edicao|vídeo|video|áudio|audio|música|musica)\b/i.test(text)) return 'estudio'
  if (/\b(trabalho|office|escritório|escritorio|programação|programacao)\b/i.test(text)) return 'trabalho'
  return 'geral'
}

function inferResolution(text) {
  if (/\b(4k|2160p)\b/i.test(text)) return '4k'
  if (/\b(1440p|2k|qhd)\b/i.test(text)) return '1440p'
  if (/\b(1080p|full\s*hd|fhd)\b/i.test(text)) return '1080p'
  return undefined
}

function inferPreference(text) {
  const matches = ['AMD', 'Intel', 'NVIDIA', 'Radeon', 'GeForce'].filter((brand) => new RegExp(`\\b${brand}\\b`, 'i').test(text))
  return matches.length ? matches.join(' / ').slice(0, 50) : undefined
}

function isBuildRequest(text) {
  return Boolean(extractBudget(text)) && /\b(mont|build|configura|pc\b|computador)/i.test(text)
}

function isStoreRequest(text, context) {
  const shoppingWords = /\b(recomend|compr|oferta|preço|preco|custo.?benef|opç|opcao|opção|produto|peça|peca|notebook|monitor|mouse|teclado|headset)\b/i
  return shoppingWords.test(text) && ['Loja', 'Peças', 'Ofertas', 'Notebooks'].includes(context)
}

function responseError(error) {
  if (error?.status === 429) return 'Muitas solicitações em pouco tempo. Aguarde um momento e tente novamente.'
  if (error?.status === 503) return 'O assistente inteligente está temporariamente indisponível. Os demais recursos do site continuam funcionando.'
  if (error?.status === 0) return 'Não foi possível acessar o assistente agora. Verifique se o backend está rodando e tente novamente.'
  return error?.message || 'Não foi possível obter uma resposta da IA.'
}

function historyForBackend(messages) {
  return messages
    .filter((message) => message.role === 'user' || (message.role === 'assistant' && !message.initial))
    .slice(-10)
    .map((message) => ({
      papel: message.role === 'user' ? 'usuario' : 'assistente',
      conteudo: String(message.text || '').slice(0, 4000),
    }))
}

function guidedComponentForBackend(component = {}) {
  const hardwareId = Number(component.hardwareId)
  return {
    categoria: component.categoria,
    ...(Number.isInteger(hardwareId) && hardwareId > 0 ? { hardwareId } : {}),
    nome: String(component.nome || '').slice(0, 200),
    ...(component.marca ? { marca: String(component.marca).slice(0, 100) } : {}),
    ...(component.modelo ? { modelo: String(component.modelo).slice(0, 150) } : {}),
    ...(component.imagemUrl ? { imagemUrl: String(component.imagemUrl).slice(0, 500) } : {}),
    ...(component.modelo3dUrl ? { modelo3dUrl: String(component.modelo3dUrl).slice(0, 500) } : {}),
    quantidade: Math.max(1, Number(component.quantidade) || 1),
    origem: component.origem || (Number.isInteger(hardwareId) && hardwareId > 0 ? 'CATALOGO' : 'EXTERNO'),
    ...(component.especificacoes && typeof component.especificacoes === 'object' ? { especificacoes: component.especificacoes } : {}),
    ...(component.fonteDadosUrl ? { fonteDadosUrl: String(component.fonteDadosUrl).slice(0, 500) } : {}),
  }
}

function builderConfiguration(components = []) {
  const configuration = {}
  components.forEach((component, index) => {
    const key = BUILDER_CATEGORY[String(component?.categoria || '').toUpperCase()]
    if (!key) return
    const hardwareId = Number(component?.hardwareId)
    const isCatalog = Number.isInteger(hardwareId) && hardwareId > 0
    const value = isCatalog
      ? { id: String(hardwareId), hardwareId }
      : {
          id: `ia-externo-${String(component?.categoria || 'peca').toLowerCase()}-${index + 1}`,
          hardwareId: null,
          origem: component?.origem || 'EXTERNO',
          nome: component?.nome || 'Peça externa',
          marca: component?.marca || '',
          modelo: component?.modelo || '',
          imagemUrl: component?.imagemUrl || '',
          modelo3dUrl: component?.modelo3dUrl || '',
          fonteDadosUrl: component?.fonteDadosUrl || '',
          especificacoes: component?.especificacoes || {},
          quantidade: Math.max(1, Number(component?.quantidade) || 1),
        }

    if (ARRAY_CATEGORIES.has(key)) {
      if (!Array.isArray(configuration[key])) configuration[key] = []
      configuration[key].push(value)
    } else {
      configuration[key] = value
    }
  })
  return configuration
}

function formatMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function countUnpriced(flow) {
  const items = Array.isArray(flow?.compra?.itens) ? flow.compra.itens : []
  return items.reduce((total, item) => total + (item?.compravel ? 0 : Math.max(1, Number(item?.quantidade) || 1)), 0)
}

function compatibilityClass(status) {
  return String(status || 'DADOS_INSUFICIENTES').toLowerCase().replaceAll('_', '-')
}

export default function AIAssistant() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([])
  const [guidedFlow, setGuidedFlow] = useState(null)
  const [guidedMeta, setGuidedMeta] = useState({})
  const [filterDraft, setFilterDraft] = useState('')
  const [externalOpen, setExternalOpen] = useState(false)
  const [externalDraft, setExternalDraft] = useState({ nome: '', marca: '', modelo: '', especificacoes: '', fonteDadosUrl: '', modelo3dUrl: '' })

  const context = useMemo(() => contextLabel(location.pathname), [location.pathname])
  const prompts = useMemo(() => quickPrompts(context), [context])

  if (location.pathname === '/montar') return null

  function scrollMessages() {
    window.setTimeout(() => {
      const element = panelRef.current?.querySelector('.ai-assistant-panel__messages')
      if (element) element.scrollTop = element.scrollHeight
    }, 0)
  }

  function addAssistantMessage(message) {
    setMessages((items) => [...items, { role: 'assistant', ...message }])
    scrollMessages()
  }

  function applyGuidedFlow(flow, meta = {}) {
    if (!flow || flow.tipo !== 'MONTAGEM_GUIADA') return false
    setGuidedFlow(flow)
    setGuidedMeta((current) => ({ ...current, ...meta }))
    setFilterDraft('')
    setExternalOpen(false)
    scrollMessages()
    return true
  }

  function openBuildIn3D(components) {
    const configuration = builderConfiguration(components)
    if (Object.keys(configuration).length) {
      sessionStorage.setItem('configurarPc3D', JSON.stringify(configuration))
      sessionStorage.setItem('pcBuilderIaMontagemSnapshot', JSON.stringify(components.map(guidedComponentForBackend)))
    }
    setOpen(false)
    navigate('/montar')
  }

  function publishGuidedBuild(flow) {
    const components = flow?.buildComunidade?.componentes || flow?.componentes || []
    const configuration = builderConfiguration(components)
    const pending = {
      id: 'montagem-ia',
      nome: 'Montagem criada com IA',
      origem: 'ia',
      temporaria: true,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
      precoTotal: Number(flow?.compra?.valorTotal || 0),
      consumoTotal: 0,
      quantidade: components.reduce((total, item) => total + Math.max(1, Number(item?.quantidade) || 1), 0),
      configuracao: configuration,
      componentes: components.map(guidedComponentForBackend),
    }
    sessionStorage.setItem('pcBuilderPublicacaoPendente', JSON.stringify(pending))
    setOpen(false)
    navigate('/comunidade/publicar')
  }

  function saveGuidedBuild(flow) {
    const components = flow?.buildComunidade?.componentes || flow?.componentes || []
    if (!components.length) return
    if (!user?.email) {
      addAssistantMessage({ text: 'Entre na sua conta para salvar esta montagem e continuar editando depois.' })
      return
    }
    const configuration = builderConfiguration(components)
    const name = `Montagem IA ${new Date().toLocaleDateString('pt-BR')}`
    const result = savedBuildsService.saveConfiguration(user.email, configuration, name, {
      componentes: components.map(guidedComponentForBackend),
      precoTotal: Number(flow?.compra?.valorTotal || 0),
      quantidade: components.reduce((total, item) => total + Math.max(1, Number(item?.quantidade) || 1), 0),
    })
    addAssistantMessage({ text: `Montagem salva como “${result.build.nome}”.` })
  }

  async function runGuidedAction(action, extra = {}) {
    if (!guidedFlow || sending) return
    setSending(true)
    try {
      const payload = {
        acao: action,
        etapaAtual: guidedFlow.etapa,
        componentes: (guidedFlow.componentes || []).map(guidedComponentForBackend),
        ...(Number.isInteger(Number(guidedFlow.pagina)) ? { pagina: Number(guidedFlow.pagina) } : {}),
        ...(guidedMeta.orcamento ? { orcamento: guidedMeta.orcamento } : {}),
        ...(guidedMeta.uso ? { uso: guidedMeta.uso } : {}),
        ...extra,
      }
      const result = await aiService.guidedBuild(payload)
      applyGuidedFlow(result)
    } catch (error) {
      addAssistantMessage({ text: responseError(error), error: true })
    } finally {
      setSending(false)
    }
  }

  async function selectExternalPart(event) {
    event.preventDefault()
    if (!guidedFlow || !externalDraft.nome.trim() || sending) return
    let specs
    try {
      specs = externalDraft.especificacoes.trim() ? JSON.parse(externalDraft.especificacoes) : undefined
    } catch {
      addAssistantMessage({ text: 'As especificações da peça externa precisam estar em JSON válido.', error: true })
      return
    }

    await runGuidedAction('SELECIONAR', {
      selecao: {
        categoria: guidedFlow.etapa,
        nome: externalDraft.nome.trim(),
        ...(externalDraft.marca.trim() ? { marca: externalDraft.marca.trim() } : {}),
        ...(externalDraft.modelo.trim() ? { modelo: externalDraft.modelo.trim() } : {}),
        origem: 'EXTERNO',
        ...(specs ? { especificacoes: specs } : {}),
        ...(externalDraft.fonteDadosUrl.trim() ? { fonteDadosUrl: externalDraft.fonteDadosUrl.trim() } : {}),
        ...(externalDraft.modelo3dUrl.trim() ? { modelo3dUrl: externalDraft.modelo3dUrl.trim() } : {}),
      },
    })
    setExternalDraft({ nome: '', marca: '', modelo: '', especificacoes: '', fonteDadosUrl: '', modelo3dUrl: '' })
  }

  async function send(text = draft) {
    const clean = String(text || '').trim()
    if (!clean || sending) return

    const previousMessages = messages
    setMessages((items) => [...items, { role: 'user', text: clean }])
    setDraft('')
    setSending(true)

    try {
      const budget = extractBudget(clean)
      const usage = inferUsage(clean)

      if (isBuildRequest(clean)) {
        const result = await aiService.buildPc({
          orcamento: budget,
          uso: usage,
          ...(inferResolution(clean) ? { resolucao: inferResolution(clean) } : {}),
          ...(inferPreference(clean) ? { preferencia: inferPreference(clean) } : {}),
        })
        addAssistantMessage({
          text: result?.resposta || 'A IA não retornou uma explicação para a build.',
          type: 'build',
          components: Array.isArray(result?.componentes) ? result.componentes : [],
          total: result?.valorTotal,
          watts: result?.consumoWatts,
          actions: Array.isArray(result?.acoes) ? result.acoes : [],
        })
        applyGuidedFlow(result?.fluxoGuiado, { orcamento: budget, uso: usage })
        return
      }

      if (isStoreRequest(clean, context)) {
        const result = await aiService.recommendStore({
          mensagem: clean.slice(0, 1000),
          ...(budget ? { orcamento: budget } : {}),
          limite: 5,
        })
        addAssistantMessage({
          text: result?.resposta || 'A IA não retornou uma recomendação.',
          type: 'products',
          products: Array.isArray(result?.produtos) ? result.produtos : [],
        })
        return
      }

      const result = await aiService.chat({
        mensagem: clean.slice(0, 1000),
        historico: historyForBackend(previousMessages),
        ...(budget ? { orcamento: budget } : {}),
        uso: usage,
        ...(guidedFlow?.componentes?.length ? { buildAtual: { componentes: guidedFlow.componentes, compatibilidade: guidedFlow.compatibilidade } } : {}),
      })
      addAssistantMessage({ text: result?.resposta || 'A IA não retornou uma resposta.' })
      applyGuidedFlow(result?.fluxoGuiado, { orcamento: budget || guidedMeta.orcamento, uso: usage || guidedMeta.uso })
    } catch (error) {
      addAssistantMessage({ text: responseError(error), error: true })
    } finally {
      setSending(false)
    }
  }

  const guidedStatus = guidedFlow?.compatibilidade?.status
  const unpricedCount = countUnpriced(guidedFlow)
  const price = formatMoney(guidedFlow?.compra?.valorTotal)

  return (
    <>
      <button
        className="ai-assistant-button"
        type="button"
        aria-label="Abrir assistente de IA"
        aria-expanded={open}
        title="Assistente de IA"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? '×' : '✦'}</span>
      </button>

      <aside ref={panelRef} className={`ai-assistant-panel ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Assistente de IA">
        <header className="ai-assistant-panel__header">
          <div className="ai-assistant-panel__icon" aria-hidden="true">✦</div>
          <div><strong>Assistente CriaByte</strong><small>Contexto: {context}</small></div>
          <button type="button" aria-label="Fechar assistente" onClick={() => setOpen(false)}>×</button>
        </header>

        <div className="ai-assistant-panel__messages" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`ai-message ai-message--${message.role}${message.error ? ' ai-message--error' : ''}`}>
              <div className="ai-message__text">{message.text}</div>

              {message.type === 'build' && (message.total || message.watts) && (
                <div className="ai-build-summary">
                  {formatMoney(message.total) && <span><small>Preço real encontrado</small><strong>{formatMoney(message.total)}</strong></span>}
                  {Number(message.watts) > 0 && <span><small>Consumo estimado</small><strong>{Number(message.watts)} W</strong></span>}
                </div>
              )}

              {message.type === 'build' && Array.isArray(message.components) && message.components.length > 0 && (
                <div className="ai-message__actions">
                  <button type="button" onClick={() => openBuildIn3D(message.components)}>Abrir no 3D</button>
                  <button type="button" onClick={() => { setOpen(false); navigate('/ofertas') }}>Ver ofertas</button>
                </div>
              )}

              {message.type === 'products' && Array.isArray(message.products) && message.products.length > 0 && (
                <div className="ai-product-list">
                  {message.products.map((product) => {
                    const offer = product?.melhorOferta
                    const productPrice = formatMoney(offer?.preco)
                    const externalUrl = offer?.urlAfiliada || offer?.urlOriginal
                    return (
                      <article className="ai-product-card" key={product.id}>
                        <div>
                          <small>{product?.categoria?.nome || 'Produto'}</small>
                          <strong>{product.nome}</strong>
                          {productPrice && <span>{productPrice}</span>}
                        </div>
                        <div className="ai-product-card__actions">
                          <Link to={`/produto/${encodeURIComponent(product.slug || product.id)}`} onClick={() => setOpen(false)}>Ver produto</Link>
                          {externalUrl && <a href={externalUrl} target="_blank" rel="sponsored noopener noreferrer">Comprar</a>}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {guidedFlow && (
            <section className="ai-guided" aria-label="Montagem guiada">
              <div className="ai-guided__heading">
                <div><small>Montagem guiada</small><strong>{STEP_LABELS[guidedFlow.etapa] || guidedFlow.etapa}</strong></div>
                {guidedStatus && <span className={`ai-compat ai-compat--${compatibilityClass(guidedStatus)}`}>{COMPATIBILITY_LABELS[guidedStatus] || guidedStatus}</span>}
              </div>
              <p className="ai-guided__message">{guidedFlow.mensagem}</p>

              {Array.isArray(guidedFlow.componentes) && guidedFlow.componentes.length > 0 && (
                <details className="ai-guided__summary" open={guidedFlow.etapa === 'RESUMO'}>
                  <summary>Montagem atual ({guidedFlow.componentes.length})</summary>
                  <div className="ai-guided__components">
                    {guidedFlow.componentes.map((component, index) => (
                      <div key={`${component.categoria}-${component.hardwareId || component.nome}-${index}`}>
                        <span>{STEP_LABELS[component.categoria] || component.categoria}</span>
                        <strong>{component.nome}</strong>
                        <small>{component.origem === 'CATALOGO' ? 'Catálogo' : 'Fora do catálogo'}</small>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {guidedStatus && (
                <div className="ai-guided__compatibility">
                  {guidedFlow.compatibilidade?.erros?.map((item) => <p className="is-error" key={item}>{item}</p>)}
                  {guidedFlow.compatibilidade?.alertas?.map((item) => <p className="is-warning" key={item}>{item}</p>)}
                </div>
              )}

              {Array.isArray(guidedFlow.filtrosRapidos) && guidedFlow.filtrosRapidos.length > 0 && (
                <div className="ai-guided__chips">
                  {guidedFlow.filtrosRapidos.map((filter) => <button type="button" key={filter} disabled={sending} onClick={() => runGuidedAction('FILTRAR', { filtro: filter })}>{filter}</button>)}
                </div>
              )}

              {guidedFlow.etapa !== 'RESUMO' && (
                <form className="ai-guided__filter" onSubmit={(event) => { event.preventDefault(); if (filterDraft.trim()) runGuidedAction('FILTRAR', { filtro: filterDraft.trim() }) }}>
                  <input value={filterDraft} onChange={(event) => setFilterDraft(event.target.value)} placeholder={`Filtrar ${STEP_LABELS[guidedFlow.etapa]?.toLowerCase() || 'opções'}...`} />
                  <button type="submit" disabled={sending || !filterDraft.trim()}>Filtrar</button>
                </form>
              )}

              {Array.isArray(guidedFlow.opcoes) && guidedFlow.opcoes.length > 0 && (
                <div className="ai-guided__options">
                  {guidedFlow.opcoes.map((option) => (
                    <article className="ai-guided-option" key={option.id}>
                      {option.imagemUrl ? <img src={option.imagemUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} /> : <div className="ai-guided-option__placeholder" aria-hidden="true">PC</div>}
                      <div className="ai-guided-option__body">
                        <small>{option.subtitulo || STEP_LABELS[option.categoria]}</small>
                        <strong>{option.titulo}</strong>
                        <div className="ai-guided-option__meta">
                          <span className={`ai-compat ai-compat--${compatibilityClass(option.compatibilidade)}`}>{COMPATIBILITY_LABELS[option.compatibilidade] || option.compatibilidade}</span>
                          {option.preco != null ? <b>{formatMoney(option.preco)}</b> : <b>Preço indisponível</b>}
                        </div>
                        <button type="button" disabled={sending} onClick={() => runGuidedAction('SELECIONAR', { selecao: guidedComponentForBackend(option.selecao) })}>Selecionar</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {externalOpen && guidedFlow.etapa !== 'RESUMO' && (
                <form className="ai-guided-external" onSubmit={selectExternalPart}>
                  <div className="ai-guided-external__title"><strong>Peça fora do catálogo</strong><button type="button" onClick={() => setExternalOpen(false)} aria-label="Fechar">×</button></div>
                  <input required value={externalDraft.nome} onChange={(event) => setExternalDraft((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome da peça" />
                  <div className="ai-guided-external__row">
                    <input value={externalDraft.marca} onChange={(event) => setExternalDraft((current) => ({ ...current, marca: event.target.value }))} placeholder="Marca (opcional)" />
                    <input value={externalDraft.modelo} onChange={(event) => setExternalDraft((current) => ({ ...current, modelo: event.target.value }))} placeholder="Modelo (opcional)" />
                  </div>
                  <textarea value={externalDraft.especificacoes} onChange={(event) => setExternalDraft((current) => ({ ...current, especificacoes: event.target.value }))} placeholder={'Especificações técnicas em JSON (opcional)\nEx.: {"socket":"AM5","tdpWatts":65}'} />
                  <input type="url" value={externalDraft.fonteDadosUrl} onChange={(event) => setExternalDraft((current) => ({ ...current, fonteDadosUrl: event.target.value }))} placeholder="URL da fonte dos dados (opcional)" />
                  <input type="url" value={externalDraft.modelo3dUrl} onChange={(event) => setExternalDraft((current) => ({ ...current, modelo3dUrl: event.target.value }))} placeholder="URL do modelo 3D (opcional)" />
                  <button type="submit" disabled={sending || !externalDraft.nome.trim()}>Usar esta peça</button>
                </form>
              )}

              {guidedFlow.etapa === 'RESUMO' && (
                <div className="ai-guided__purchase">
                  <span><small>{guidedFlow.compra?.completo ? 'Total atual' : 'Total com preço disponível'}</small><strong>{price || 'Sem preços disponíveis'}</strong></span>
                  {unpricedCount > 0 && <p>{unpricedCount} {unpricedCount === 1 ? 'peça ainda não possui' : 'peças ainda não possuem'} preço/oferta no catálogo.</p>}
                </div>
              )}

              <div className="ai-guided__actions">
                {guidedFlow.acoes?.includes('VER_MAIS') && <button type="button" disabled={sending} onClick={() => runGuidedAction('VER_MAIS')}>Ver mais</button>}
                {guidedFlow.acoes?.includes('IA_DECIDIR') && <button type="button" className="is-primary" disabled={sending} onClick={() => runGuidedAction('IA_DECIDIR')}>Deixar a IA decidir</button>}
                {guidedFlow.acoes?.includes('ESCOLHER_MANUALMENTE') && <button type="button" disabled={sending} onClick={() => openBuildIn3D(guidedFlow.componentes || [])}>Escolher manualmente no 3D</button>}
                {guidedFlow.acoes?.includes('ADICIONAR_FORA_CATALOGO') && <button type="button" disabled={sending} onClick={() => setExternalOpen((value) => !value)}>Adicionar fora do catálogo</button>}
                {guidedFlow.acoes?.includes('PULAR') && <button type="button" disabled={sending} onClick={() => runGuidedAction('PULAR')}>Pular</button>}
                {guidedFlow.acoes?.includes('VOLTAR') && <button type="button" disabled={sending} onClick={() => runGuidedAction('VOLTAR')}>Voltar</button>}
                {guidedFlow.etapa === 'RESUMO' && <button type="button" className="is-primary" onClick={() => openBuildIn3D(guidedFlow.componentes || [])}>Abrir no 3D</button>}
                {guidedFlow.etapa === 'RESUMO' && <button type="button" onClick={() => saveGuidedBuild(guidedFlow)}>Salvar montagem</button>}
                {guidedFlow.etapa === 'RESUMO' && <button type="button" onClick={() => publishGuidedBuild(guidedFlow)}>Publicar na comunidade</button>}
              </div>

              <button className="ai-guided__cancel" type="button" onClick={() => { setGuidedFlow(null); setExternalOpen(false) }}>Encerrar montagem guiada</button>
            </section>
          )}

          {sending && <div className="ai-assistant-typing" aria-label="Assistente está respondendo"><span /><span /><span /></div>}
        </div>

        {!guidedFlow && (
          <div className="ai-assistant-panel__quick">
            {prompts.map((prompt) => <button key={prompt} type="button" disabled={sending} onClick={() => send(prompt)}>{prompt}</button>)}
          </div>
        )}

        <form className="ai-assistant-panel__form" onSubmit={(event) => { event.preventDefault(); send() }}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            placeholder={guidedFlow ? 'Você também pode conversar normalmente com a IA...' : 'Pergunte sobre uma build, peça ou oferta...'}
            maxLength={1000}
            disabled={sending}
          />
          <button className="button button--primary" type="submit" disabled={sending || !draft.trim()}>{sending ? '...' : 'Enviar'}</button>
        </form>
      </aside>
    </>
  )
}
