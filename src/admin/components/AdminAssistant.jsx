import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { storeAiImportPreview } from '../utils/aiImportTransfer'

const ACTION_PRODUCT = 'CADASTRAR_PRODUTO'
const ACTION_HARDWARE = 'CADASTRAR_HARDWARE'

function responseText(data) {
  if (typeof data === 'string') return data
  return data?.resposta || data?.mensagem || data?.texto || data?.conteudo || data?.answer || 'Resposta recebida do backend.'
}

function clean(value) {
  return String(value ?? '').trim()
}

function formatPrice(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function validPublicUrl(value) {
  try {
    const url = new URL(clean(value))
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

function unsupportedChatbotRoute(error) {
  return [404, 405].includes(Number(error?.status))
}

function previewSource(preview = {}) {
  return {
    ...(preview?.normalizacao?.camposNormalizados && typeof preview.normalizacao.camposNormalizados === 'object'
      ? preview.normalizacao.camposNormalizados
      : {}),
    ...(preview?.resultadoProdutoIa?.payloadParcialBackend && typeof preview.resultadoProdutoIa.payloadParcialBackend === 'object'
      ? preview.resultadoProdutoIa.payloadParcialBackend
      : {}),
    ...(preview?.cadastroSugerido?.payload && typeof preview.cadastroSugerido.payload === 'object'
      ? preview.cadastroSugerido.payload
      : {}),
    ...(preview?.confirmacaoSugerida?.body && typeof preview.confirmacaoSugerida.body === 'object'
      ? preview.confirmacaoSugerida.body
      : {}),
  }
}

function previewOffer(preview = {}) {
  return preview?.ofertaSugerida
    || preview?.ofertaColetada
    || preview?.resultadoProdutoIa?.ofertaColetada
    || null
}

function normalizeAutomaticPreview(data = {}) {
  const analysis = data?.analise || data?.analysis || {}
  const hardware = analysis?.hardware || data?.hardware || {}
  const product = analysis?.produto || data?.produto || {}
  const offer = analysis?.oferta || data?.oferta || {}
  const hardwareData = hardware?.dadosDetectados || hardware?.dados || hardware?.data || {}
  const productData = product?.dadosDetectados || product?.dados || product?.data || {}
  const offerData = offer?.dadosDetectados || offer?.dados || offer?.data || {}

  return {
    name: clean(productData?.nome || hardwareData?.nome || data?.nome),
    brand: clean(productData?.marca || hardwareData?.marca),
    model: clean(productData?.modelo || hardwareData?.modelo),
    category: clean(analysis?.categoria || data?.categoria || hardwareData?.categoria || data?.categoriaDetectada),
    image: clean(productData?.imagemUrl || hardwareData?.imagemUrl),
    price: offerData?.preco ?? offer?.preco,
    previousPrice: offerData?.precoAnterior ?? offer?.precoAnterior,
    partner: clean(offerData?.parceiroNome || offer?.parceiroNome || offerData?.parceiro?.nome || offer?.parceiro?.nome),
    hardwareExisting: hardware?.existente,
    hardwareId: hardware?.id,
    productExisting: product?.existente,
    productId: product?.id,
    offerExisting: offer?.existente,
    offerId: offer?.id,
    actions: Array.isArray(data?.acoesPrevistas) ? data.acoesPrevistas : [],
    warnings: [...(Array.isArray(data?.avisos) ? data.avisos : []), ...(Array.isArray(data?.conflitos) ? data.conflitos.map((item) => typeof item === 'string' ? item : `Conflito em ${item?.campo || 'campo técnico'}`) : [])],
  }
}

function normalizeFallbackPreview(preview = {}) {
  const source = previewSource(preview)
  const offer = previewOffer(preview) || {}
  return {
    name: clean(source.nome),
    brand: clean(source.marca),
    model: clean(source.modelo),
    category: clean(source.categoria || preview?.categoriaDetectada || preview?.categoriaSugerida),
    image: clean(source.imagemUrl),
    price: offer?.preco,
    previousPrice: offer?.precoAnterior,
    partner: clean(offer?.parceiroNome || offer?.parceiro?.nome),
    hardwareExisting: preview?.reconciliacao?.hardwareExistente ? true : undefined,
    hardwareId: preview?.reconciliacao?.hardwareExistente?.id,
    productExisting: preview?.reconciliacao?.produtoExistente ? true : undefined,
    productId: preview?.reconciliacao?.produtoExistente?.id,
    offerExisting: preview?.reconciliacao?.ofertaExistente ? true : undefined,
    offerId: preview?.reconciliacao?.ofertaExistente?.id,
    actions: [],
    warnings: [
      ...(Array.isArray(preview?.normalizacao?.alertas) ? preview.normalizacao.alertas : []),
      ...(Array.isArray(preview?.normalizacao?.ausentes) && preview.normalizacao.ausentes.length ? [`Campos não encontrados: ${preview.normalizacao.ausentes.join(', ')}`] : []),
    ],
  }
}

function entityStatus(value, id, pendingLabel) {
  if (value === true) return `Já cadastrado${id ? ` (#${id})` : ''}`
  if (value === false) return pendingLabel
  return 'Será verificado no backend'
}

function RegistrationPreview({ flow, onConfirm, onCancel, onOpenForm, sending }) {
  if (!flow?.preview) return null
  const summary = flow.backendReady ? normalizeAutomaticPreview(flow.preview) : normalizeFallbackPreview(flow.preview)
  const price = formatPrice(summary.price)
  const previousPrice = formatPrice(summary.previousPrice)

  return (
    <section className="admin-ia-registration-card" aria-label="Prévia do cadastro por IA">
      <div className="admin-ia-registration-head">
        {summary.image ? <img src={summary.image} alt="" loading="lazy" /> : <span className="admin-ia-registration-placeholder" aria-hidden="true">✦</span>}
        <div>
          <small>{summary.category ? summary.category.replaceAll('_', ' ') : 'Produto identificado'}</small>
          <strong>{summary.name || [summary.brand, summary.model].filter(Boolean).join(' ') || 'Cadastro encontrado pela IA'}</strong>
          {(summary.brand || summary.model) && <span>{[summary.brand, summary.model].filter(Boolean).join(' · ')}</span>}
        </div>
      </div>

      <div className="admin-ia-registration-grid">
        <div><span>Hardware</span><strong>{entityStatus(summary.hardwareExisting, summary.hardwareId, 'Será criado se necessário')}</strong></div>
        {flow.action === ACTION_PRODUCT && <div><span>Produto</span><strong>{entityStatus(summary.productExisting, summary.productId, 'Será criado')}</strong></div>}
        {flow.action === ACTION_PRODUCT && <div><span>Oferta</span><strong>{entityStatus(summary.offerExisting, summary.offerId, 'Será criada/atualizada')}</strong></div>}
        {flow.action === ACTION_PRODUCT && price && <div><span>Preço</span><strong>{price}</strong>{previousPrice && previousPrice !== price ? <small>Antes: {previousPrice}</small> : null}</div>}
        {flow.action === ACTION_PRODUCT && summary.partner && <div><span>Parceiro</span><strong>{summary.partner}</strong></div>}
      </div>

      {summary.actions.length > 0 && <div className="admin-ia-registration-plan"><span>Plano do backend</span><strong>{summary.actions.map((item) => String(item).replaceAll('_', ' ')).join(' → ')}</strong></div>}
      {summary.warnings.length > 0 && <div className="admin-ia-registration-warning"><strong>Revisar</strong>{summary.warnings.slice(0, 4).map((item, index) => <span key={index}>{String(item)}</span>)}</div>}

      {!flow.backendReady && <p className="admin-ia-registration-note">A análise por URL já funciona. O cadastro automático pelo chat será ativado quando as rotas do backend estiverem disponíveis; por enquanto, abra o formulário com a URL já preenchida.</p>}

      <div className="admin-ia-registration-actions">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={onCancel} disabled={sending}>Cancelar</button>
        {flow.backendReady
          ? <button type="button" className="btn btn-primario btn-pequeno" onClick={onConfirm} disabled={sending || !flow.preview?.tokenConfirmacao}>{sending ? 'Confirmando...' : 'Confirmar cadastro'}</button>
          : <button type="button" className="btn btn-primario btn-pequeno" onClick={onOpenForm} disabled={sending}>Abrir cadastro</button>}
      </div>
    </section>
  )
}

export default function AdminAssistant({ open, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = String(user?.papel || '').toUpperCase()
  const canCreateHardware = role === 'ADMIN'
  const canCreateProduct = role === 'ADMIN'
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistente', text: 'Posso ajudar a revisar cadastros, organizar dados e explicar o estado do painel.' }])
  const [flow, setFlow] = useState(null)
  const context = useMemo(() => ({ rota: location.pathname, area: 'admin' }), [location.pathname])

  function startRegistration(action) {
    const label = action === ACTION_PRODUCT ? 'Produto' : 'Hardware'
    setFlow({ action, step: 'URL', url: '', preview: null, backendReady: false })
    setDraft('')
    setMessages((current) => [...current, { role: 'assistente', text: `Cadastrar ${label}: envie o link do produto. Vou analisar e mostrar uma prévia antes de qualquer cadastro.` }])
  }

  function cancelRegistration() {
    setFlow(null)
    setDraft('')
    setMessages((current) => [...current, { role: 'assistente', text: 'Cadastro por URL cancelado. Nenhum registro foi criado.' }])
  }

  async function analyzeRegistration(url) {
    setSending(true)
    try {
      try {
        const result = await adminService.chatbot.analyzeRegistration({ acao: flow.action, url })
        setFlow((current) => ({ ...current, step: 'PREVIEW', url, preview: result, backendReady: true }))
        setMessages((current) => [...current, { role: 'assistente', text: 'Análise concluída. Confira a prévia abaixo e confirme somente se estiver correta.' }])
        return
      } catch (error) {
        if (!unsupportedChatbotRoute(error)) throw error
      }

      // Compatibilidade enquanto as novas rotas do chatbot ainda não existem.
      const preview = await adminService.ai.importLink(url)
      setFlow((current) => ({ ...current, step: 'PREVIEW', url, preview, backendReady: false }))
      setMessages((current) => [...current, { role: 'assistente', text: 'A IA analisou o link. O backend de confirmação automática ainda não está disponível, então deixei a prévia pronta para abrir no formulário.' }])
    } catch (error) {
      setFlow((current) => current ? { ...current, step: 'URL', preview: null } : current)
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível analisar esse link.' }])
    } finally {
      setSending(false)
    }
  }

  async function confirmRegistration() {
    if (!flow?.backendReady || !flow?.preview?.tokenConfirmacao || sending) return
    setSending(true)
    try {
      const result = await adminService.chatbot.confirmRegistration({ tokenConfirmacao: flow.preview.tokenConfirmacao, confirmar: true })
      const hardware = result?.hardware
      const product = result?.produto
      const offer = result?.oferta
      const parts = [
        hardware?.id ? `Hardware #${hardware.id} ${String(hardware.acao || '').toLowerCase()}` : '',
        product?.id ? `Produto #${product.id} ${String(product.acao || '').toLowerCase()}` : '',
        offer?.id ? `Oferta #${offer.id} ${String(offer.acao || '').toLowerCase()}` : '',
      ].filter(Boolean)
      setMessages((current) => [...current, { role: 'assistente', text: parts.length ? `Cadastro concluído. ${parts.join(' · ')}` : responseText(result) }])
      setFlow(null)
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível confirmar o cadastro.' }])
    } finally {
      setSending(false)
    }
  }

  function openFallbackForm() {
    if (!flow?.preview) return
    const url = clean(flow.url)
    if (flow.action === ACTION_HARDWARE) {
      storeAiImportPreview({ ...flow.preview, destinoSugerido: 'HARDWARE', urlOrigem: flow.preview?.urlOrigem || url })
      navigate('/admin/hardwares/novo?origem=chatbot')
    } else {
      storeAiImportPreview({ ...flow.preview, urlOrigem: flow.preview?.urlOrigem || url })
      navigate(`/admin/produtos/novo?origem=chatbot${url ? `&url=${encodeURIComponent(url)}` : ''}`)
    }
    onClose?.()
  }

  async function send(event) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    if (flow?.step === 'URL') {
      const next = [...messages, { role: 'usuario', text }]
      setMessages(next)
      setDraft('')
      if (!validPublicUrl(text)) {
        setMessages((current) => [...current, { role: 'assistente', text: 'Envie uma URL completa começando com http:// ou https://.' }])
        return
      }
      await analyzeRegistration(text)
      return
    }

    const next = [...messages, { role: 'usuario', text }]
    setMessages(next)
    setDraft('')
    setSending(true)
    try {
      const historico = next.slice(-8).map((item) => ({ papel: item.role === 'usuario' ? 'usuario' : 'assistente', conteudo: item.text }))
      const result = await adminService.ai.chat({ mensagem: text, historico, contexto: context })
      setMessages((current) => [...current, { role: 'assistente', text: responseText(result) }])
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'A IA administrativa não respondeu.' }])
    } finally {
      setSending(false)
    }
  }

  const inputPlaceholder = flow?.step === 'URL' ? 'Cole a URL do produto...' : 'Pergunte sobre o catálogo...'

  return (
    <aside className="admin-ia-painel" data-aberto={open ? 'true' : 'false'} aria-hidden={!open}>
      <header className="admin-ia-cabecalho"><div className="admin-ia-cabecalho-info"><span className="admin-ia-cabecalho-icone">✦</span><div><strong>Assistente Admin</strong><small>Backend / catálogo</small></div></div><button className="admin-ia-fechar" type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="admin-ia-msgs" aria-live="polite">
        {!flow && (canCreateProduct || canCreateHardware) && <div className="admin-ia-quick-actions" aria-label="Ações rápidas do assistente">
          {canCreateProduct && <button type="button" onClick={() => startRegistration(ACTION_PRODUCT)}><span aria-hidden="true">＋</span><strong>Cadastrar Produto</strong><small>Link → IA → prévia</small></button>}
          {canCreateHardware && <button type="button" onClick={() => startRegistration(ACTION_HARDWARE)}><span aria-hidden="true">◇</span><strong>Cadastrar Hardware</strong><small>Link → ficha técnica</small></button>}
        </div>}
        {messages.map((message,index)=><div key={`${message.role}-${index}`} className={`admin-ia-chat-msg admin-ia-chat-msg--${message.role}`}>{message.text}</div>)}
        {flow?.step === 'PREVIEW' && <RegistrationPreview flow={flow} onConfirm={confirmRegistration} onCancel={cancelRegistration} onOpenForm={openFallbackForm} sending={sending} />}
        {sending&&<div className="admin-ia-chat-digitando"><span/><span/><span/></div>}
      </div>
      <form className="admin-ia-entrada" onSubmit={send}><textarea className="admin-ia-textarea" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={inputPlaceholder} maxLength={2000}/><button className="admin-ia-enviar" type="submit" disabled={!draft.trim()||sending}>➤</button></form>
    </aside>
  )
}
