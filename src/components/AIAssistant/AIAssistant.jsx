import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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

const USAGE_OPTIONS = [
  { value: 'jogos', label: 'Jogos' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'estudio', label: 'Edição / Estúdio' },
  { value: 'geral', label: 'Uso geral' },
]

const BUDGET_OPTIONS = [
  { value: 3000, label: 'Até R$ 3.000' },
  { value: 4000, label: 'Até R$ 4.000' },
  { value: 5000, label: 'Até R$ 5.000' },
  { value: 7000, label: 'Até R$ 7.000' },
  { value: 10000, label: 'Até R$ 10.000' },
  { value: null, label: 'Sem orçamento definido' },
]

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

function responseError(error) {
  if (error?.status === 429) return 'Muitas solicitações em pouco tempo. Aguarde um momento e tente novamente.'
  if (error?.status === 503) return 'O assistente está temporariamente indisponível. Tente novamente em instantes.'
  if (error?.status === 0) return 'Não foi possível acessar o assistente agora. Tente novamente em instantes.'
  return error?.message || 'Não foi possível continuar a montagem.'
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
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([])
  const [guidedFlow, setGuidedFlow] = useState(null)
  const [guidedMeta, setGuidedMeta] = useState({ uso: null, orcamento: null })
  const [setupStep, setSetupStep] = useState('MENU')

  const context = contextLabel(location.pathname)

  if (location.pathname === '/montar') return null

  function scrollMessages() {
    window.setTimeout(() => {
      const element = panelRef.current?.querySelector('.ai-assistant-panel__messages')
      if (element) element.scrollTop = element.scrollHeight
    }, 0)
  }

  function addAssistantMessage(text, error = false) {
    setMessages((items) => [...items, { role: 'assistant', text, error }])
    scrollMessages()
  }

  function resetFlow() {
    setGuidedFlow(null)
    setGuidedMeta({ uso: null, orcamento: null })
    setSetupStep('MENU')
    setMessages([])
  }

  function applyGuidedFlow(flow) {
    if (!flow || flow.tipo !== 'MONTAGEM_GUIADA') return false
    setGuidedFlow(flow)
    setSetupStep('FLOW')
    scrollMessages()
    return true
  }

  async function startGuidedBuild(budget) {
    if (!guidedMeta.uso || sending) return
    setSending(true)
    const meta = { ...guidedMeta, orcamento: budget }
    setGuidedMeta(meta)
    try {
      const result = await aiService.guidedBuild({
        acao: 'INICIAR',
        componentes: [],
        uso: meta.uso,
        ...(budget ? { orcamento: budget } : {}),
      })
      if (!applyGuidedFlow(result)) {
        addAssistantMessage('Não foi possível iniciar a montagem guiada.', true)
      }
    } catch (error) {
      addAssistantMessage(responseError(error), true)
    } finally {
      setSending(false)
    }
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
      if (!applyGuidedFlow(result)) {
        addAssistantMessage('Não foi possível avançar para a próxima etapa.', true)
      }
    } catch (error) {
      addAssistantMessage(responseError(error), true)
    } finally {
      setSending(false)
    }
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
      addAssistantMessage('Entre na sua conta para salvar esta montagem e continuar editando depois.')
      return
    }
    const configuration = builderConfiguration(components)
    const name = `Montagem IA ${new Date().toLocaleDateString('pt-BR')}`
    const result = savedBuildsService.saveConfiguration(user.email, configuration, name, {
      componentes: components.map(guidedComponentForBackend),
      precoTotal: Number(flow?.compra?.valorTotal || 0),
      quantidade: components.reduce((total, item) => total + Math.max(1, Number(item?.quantidade) || 1), 0),
    })
    addAssistantMessage(`Montagem salva como “${result.build.nome}”.`)
  }

  const guidedStatus = guidedFlow?.compatibilidade?.status
  const unpricedCount = countUnpriced(guidedFlow)
  const price = formatMoney(guidedFlow?.compra?.valorTotal)

  return (
    <>
      <button
        className="ai-assistant-button"
        type="button"
        aria-label="Abrir assistente"
        aria-expanded={open}
        title="Assistente CriaByte"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? '×' : '✦'}</span>
      </button>

      <aside ref={panelRef} className={`ai-assistant-panel ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Assistente CriaByte">
        <header className="ai-assistant-panel__header">
          <div className="ai-assistant-panel__icon" aria-hidden="true">✦</div>
          <div><strong>Assistente CriaByte</strong><small>{context} · escolha uma opção</small></div>
          <button type="button" aria-label="Fechar assistente" onClick={() => setOpen(false)}>×</button>
        </header>

        <div className="ai-assistant-panel__messages" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`assistant-${index}`} className={`ai-message ai-message--assistant${message.error ? ' ai-message--error' : ''}`}>
              <div className="ai-message__text">{message.text}</div>
            </div>
          ))}

          {!guidedFlow && setupStep === 'MENU' && (
            <section className="ai-guided" aria-label="Opções do assistente">
              <div className="ai-guided__heading"><div><small>Assistente</small><strong>O que você quer fazer?</strong></div></div>
              <p className="ai-guided__message">Escolha uma opção. O assistente vai avançar somente pelos botões.</p>
              <div className="ai-guided__actions">
                <button type="button" className="is-primary" onClick={() => setSetupStep('USO')}>Montar um PC</button>
                <button type="button" onClick={() => { setOpen(false); navigate('/montar') }}>Abrir montagem no 3D</button>
                <button type="button" onClick={() => { setOpen(false); navigate('/ofertas') }}>Ver ofertas</button>
              </div>
            </section>
          )}

          {!guidedFlow && setupStep === 'USO' && (
            <section className="ai-guided" aria-label="Escolher uso do PC">
              <div className="ai-guided__heading"><div><small>Etapa 1</small><strong>Qual será o uso principal?</strong></div></div>
              <p className="ai-guided__message">Isso ajuda o sistema a priorizar as peças certas para a montagem.</p>
              <div className="ai-guided__actions">
                {USAGE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={option.value === 'jogos' ? 'is-primary' : ''}
                    onClick={() => {
                      setGuidedMeta({ uso: option.value, orcamento: null })
                      setSetupStep('ORCAMENTO')
                    }}
                  >
                    {option.label}
                  </button>
                ))}
                <button type="button" onClick={() => setSetupStep('MENU')}>Voltar</button>
              </div>
            </section>
          )}

          {!guidedFlow && setupStep === 'ORCAMENTO' && (
            <section className="ai-guided" aria-label="Escolher orçamento">
              <div className="ai-guided__heading"><div><small>Etapa 2</small><strong>Qual é o orçamento?</strong></div></div>
              <p className="ai-guided__message">Escolha uma faixa. Depois disso o backend começa a sugerir as peças uma a uma.</p>
              <div className="ai-guided__actions">
                {BUDGET_OPTIONS.map((option) => (
                  <button type="button" key={option.label} disabled={sending} onClick={() => startGuidedBuild(option.value)}>{option.label}</button>
                ))}
                <button type="button" disabled={sending} onClick={() => setSetupStep('USO')}>Voltar</button>
              </div>
            </section>
          )}

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
                        <small>{component.origem === 'CATALOGO' ? 'Catálogo' : 'Selecionado'}</small>
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
                  {guidedFlow.filtrosRapidos.map((filter) => (
                    <button type="button" key={filter} disabled={sending} onClick={() => runGuidedAction('FILTRAR', { filtro: filter })}>{filter}</button>
                  ))}
                </div>
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

              {guidedFlow.etapa === 'RESUMO' && (
                <div className="ai-guided__purchase">
                  <span><small>{guidedFlow.compra?.completo ? 'Total atual' : 'Total com preço disponível'}</small><strong>{price || 'Sem preços disponíveis'}</strong></span>
                  {unpricedCount > 0 && <p>{unpricedCount} {unpricedCount === 1 ? 'peça ainda não possui' : 'peças ainda não possuem'} preço/oferta no catálogo.</p>}
                </div>
              )}

              <div className="ai-guided__actions">
                {guidedFlow.acoes?.includes('VER_MAIS') && <button type="button" disabled={sending} onClick={() => runGuidedAction('VER_MAIS')}>Ver mais</button>}
                {guidedFlow.acoes?.includes('IA_DECIDIR') && <button type="button" className="is-primary" disabled={sending} onClick={() => runGuidedAction('IA_DECIDIR')}>Deixar o assistente decidir</button>}
                {guidedFlow.acoes?.includes('ESCOLHER_MANUALMENTE') && <button type="button" disabled={sending} onClick={() => openBuildIn3D(guidedFlow.componentes || [])}>Escolher manualmente no 3D</button>}
                {guidedFlow.acoes?.includes('PULAR') && <button type="button" disabled={sending} onClick={() => runGuidedAction('PULAR')}>Pular</button>}
                {guidedFlow.acoes?.includes('VOLTAR') && <button type="button" disabled={sending} onClick={() => runGuidedAction('VOLTAR')}>Voltar</button>}
                {guidedFlow.etapa === 'RESUMO' && <button type="button" className="is-primary" onClick={() => openBuildIn3D(guidedFlow.componentes || [])}>Abrir no 3D</button>}
                {guidedFlow.etapa === 'RESUMO' && <button type="button" onClick={() => saveGuidedBuild(guidedFlow)}>Salvar montagem</button>}
                {guidedFlow.etapa === 'RESUMO' && <button type="button" onClick={() => publishGuidedBuild(guidedFlow)}>Publicar na comunidade</button>}
              </div>

              <button className="ai-guided__cancel" type="button" onClick={resetFlow}>Encerrar e voltar ao início</button>
            </section>
          )}

          {sending && <div className="ai-assistant-typing" aria-label="Assistente está processando"><span /><span /><span /></div>}
        </div>
      </aside>
    </>
  )
}
