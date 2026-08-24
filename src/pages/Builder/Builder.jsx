import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { savedBuildsService } from '../../services/savedBuildsService'
import { rotaLegada } from '../../utils/legacyRoutes'
import './Builder.css'

const PLACEHOLDER_IMAGEM = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
    <rect width="320" height="200" fill="#eef2f7"/>
    <rect x="105" y="48" width="110" height="104" rx="14" fill="#d7dee8"/>
    <path d="M126 130l38-42 24 25 18-20 34 37H126z" fill="#94a3b8"/>
    <circle cx="190" cy="82" r="13" fill="#94a3b8"/>
  </svg>
`)}`

const estadoInicialMontadorReact = {
  categoriaAtual: 'todos',
  quantidadePecas: 0,
  precoTotal: 0,
  precoCompleto: true,
  pecasSemPreco: 0,
  consumoTotal: 0,
  fonteRecomendada: 0,
  podeFinalizar: false,
  compraDisponivel: false,
  status: { texto: 'Build vazia', tipo: 'neutro' },
  diagnostico: { erros: [], alertas: [], faltando: [] },
  mostrarSomenteCompativeis: true,
  listaPecas: { modo: 'pecas', carregando: true, itens: [], totalCatalogo: 0, totalVisivel: 0 },
  componentesResumo: { itens: [], linksCompra: [], alertas: [], fansIn: 0, fansOut: 0, fluxo: {} },
}

const categorias = [
  ['todos', 'Todos'],
  ['gabinete', 'Gabinete'],
  ['placamae', 'Placa-mãe'],
  ['processador', 'CPU'],
  ['cooler', 'Cooler'],
  ['memoria', 'RAM'],
  ['placavideo', 'GPU'],
  ['armazenamento', 'Armaz.'],
  ['fonte', 'Fonte'],
  ['ventoinhas', 'Fans'],
]

const iconesCompatibilidade = {
  selecionada: '✓',
  compativel: '✓',
  atencao: '!',
  incompativel: '×',
  neutro: 'i',
}

function formatarPrecoReact(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function carregarScript(src, { modulo = false } = {}) {
  const existente = document.querySelector(`script[data-builder-src="${src}"]`)
  if (existente) {
    if (existente.dataset.loaded === 'true') return Promise.resolve()
    return new Promise((resolve, reject) => {
      existente.addEventListener('load', resolve, { once: true })
      existente.addEventListener('error', reject, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    if (modulo) script.type = 'module'
    script.dataset.builderSrc = src
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', reject, { once: true })
    document.head.appendChild(script)
  })
}

function carregarEstilo(href) {
  if (document.querySelector(`link[data-builder-style="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.builderStyle = href
  document.head.appendChild(link)
}

function ImagemPeca({ src, alt }) {
  return (
    <img
      className="imagem-peca-mini"
      src={src || PLACEHOLDER_IMAGEM}
      alt={alt}
      loading="lazy"
      decoding="async"
      width="320"
      height="200"
      onError={(event) => {
        if (event.currentTarget.src !== PLACEHOLDER_IMAGEM) event.currentTarget.src = PLACEHOLDER_IMAGEM
      }}
    />
  )
}

function LinkLoja({ peca, texto = 'Ver nas lojas' }) {
  if (!peca?.linkCompra) return null
  return (
    <a
      className="link-loja-peca"
      href={peca.linkCompra}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {texto}
    </a>
  )
}

function ListaPecasReact({ lista, onAbrirSlot, onVoltarSlots, onRemoverSlot, onAlterarFluxo, onAbrirCategoria, onSelecionarPeca, onDestacarPeca }) {
  const [fluxos, setFluxos] = useState({})

  if (lista?.carregando) {
    return <p className="mensagem-builder">Carregando componentes...</p>
  }

  if (lista?.erro) {
    return <p className="mensagem-builder">{lista.erro}</p>
  }

  if (lista?.modo === 'slots') {
    return lista.itens?.map((item) => {
      const peca = item.peca
      return (
        <article
          className={`card-peca-mini ${peca ? 'selecionada' : ''}`}
          data-categoria={lista.categoria}
          data-peca-id={peca?.id || ''}
          data-slot={item.slot}
          key={`${lista.categoria}-${item.slot}`}
          onClick={() => peca && onDestacarPeca(lista.categoria, peca.id)}
        >
          <ImagemPeca src={peca?.imagem} alt={item.nomeSlot} />
          <div className="info-peca-mini">
            <small className="categoria-peca-mini">{item.nomeSlot}</small>
            <h4>{peca?.nome || 'Slot vazio'}</h4>
            <span className="preco-peca-mini">{peca ? peca.precoFormatado : 'Escolher componente'}</span>
            {peca && <LinkLoja peca={peca} />}

            {lista.categoria === 'ventoinhas' && !peca && (
              <span className="recomendacao-fluxo-fan">Recomendado: {item.fluxoRecomendado === 'out' ? 'Saída' : 'Entrada'}</span>
            )}

            {lista.categoria === 'ventoinhas' && peca && (
              <label className="controle-fluxo-fan" onClick={(event) => event.stopPropagation()}>
                <span>Fluxo</span>
                <select
                  value={peca.fluxo === 'out' ? 'out' : 'in'}
                  aria-label={`Alterar direção da ${item.nomeSlot}`}
                  onChange={(event) => onAlterarFluxo(item.slot, event.target.value)}
                >
                  <option value="in">Entrada</option>
                  <option value="out">Saída</option>
                </select>
              </label>
            )}
          </div>
          <button
            type="button"
            className={`btn-add-peca ${peca ? 'btn-remover-slot' : 'btn-abrir-slot'}`}
            aria-label={peca ? `Remover peça da ${item.nomeSlot}` : `Escolher peça para ${item.nomeSlot}`}
            onClick={(event) => {
              event.stopPropagation()
              if (peca) onRemoverSlot(item.slot)
              else onAbrirSlot(item.slot)
            }}
          >
            {peca ? '✓' : '+'}
          </button>
        </article>
      )
    })
  }

  const itens = lista?.itens || []
  return (
    <>
      {lista?.podeVoltarSlots && (
        <button type="button" className="btn-voltar-slots" onClick={onVoltarSlots}>← Voltar para os slots</button>
      )}

      {!itens.length && (
        <p className="mensagem-builder">
          {lista?.filtroOcultouTudo
            ? 'Nenhuma opção sem conflito nesta categoria. Desative o filtro para revisar todas.'
            : lista?.termoPesquisa
              ? `Nenhum hardware encontrado para “${lista.termoPesquisa}”.`
              : 'Nenhuma peça encontrada nesta categoria.'}
        </p>
      )}

      {itens.map((item) => {
        const peca = item.peca
        const compatibilidade = item.compatibilidade || { tipo: 'neutro', texto: 'Compatibilidade será validada' }
        const fluxoAtual = fluxos[peca.id] || 'in'
        return (
          <article
            className={`card-peca-mini ${item.selecionada ? 'selecionada' : ''}`}
            data-categoria={item.categoria}
            data-peca-id={peca.id}
            data-conflito={String(Boolean(item.conflito))}
            key={`${item.categoria}-${peca.id}-${item.slot ?? 'single'}`}
            onClick={(event) => {
              if (event.target.closest('button, select, input, label, a')) return
              onDestacarPeca(item.categoria, peca.id)
            }}
          >
            <ImagemPeca src={peca.imagem} alt={peca.nome} />
            <div className="info-peca-mini">
              <small className="categoria-peca-mini">{item.nomeCategoria}</small>
              <h4>{peca.nome}</h4>
              <span className="preco-peca-mini">{peca.precoFormatado}</span>
              <span className="compatibilidade-card-builder" data-tipo={compatibilidade.tipo} title={compatibilidade.texto}>
                <span aria-hidden="true">{iconesCompatibilidade[compatibilidade.tipo] || 'i'}</span>
                {compatibilidade.texto}
              </span>
              {item.selecionada && <LinkLoja peca={peca} />}

              {item.categoria === 'ventoinhas' && !item.precisaEscolherSlot && (
                <label className="controle-fluxo-fan" onClick={(event) => event.stopPropagation()}>
                  <span>Fluxo</span>
                  <select
                    value={fluxoAtual}
                    aria-label="Direção do fluxo de ar"
                    onChange={(event) => setFluxos((atual) => ({ ...atual, [peca.id]: event.target.value }))}
                  >
                    <option value="in">Entrada</option>
                    <option value="out">Saída</option>
                  </select>
                </label>
              )}
            </div>

            {item.precisaEscolherSlot ? (
              <button
                type="button"
                className="btn-add-peca btn-ir-categoria"
                aria-label={`Abrir ${item.nomeCategoria} para escolher o slot`}
                title="Escolher slot"
                onClick={() => onAbrirCategoria(item.categoria)}
              >→</button>
            ) : (
              <button
                type="button"
                className="btn-add-peca"
                aria-label={`${item.selecionada ? 'Remover' : 'Adicionar'} ${peca.nome}`}
                aria-pressed={item.selecionada}
                onClick={() => onSelecionarPeca(item.categoria, peca.id, item.slot, item.categoria === 'ventoinhas' ? fluxoAtual : '')}
              >{item.selecionada ? '✓' : '+'}</button>
            )}
          </article>
        )
      })}
    </>
  )
}

function ModalResumoFinal({ estado, onClose, onSave, onPublish, onShare, onPrint, onBuy, saveLabel = 'Salvar build' }) {
  const resumo = estado.componentesResumo || estadoInicialMontadorReact.componentesResumo
  return (
    <div className="modal-resumo-final aberto" id="modal-resumo-final">
      <div className="modal-resumo-overlay" onClick={onClose} />
      <section className="modal-resumo-conteudo" role="dialog" aria-modal="true" aria-labelledby="modal-resumo-titulo" aria-describedby="modal-resumo-descricao">
        <header className="modal-resumo-cabecalho">
          <div>
            <span className="modal-resumo-etiqueta">Configuração concluída</span>
            <h2 id="modal-resumo-titulo">Resumo final do PC</h2>
            <p id="modal-resumo-descricao">Confira os componentes, o consumo e o fluxo de ar da montagem.</p>
          </div>
          <button type="button" className="btn-fechar-modal-resumo" id="btn-fechar-modal-resumo" aria-label="Fechar resumo final" onClick={onClose}>×</button>
        </header>

        <div className="modal-resumo-corpo">
          <div className="resumo-final-metricas">
            <article className="resumo-final-metrica"><span>{estado.precoCompleto === false ? 'Preço parcial' : 'Preço total'}</span><strong id="modal-resumo-preco">{formatarPrecoReact(estado.precoTotal)}</strong>{estado.pecasSemPreco > 0 && <small>{estado.pecasSemPreco} peça(s) sem preço no catálogo</small>}</article>
            <article className="resumo-final-metrica"><span>Consumo estimado</span><strong id="modal-resumo-consumo">{estado.consumoTotal || 0} W</strong></article>
            <article className="resumo-final-metrica"><span>Fonte recomendada</span><strong id="modal-resumo-fonte">{estado.fonteRecomendada || 0} W</strong></article>
            <article className="resumo-final-metrica"><span>Componentes</span><strong id="modal-resumo-quantidade">{resumo.itens?.length || 0}</strong></article>
          </div>

          <section className="resumo-final-secao">
            <div className="resumo-final-titulo-secao"><h3>Componentes selecionados</h3><span className="resumo-final-status">Compatível</span></div>
            <div id="lista-componentes-resumo-final" className="lista-componentes-resumo-final">
              {resumo.itens?.map((item) => (
                <article className="item-componente-resumo-final" key={`${item.categoria}-${item.indice}`}>
                  <img src={item.peca.imagem || PLACEHOLDER_IMAGEM} alt="" loading="lazy" onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGEM }} />
                  <div className="item-componente-resumo-info">
                    <span className="item-componente-categoria">{item.nomeSlot}</span>
                    <strong>{item.peca.nome}</strong>
                    <div className="item-componente-detalhes">
                      {item.categoria === 'ventoinhas' && <span className={`resumo-final-badge fluxo-${item.peca.fluxo === 'out' ? 'saida' : 'entrada'}`}>{item.peca.fluxo === 'out' ? 'Saída' : 'Entrada'}</span>}
                      {item.peca.watts > 0 && <span>{item.peca.watts} W</span>}
                      {item.peca.loja && <span>{item.peca.loja}</span>}
                      <LinkLoja peca={item.peca} texto="Ver preço" />
                    </div>
                  </div>
                  <strong className="item-componente-preco">{item.peca.precoFormatado}</strong>
                </article>
              ))}
            </div>
          </section>

          {!!resumo.linksCompra?.length && (
            <section id="secao-compra-resumo-final" className="resumo-final-secao secao-compra-resumo-final">
              <div className="resumo-final-titulo-secao"><div><h3>Onde comprar</h3><p className="texto-compra-resumo-final">Compare as lojas somente depois de conferir a montagem.</p></div><span className="resumo-final-status resumo-final-status--compra">Links disponíveis</span></div>
              <div id="lista-links-compra-resumo-final" className="lista-links-compra-resumo-final">
                {resumo.linksCompra.map((item) => (
                  <article className="item-link-compra-resumo-final" key={`buy-${item.categoria}-${item.indice}`}>
                    <div><span>{item.nomeSlot}</span><strong>{item.peca.nome}</strong>{item.peca.loja && <small>{item.peca.loja}</small>}</div>
                    <a href={item.peca.linkCompra} target="_blank" rel="sponsored noopener noreferrer">Ver preço</a>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="resumo-final-secao">
            <h3>Fluxo de ar</h3>
            <div id="fluxo-ar-resumo-final" className="fluxo-ar-resumo-final" data-tipo={resumo.fluxo?.tipo || 'neutro'}>
              <div><strong>{resumo.fluxo?.titulo || 'Fluxo de ar'}</strong><p>{resumo.fluxo?.mensagem || 'Sem dados suficientes.'}</p></div>
              <div className="contagem-fluxo-resumo"><span><strong>{resumo.fansIn || 0}</strong> entrada</span><span><strong>{resumo.fansOut || 0}</strong> saída</span></div>
            </div>
          </section>

          {!!resumo.alertas?.length && (
            <section id="secao-alertas-resumo-final" className="resumo-final-secao"><h3>Recomendações</h3><ul id="lista-alertas-resumo-final" className="lista-alertas-resumo-final">{resumo.alertas.map((alerta) => <li key={alerta}>{alerta}</li>)}</ul></section>
          )}
        </div>

        <footer className="modal-resumo-rodape">
          {!!resumo.linksCompra?.length && <button type="button" className="btn-ver-opcoes-compra" id="btn-ver-opcoes-compra" onClick={onBuy}>Ver opções de compra</button>}
          <button type="button" className="btn-salvar-build" id="btn-salvar-build" onClick={onSave}><span aria-hidden="true">💾</span> {saveLabel}</button>
          <button type="button" className="btn-publicar-build" id="btn-publicar-build" onClick={onPublish}><span aria-hidden="true">🌐</span> Publicar build</button>
          <button type="button" className="btn-compartilhar-build" id="btn-compartilhar-build" onClick={onShare}><span aria-hidden="true">🔗</span> Compartilhar build</button>
          <button type="button" className="btn-imprimir-relatorio" id="btn-imprimir-relatorio" onClick={onPrint}><span aria-hidden="true">🖨</span> Imprimir relatório</button>
          <button type="button" className="btn-continuar-editando" id="btn-continuar-editando" onClick={onClose}>Continuar editando</button>
        </footer>
      </section>
    </div>
  )
}

export default function Builder() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const preSelecaoAplicada = useRef(false)
  const { user } = useAuth()
  const [estadoMotor, setEstadoMotor] = useState('Carregando motor 3D...')
  const [erroMotor, setErroMotor] = useState('')
  const [estadoMontadorReact, setEstadoMontadorReact] = useState(estadoInicialMontadorReact)
  const [pesquisaAberta, setPesquisaAberta] = useState(false)
  const [termoPesquisa, setTermoPesquisa] = useState('')
  const [resumoAberto, setResumoAberto] = useState(false)
  const [mensagemLocal, setMensagemLocal] = useState('')
  const [qualidade3D, setQualidade3D] = useState('alta')
  const storageOwner = user?.email || '__local__'
  const editBuildId = searchParams.get('editar')
  const buildEmEdicao = editBuildId ? savedBuildsService.get(storageOwner, editBuildId) : null

  useEffect(() => {
    let cancelado = false

    document.body.classList.add('builder-route-active')
    globalThis.PC_BUILDER_REACT_TABS = true
    globalThis.PC_BUILDER_REACT_SEARCH = true
    globalThis.PC_BUILDER_REACT_FILTER = true
    globalThis.PC_BUILDER_REACT_LIST = true
    globalThis.PC_BUILDER_REACT_ACTIONS = true
    globalThis.PC_BUILDER_API_CONFIG = {
      baseUrl: (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
      modo: 'api',
      timeoutMs: 12000,
    }

    function sincronizarEstadoReact(evento) {
      if (cancelado || !evento?.detail) return
      setEstadoMontadorReact(evento.detail)
      if (typeof evento.detail.termoPesquisa === 'string') setTermoPesquisa(evento.detail.termoPesquisa)
    }

    window.addEventListener('pcbuilder:statechange', sincronizarEstadoReact)

    const estilos = [
      '/legacy-builder/css/pcbuildstyle.css?v=react-v54-cooler-dark-search',
      '/legacy-builder/css/montador-extras.css?v=react-v52-model-transform-values',
      '/legacy-builder/css/ia-assistente.css?v=react-v40-1',
      '/legacy-builder/css/react-overrides.css?v=react-v54-cooler-dark-search',
    ]
    estilos.forEach(carregarEstilo)
    globalThis.PC_BUILDER_ASSET_BASE_URL = rotaLegada('')

    async function iniciar() {
      try {
        await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
        await carregarScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js')
        await carregarScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js')
        if (cancelado) return

        await carregarScript('/legacy-builder/js/pcbuildscript.js?v=react-v57-all-hardware-descriptions', { modulo: true })
        if (cancelado) return

        const inicializar = globalThis.inicializarMontadorLegado
        if (typeof inicializar !== 'function') throw new Error('A função de inicialização do montador não foi exposta pelo módulo legado.')

        const iniciou = await inicializar()
        if (cancelado) return
        if (!iniciou) throw new Error('O motor 3D não encontrou a área de renderização.')

        const qualidadeInicial = globalThis.PCBuilderLegacyBridge?.obterQualidade3D?.()
        if (qualidadeInicial && !cancelado) setQualidade3D(qualidadeInicial)

        const snapshot = globalThis.PCBuilderLegacyBridge?.obterEstado?.()
        if (snapshot && !cancelado) {
          setEstadoMontadorReact(snapshot)
          if (typeof snapshot.termoPesquisa === 'string') setTermoPesquisa(snapshot.termoPesquisa)
        }
        setEstadoMotor('Montador 3D pronto.')
      } catch (erro) {
        console.error('Falha ao iniciar o montador 3D no React:', erro)
        if (!cancelado) {
          setErroMotor('Não foi possível carregar a visualização 3D. Recarregue a página e tente novamente.')
          setEstadoMotor('Motor 3D indisponível')
        }
      }
    }

    iniciar()

    return () => {
      cancelado = true
      window.removeEventListener('pcbuilder:statechange', sincronizarEstadoReact)
      globalThis.PCBuilderLegacyBridge?.destruirAssistenteIa?.()
      globalThis.PC_BUILDER_REACT_TABS = false
      globalThis.PC_BUILDER_REACT_SEARCH = false
      globalThis.PC_BUILDER_REACT_FILTER = false
      globalThis.PC_BUILDER_REACT_LIST = false
      globalThis.PC_BUILDER_REACT_ACTIONS = false
      document.querySelectorAll('link[data-builder-style]').forEach((link) => link.remove())
      document.body.classList.remove('builder-route-active', 'modal-resumo-aberto', 'imprimindo-relatorio')
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('modal-resumo-aberto', resumoAberto)
    return () => document.body.classList.remove('modal-resumo-aberto')
  }, [resumoAberto])

  useEffect(() => {
    if (preSelecaoAplicada.current || estadoMontadorReact.listaPecas?.carregando) return
    const idPeca = searchParams.get('peca')
    const categoriaRecebida = searchParams.get('categoria')
    if (!idPeca || !categoriaRecebida) return

    const categoriasBuilder = {
      'placa-mae': 'placamae',
      'placa-video': 'placavideo',
      ventoinha: 'ventoinhas',
    }
    const categoria = categoriasBuilder[categoriaRecebida] || categoriaRecebida
    const apiBridge = globalThis.PCBuilderLegacyBridge
    if (!apiBridge?.selecionarPecaAutomatica) return

    preSelecaoAplicada.current = true
    apiBridge.selecionarCategoria?.(categoria)
    const selecionou = apiBridge.selecionarPecaAutomatica(categoria, idPeca)
    const mensagemPreSelecao = selecionou !== false
      ? 'Componente enviado pela Loja foi aplicado ao montador.'
      : 'O componente da Loja ainda não existe no catálogo 3D local.'

    // O React 19/ESLint evita setState síncrono dentro de effects.
    // A mensagem é apenas feedback da sincronização com o motor legado, então
    // agendamos a atualização para a próxima microtask.
    queueMicrotask(() => setMensagemLocal(mensagemPreSelecao))

    const next = new URLSearchParams(searchParams)
    next.delete('peca')
    next.delete('categoria')
    setSearchParams(next, { replace: true })
  }, [estadoMontadorReact.listaPecas?.carregando, searchParams, setSearchParams])

  const bridge = () => globalThis.PCBuilderLegacyBridge

  function selecionarCategoriaReact(categoria) {
    bridge()?.selecionarCategoria?.(categoria)
  }

  function pesquisarHardwareReact(valor) {
    setTermoPesquisa(valor)
    bridge()?.pesquisarHardware?.(valor)
  }

  function alternarFiltroCompatibilidadeReact(evento) {
    bridge()?.filtrarCompatibilidade?.(Boolean(evento.target.checked))
  }

  function selecionarPeca(categoria, id, slot, fluxo) {
    bridge()?.selecionarPeca?.(categoria, id, slot == null ? '' : String(slot), fluxo || '')
  }

  async function finalizarBuild() {
    const resultado = bridge()?.finalizar?.()
    const estadoValidado = resultado?.estado || bridge()?.obterEstado?.() || estadoMontadorReact

    if (estadoValidado && estadoValidado !== estadoMontadorReact) {
      setEstadoMontadorReact(estadoValidado)
    }

    const podeFinalizar = resultado?.ok === true || estadoValidado?.podeFinalizar === true || estadoMontadorReact.podeFinalizar === true
    if (!podeFinalizar) {
      setMensagemLocal('Complete a build e corrija as incompatibilidades antes de finalizar.')
      return
    }

    setMensagemLocal('')
    setResumoAberto(true)
  }

  function salvarBuildAtual() {
    const configuracao = estadoMontadorReact.configuracao
    const metadata = {
      precoTotal: estadoMontadorReact.precoTotal,
      consumoTotal: estadoMontadorReact.consumoTotal,
      quantidade: estadoMontadorReact.quantidadePecas,
      componentes: estadoMontadorReact.componentesResumo?.itens?.map((item) => ({
        categoria: item.categoriaNome,
        categoriaCodigo: item.categoria,
        hardwareId: item.peca.hardwareId ?? item.peca.id ?? null,
        slot: item.nomeSlot,
        nome: item.peca.nome,
        marca: item.peca.marca ?? '',
        modelo: item.peca.modelo ?? '',
        preco: item.peca.preco,
        origem: item.peca.origem || (item.peca.hardwareId ? 'CATALOGO' : undefined),
        especificacoes: item.peca.especificacoes || undefined,
        fonteDadosUrl: item.peca.fonteDadosUrl || undefined,
        modelo3dUrl: item.peca.modelo3dUrl || item.peca.modelo3D || undefined,
        imagemUrl: item.peca.imagemUrl || item.peca.imagem || undefined,
      })),
    }

    if (buildEmEdicao) {
      const result = savedBuildsService.updateConfiguration(storageOwner, buildEmEdicao.id, configuracao, metadata)
      if (!result) {
        setMensagemLocal('A build original não foi encontrada. Salve como uma nova build.')
        return
      }
      setMensagemLocal(`Alterações salvas em “${result.build.nome}”.`)
      return
    }

    const nomePadrao = `Minha build ${new Date().toLocaleDateString('pt-BR')}`
    const nome = window.prompt('Nome da build:', nomePadrao)
    if (!nome?.trim()) return

    const result = savedBuildsService.saveConfiguration(storageOwner, configuracao, nome.trim(), metadata)
    navigate(savedBuildsService.createEditBuilderPath(result.build), { replace: true })
    setMensagemLocal(`Build “${result.build.nome}” salva. Você pode continuar editando e salvar novas alterações na mesma build.`)
  }

  function publicarBuildAtual() {
    const configuracao = estadoMontadorReact.configuracao
    if (!configuracao) {
      setMensagemLocal('Não foi possível preparar a montagem para publicação.')
      return
    }

    const componentes = estadoMontadorReact.componentesResumo?.itens?.map((item) => ({
      categoria: item.categoriaNome,
      categoriaCodigo: item.categoria,
      hardwareId: item.peca.hardwareId ?? item.peca.id ?? null,
      slot: item.nomeSlot,
      posicao: item.peca.posicao ?? item.posicao ?? null,
      nome: item.peca.nome,
      marca: item.peca.marca ?? '',
      modelo: item.peca.modelo ?? '',
      preco: Number(item.peca.preco || 0),
      quantidade: Number(item.peca.quantidade || 1),
      origem: item.peca.origem || (item.peca.hardwareId ? 'CATALOGO' : 'EXTERNO'),
      especificacoes: item.peca.especificacoes || undefined,
      fonteDadosUrl: item.peca.fonteDadosUrl || undefined,
      modelo3dUrl: item.peca.modelo3dUrl || item.peca.modelo3D || undefined,
      imagemUrl: item.peca.imagemUrl || item.peca.imagem || undefined,
    })) || []

    const pendente = {
      id: 'montagem-atual',
      nome: 'Montagem atual',
      origem: 'montador',
      temporaria: true,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
      precoTotal: Number(estadoMontadorReact.precoTotal || 0),
      consumoTotal: Number(estadoMontadorReact.consumoTotal || 0),
      quantidade: Number(estadoMontadorReact.quantidadePecas || componentes.length),
      ...(buildEmEdicao?.communityBuildId ? { communityBuildId: buildEmEdicao.communityBuildId } : {}),
      configuracao,
      componentes,
    }

    try {
      sessionStorage.setItem('pcBuilderPublicacaoPendente', JSON.stringify(pendente))
      setResumoAberto(false)
      navigate(pendente.communityBuildId
        ? `/comunidade/publicar?editar=${encodeURIComponent(pendente.communityBuildId)}`
        : '/comunidade/publicar')
    } catch {
      setMensagemLocal('Não foi possível abrir a publicação desta build.')
    }
  }

  function alternarQualidade3DReact() {
    const novaQualidade = bridge()?.alternarQualidade3D?.()
    if (!novaQualidade) {
      setMensagemLocal('O controle de qualidade 3D ainda não está disponível.')
      return
    }

    setQualidade3D(novaQualidade)
    setMensagemLocal(`Qualidade 3D alterada para ${novaQualidade === 'baixa' ? 'reduzida' : 'alta'}.`)
  }

  async function compartilharBuildAtual() {
    const url = savedBuildsService.createBuilderUrl({ configuracao: estadoMontadorReact.configuracao })
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Build CriaByte', text: 'Confira esta configuração no CriaByte.', url })
      } else {
        await navigator.clipboard.writeText(url)
        setMensagemLocal('Link da build copiado.')
      }
    } catch (erro) {
      if (erro?.name !== 'AbortError') setMensagemLocal('Não foi possível compartilhar a build.')
    }
  }

  const categoriaPesquisa = categorias.find(([id]) => id === estadoMontadorReact.categoriaAtual)?.[1] ?? 'categoria atual'
  const lista = estadoMontadorReact.listaPecas || estadoInicialMontadorReact.listaPecas
  const resumoPesquisa = useMemo(() => {
    if (termoPesquisa.trim()) return `${lista.totalVisivel ?? 0} resultado(s) para “${termoPesquisa.trim()}”.`
    if (estadoMontadorReact.categoriaAtual === 'todos') return `${lista.totalCatalogo ?? 0} hardware(s) no catálogo.`
    return `${lista.totalCatalogo ?? 0} hardware(s) em ${categoriaPesquisa}.`
  }, [termoPesquisa, lista.totalVisivel, lista.totalCatalogo, estadoMontadorReact.categoriaAtual, categoriaPesquisa])

  return (
    <div className="builder-page">
      {(erroMotor || estadoMotor !== 'Montador 3D pronto.') && (
        <div className={`builder-react-status ${erroMotor ? 'builder-react-status--error' : ''}`} role="status">
          <span>{estadoMotor}</span>
          {!erroMotor && <small>Preparando a visualização 3D...</small>}
        </div>
      )}

      {erroMotor && (
        <div className="builder-react-alert" role="alert">
          <strong>3D não carregou.</strong>
          <span>{erroMotor}</span>
        </div>
      )}

      {editBuildId && (
        <div className={`builder-editing-notice ${buildEmEdicao ? '' : 'builder-editing-notice--warning'}`.trim()} role="status">
          {buildEmEdicao ? (
            <>
              <span>Editando build salva</span>
              <strong>{buildEmEdicao.nome || 'Minha build'}</strong>
              <Link to={`/minhas-builds/${buildEmEdicao.id}`}>Ver detalhes</Link>
            </>
          ) : (
            <>
              <strong>Build salva não encontrada.</strong>
              <span>Você pode continuar montando e salvar esta configuração como uma nova build.</span>
            </>
          )}
        </div>
      )}

      <div className="pcbuilder-container">
        <section aria-label="Visualização 3D da montagem" className="pcbuilder-3d-area">
          <div className="pcbuilder-palco-3d">
            <div id="canvas-3d-container">
              <div aria-live="polite" className="tela-carregamento-3d" hidden id="tela-carregamento">
                <div className="carregamento-3d-conteudo">
                  <span aria-hidden="true" className="spinner-3d" />
                  <strong id="texto-carregamento-3d">Carregando modelo 3D...</strong>
                  <div aria-hidden="true" className="trilha-progresso-3d"><span id="barra-progresso" /></div>
                </div>
              </div>
              <div className="mensagem-palco"><h2>O seu PC ganhará vida aqui 🎮</h2><p>Escolha qualquer componente para começar.</p></div>
            </div>

            <div aria-label="Controles da visualização 3D" className="controles-camera">
              <button aria-pressed="false" id="btn-girar" title="Ativar rotação automática" type="button">↻</button>
              <button id="btn-zoom-mais" title="Aproximar" type="button">＋</button>
              <button id="btn-zoom-menos" title="Afastar" type="button">－</button>
              <button aria-label="Ligar PC" disabled id="btn-rgb" title="Ligar PC" type="button">⏻</button>
              <button id="btn-reset-camera" title="Restaurar câmera" type="button">⌂</button>
              <button aria-label="Desfazer última alteração" id="btn-desfazer-build" title="Desfazer última alteração" type="button">↶</button>
              <button aria-label="Salvar imagem do PC 3D" id="btn-capturar-3d" title="Salvar imagem do PC 3D" type="button">▣</button>
              <button aria-label={`Qualidade 3D atual: ${qualidade3D === 'baixa' ? 'reduzida' : 'alta'}. Clique para alternar.`} aria-pressed={qualidade3D === 'baixa'} data-qualidade={qualidade3D} id="btn-qualidade-3d" onClick={alternarQualidade3DReact} title={qualidade3D === 'baixa' ? 'Usar qualidade alta no 3D' : 'Usar qualidade reduzida no 3D'} type="button"><span aria-hidden="true">{qualidade3D === 'baixa' ? 'ECO' : 'HQ'}</span></button>
              <button aria-label="Expandir visualização 3D" aria-pressed="false" id="btn-expandir-3d" title="Abrir 3D em tela cheia" type="button">⛶</button>
              <button aria-label="Abrir ajuda do montador" id="btn-ajuda-montador" title="Ajuda e atalhos" type="button">?</button>
            </div>
          </div>

          <section aria-live="polite" className="painel-diagnostico-builder" data-aberto="false" hidden id="painel-diagnostico-builder">
            <header className="diagnostico-cabecalho">
              <div className="diagnostico-titulo-wrap"><span aria-hidden="true" className="diagnostico-sinal" id="diagnostico-sinal">i</span><div><h3>Diagnóstico do sistema</h3><small id="diagnostico-resumo">Existe um alerta na montagem.</small></div></div>
              <button aria-controls="conteudo-logs" aria-expanded="false" className="btn-alternar-diagnostico" id="btn-alternar-diagnostico" type="button">Ver diagnóstico</button>
            </header>
            <div className="diagnostico-conteudo" hidden id="conteudo-logs" />
          </section>
        </section>

        <aside aria-label="Escolha dos componentes" className="pcbuilder-painel">
          <section className="painel-cabecalho">
            <div className="painel-cabecalho-linha">
              <div><span className="painel-etiqueta">Monte sem ordem obrigatória</span><h1>Escolha os componentes</h1></div>
              <div className="painel-acoes-cabecalho">
                <button className="btn-montar-ia" id="btn-montar-ia" type="button" title="Montar com Inteligência Artificial"><span aria-hidden="true">✦</span> Montar com IA</button>
                <label className={`filtro-compativeis-builder ${estadoMontadorReact.diagnostico?.temPecas ? '' : 'desabilitado'}`.trim()} htmlFor="filtro-compativeis-builder" title="Ocultar opções que entram em conflito com a montagem atual">
                  <input aria-label="Mostrar somente opções sem conflito" checked={estadoMontadorReact.mostrarSomenteCompativeis !== false} disabled={!estadoMontadorReact.diagnostico?.temPecas} id="filtro-compativeis-builder" onChange={alternarFiltroCompatibilidadeReact} type="checkbox" />
                  <span>Sem conflito</span>
                </label>
                <button aria-label="Pesquisar hardware" aria-controls="painel-pesquisa-hardware" aria-expanded={pesquisaAberta} className="btn-alternar-pesquisa btn-alternar-pesquisa--icone" id="btn-alternar-pesquisa" onClick={() => setPesquisaAberta((aberta) => !aberta)} title="Pesquisar hardware" type="button"><span aria-hidden="true">⌕</span></button>
              </div>
            </div>

            <section className="painel-pesquisa-hardware" hidden={!pesquisaAberta} id="painel-pesquisa-hardware">
              <label htmlFor="pesquisa-hardware-builder">Pesquisar hardware</label>
              <div className="campo-pesquisa-builder"><span aria-hidden="true">⌕</span><input autoComplete="off" id="pesquisa-hardware-builder" onChange={(evento) => pesquisarHardwareReact(evento.target.value)} placeholder="Nome, marca ou modelo..." type="search" value={termoPesquisa} /><button aria-label="Limpar pesquisa" hidden={!termoPesquisa.trim()} id="btn-limpar-pesquisa-builder" onClick={() => pesquisarHardwareReact('')} type="button">×</button></div>
              <small id="resultado-pesquisa-builder">{resumoPesquisa}</small>
            </section>

            <div aria-label="Categorias de componentes" className="lista-categorias" role="tablist">
              {categorias.map(([id, label]) => {
                const ativa = estadoMontadorReact.categoriaAtual === id
                return <button key={id} aria-selected={ativa ? 'true' : 'false'} className={`categoria-btn ${ativa ? 'ativo' : ''}`} data-categoria={id} onClick={() => selecionarCategoriaReact(id)} role="tab" type="button">{label}</button>
              })}
            </div>
          </section>

          <div aria-live="polite" className="painel-lista-pecas" id="lista-pecas-builder">
            <ListaPecasReact
              lista={lista}
              onAbrirSlot={(slot) => bridge()?.abrirSlot?.(slot)}
              onVoltarSlots={() => bridge()?.voltarSlots?.()}
              onRemoverSlot={(slot) => bridge()?.removerSlot?.(slot)}
              onAlterarFluxo={(slot, fluxo) => bridge()?.alterarFluxoVentoinha?.(slot, fluxo)}
              onAbrirCategoria={selecionarCategoriaReact}
              onSelecionarPeca={selecionarPeca}
              onDestacarPeca={(categoria, id) => bridge()?.destacarPeca?.(categoria, id)}
            />
          </div>

          <footer className="painel-resumo" data-react-state="true">
            <div className="resumo-status-linha"><span className="status-build" data-tipo={estadoMontadorReact.status?.tipo || 'neutro'} id="status-build">{estadoMontadorReact.status?.texto || 'Build vazia'}</span><button className="btn-limpar-build" id="btn-limpar-build" type="button" onClick={() => bridge()?.limparBuild?.()}>Limpar build</button></div>
            <small aria-live="polite" className="status-salvamento-builder" data-tipo="neutro" id="status-salvamento-build">Salvamento automático ativo neste navegador.</small>
            <div className="resumo-info">
              <div className="resumo-metrica"><span>{estadoMontadorReact.precoCompleto === false ? 'Preço parcial' : 'Preço total'}</span><strong aria-live="polite" id="preco-total-montagem">{formatarPrecoReact(estadoMontadorReact.precoTotal)}</strong>{estadoMontadorReact.pecasSemPreco > 0 && <small>{estadoMontadorReact.pecasSemPreco} sem preço</small>}</div>
              <div className="resumo-metrica resumo-metrica-menor"><span>Consumo</span><strong aria-live="polite" id="consumo-watts">{estadoMontadorReact.consumoTotal || 0} W</strong></div>
              <div className="resumo-metrica resumo-metrica-menor"><span>Fonte ideal</span><strong aria-live="polite" id="fonte-recomendada">{estadoMontadorReact.fonteRecomendada || 0} W</strong></div>
            </div>
            <div className="resumo-acoes-builder"><button className="btn-finalizar-montagem" disabled={!estadoMontadorReact.podeFinalizar} id="btn-finalizar" type="button" onClick={finalizarBuild}>Finalizar PC</button><button className="btn-comprar-pecas-builder" hidden={!estadoMontadorReact.compraDisponivel} id="btn-comprar-pecas" type="button" onClick={() => navigate('/pecas')}>Comprar peças</button></div>
            <small className="aviso-compra-builder" hidden={!estadoMontadorReact.compraDisponivel} id="aviso-compra-builder">Links de compra aparecem apenas para peças com loja cadastrada.</small>
            {mensagemLocal && <small className="builder-local-message" role="status">{mensagemLocal}</small>}
          </footer>
        </aside>
      </div>

      <div aria-live="polite" id="tooltip-3d" role="status" />
      <dialog aria-labelledby="titulo-tutorial-montador" className="tutorial-montador" id="tutorial-montador">
        <div className="tutorial-montador-conteudo"><span className="tutorial-etiqueta">Guia rápido</span><h2 id="titulo-tutorial-montador">Monte seu PC em poucos passos</h2><ol><li>Escolha as peças em qualquer ordem.</li><li>Confira consumo, fonte ideal e diagnóstico em tempo real.</li><li>Use o mouse ou o toque para girar e aproximar o modelo 3D.</li><li>Salve, compartilhe, imprima ou capture uma imagem da montagem.</li></ol><p><strong>Atalhos:</strong> Ctrl/⌘ + Z desfaz a última alteração e <kbd>?</kbd> abre esta ajuda.</p><button data-fechar-tutorial type="button">Começar a montar</button></div>
      </dialog>

      {resumoAberto && (
        <ModalResumoFinal
          estado={estadoMontadorReact}
          onClose={() => setResumoAberto(false)}
          onSave={salvarBuildAtual}
          onPublish={publicarBuildAtual}
          onShare={compartilharBuildAtual}
          onPrint={() => bridge()?.imprimirRelatorio?.()}
          onBuy={() => navigate('/pecas')}
          saveLabel={buildEmEdicao ? 'Salvar alterações' : 'Salvar build'}
        />
      )}
    </div>
  )
}
