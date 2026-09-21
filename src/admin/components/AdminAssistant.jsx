import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { storeAiImportPreview } from '../utils/aiImportTransfer'
import { getAiConflicts, getAiMissingFields, getAiOffer, getAiPayload, getAiReadiness, getAiReconciliation } from '../utils/aiImportContract'

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

function canAutoConfirm(preview = {}) {
  const readiness = getAiReadiness(preview)
  const warnings = Array.isArray(preview?.avisos) ? preview.avisos : []
  return Boolean(
    preview?.tokenConfirmacao
    && preview?.podeConfirmar === true
    && readiness.ready !== false
    && readiness.enabled !== false
    && warnings.length === 0
    && getAiMissingFields(preview).length === 0
    && getAiConflicts(preview).length === 0
  )
}

function previewSource(preview = {}) {
  return getAiPayload(preview)
}

function previewOffer(preview = {}) {
  return getAiOffer(preview)
}

function normalizeAutomaticPreview(data = {}) {
  const analysis = data?.analise || data?.analysis || {}
  const hardware = analysis?.hardware || data?.hardware || {}
  const product = analysis?.produto || data?.produto || {}
  const offer = analysis?.oferta || data?.oferta || {}
  const source = getAiPayload(data)
  const structuredOffer = getAiOffer(data) || {}
  const hardwareData = { ...source, ...(hardware?.dadosDetectados || hardware?.dados || hardware?.data || {}) }
  const productData = { ...source, ...(product?.dadosDetectados || product?.dados || product?.data || {}) }
  const offerData = { ...structuredOffer, ...(offer?.dadosDetectados || offer?.dados || offer?.data || {}) }
  const missing = getAiMissingFields(data)
  const conflicts = getAiConflicts(data)

  return {
    name: clean(productData?.nome || hardwareData?.nome || data?.nome),
    brand: clean(productData?.marca || hardwareData?.marca),
    model: clean(productData?.modelo || hardwareData?.modelo),
    category: clean(analysis?.categoria || data?.categoria || hardwareData?.categoria || data?.categoriaDetectada),
    image: clean(productData?.imagemUrl || hardwareData?.imagemUrl),
    price: offerData?.preco ?? offer?.preco,
    previousPrice: offerData?.precoAnterior ?? offer?.precoAnterior,
    partner: clean(offerData?.parceiroNome || offer?.parceiroNome || offerData?.parceiro?.nome || offer?.parceiro?.nome),
    affiliateUrl: clean(offerData?.urlAfiliada || offer?.urlAfiliada),
    hardwareExisting: hardware?.existente,
    hardwareId: hardware?.id,
    productExisting: product?.existente ?? Boolean(getAiReconciliation(data)?.produtoExistente),
    productId: product?.id ?? getAiReconciliation(data)?.produtoExistente?.id,
    offerExisting: offer?.existente ?? Boolean(getAiReconciliation(data)?.ofertaExistente),
    offerId: offer?.id ?? getAiReconciliation(data)?.ofertaExistente?.id,
    actions: Array.isArray(data?.acoesPrevistas) ? data.acoesPrevistas : [],
    warnings: [
      ...(Array.isArray(data?.avisos) ? data.avisos : []),
      ...missing.map((field) => `Campo para revisão: ${field}`),
      ...conflicts.map((item) => typeof item === 'string' ? item : `Conflito em ${item?.campo || 'campo técnico'}`),
    ],
    technical: source,
  }
}

function normalizeFallbackPreview(preview = {}) {
  const source = previewSource(preview)
  const offer = previewOffer(preview) || {}
  const reconciliation = getAiReconciliation(preview)
  return {
    name: clean(source.nome),
    brand: clean(source.marca),
    model: clean(source.modelo),
    category: clean(source.categoria || preview?.categoriaDetectada || preview?.categoriaSugerida),
    image: clean(source.imagemUrl),
    price: offer?.preco,
    previousPrice: offer?.precoAnterior,
    partner: clean(offer?.parceiroNome || offer?.parceiro?.nome),
    affiliateUrl: clean(offer?.urlAfiliada),
    hardwareExisting: reconciliation?.hardwareExistente ? true : undefined,
    hardwareId: reconciliation?.hardwareExistente?.id,
    productExisting: reconciliation?.produtoExistente ? true : undefined,
    productId: reconciliation?.produtoExistente?.id,
    offerExisting: reconciliation?.ofertaExistente ? true : undefined,
    offerId: reconciliation?.ofertaExistente?.id,
    actions: [],
    warnings: [
      ...(Array.isArray(preview?.normalizacao?.alertas) ? preview.normalizacao.alertas : []),
      ...getAiMissingFields(preview).map((field) => `Campo para revisão: ${field}`),
      ...getAiConflicts(preview).map((item) => typeof item === 'string' ? item : `Conflito em ${item?.campo || 'campo técnico'}`),
    ],
    technical: source,
  }
}

function entityStatus(value, id, pendingLabel) {
  if (value === true) return `Já cadastrado${id ? ` (#${id})` : ''}`
  if (value === false) return pendingLabel
  return 'Será verificado no backend'
}

function RegistrationLinkForm({ flow, onChange, onSubmit, onCancel, sending }) {
  const isProduct = flow?.action === ACTION_PRODUCT
  const productUrl = clean(flow?.url)
  const affiliateUrl = clean(flow?.affiliateUrl)
  const productValid = validPublicUrl(productUrl)
  const affiliateValid = !isProduct || validPublicUrl(affiliateUrl)
  const ready = productValid && affiliateValid && !sending

  return (
    <form className="admin-ia-link-form" onSubmit={(event) => { event.preventDefault(); if (ready) onSubmit(productUrl, affiliateUrl) }}>
      <div className="admin-ia-link-form__head">
        <strong>{isProduct ? 'Cadastro automático de produto' : 'Analisar Hardware por link'}</strong>
        <small>{isProduct ? 'Mercado Livre e Shopee usam a API do marketplace quando disponível.' : 'A IA pesquisa a ficha técnica antes de cadastrar.'}</small>
      </div>
      <label>
        <span>Link do produto</span>
        <input
          type="url"
          value={flow?.url || ''}
          onChange={(event) => onChange('url', event.target.value)}
          placeholder="https://..."
          autoComplete="off"
          required
          disabled={sending}
        />
      </label>
      {isProduct && (
        <label>
          <span>Link afiliado</span>
          <input
            type="url"
            value={flow?.affiliateUrl || ''}
            onChange={(event) => onChange('affiliateUrl', event.target.value)}
            placeholder="https://..."
            autoComplete="off"
            required
            disabled={sending}
          />
        </label>
      )}
      <div className="admin-ia-link-form__actions">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={onCancel} disabled={sending}>Cancelar</button>
        <button type="submit" className="btn btn-primario btn-pequeno" disabled={!ready}>
          {sending ? 'Analisando...' : isProduct ? 'Cadastrar produto com IA' : 'Analisar Hardware'}
        </button>
      </div>
      {isProduct && <small className="admin-ia-link-form__note">Se a IA encontrar conflito, duplicidade ambígua ou dado obrigatório ausente, ela para na prévia para você revisar.</small>}
    </form>
  )
}

function RegistrationPreview({ flow, onConfirm, onCancel, onOpenForm, sending }) {
  if (!flow?.preview) return null
  const summary = flow.backendReady ? normalizeAutomaticPreview(flow.preview) : normalizeFallbackPreview(flow.preview)
  const price = formatPrice(summary.price)
  const previousPrice = formatPrice(summary.previousPrice)
  const readiness = getAiReadiness(flow.preview)
  const identityKeys = new Set(['nome','marca','modelo','descricao','mpn','gtin','ean','imagemUrl','categoria','metadados'])
  const technicalEntries = Object.entries(summary.technical || {})
    .filter(([key, value]) => !identityKeys.has(key) && value !== null && value !== '' && typeof value !== 'object')
    .slice(0, 6)

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
        {price && <div><span>{flow.action === ACTION_PRODUCT ? 'Preço' : 'Preço encontrado'}</span><strong>{price}</strong>{previousPrice && previousPrice !== price ? <small>Antes: {previousPrice}</small> : null}</div>}
        {flow.action === ACTION_PRODUCT && summary.partner && <div><span>Parceiro</span><strong>{summary.partner}</strong></div>}
        {flow.action === ACTION_PRODUCT && summary.affiliateUrl && <div><span>Link afiliado</span><strong>Informado ✓</strong></div>}
      </div>

      {technicalEntries.length > 0 && <div className="admin-ia-registration-plan"><span>Principais dados técnicos</span><strong>{technicalEntries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</strong></div>}
      {flow.action === ACTION_HARDWARE && price && <p className="admin-ia-registration-note">O preço foi encontrado no anúncio apenas para conferência e não será salvo no Hardware.</p>}
      {summary.actions.length > 0 && <div className="admin-ia-registration-plan"><span>Plano do backend</span><strong>{summary.actions.map((item) => String(item).replaceAll('_', ' ')).join(' → ')}</strong></div>}
      {summary.warnings.length > 0 && <div className="admin-ia-registration-warning"><strong>Revisar</strong>{summary.warnings.slice(0, 4).map((item, index) => <span key={index}>{String(item)}</span>)}</div>}

      {!flow.backendReady && <p className="admin-ia-registration-note">A análise por URL já funciona. O cadastro automático pelo chat será ativado quando as rotas do backend estiverem disponíveis; por enquanto, abra o formulário com a URL já preenchida.</p>}

      <div className="admin-ia-registration-actions">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={onCancel} disabled={sending}>Cancelar</button>
        {flow.backendReady && <button type="button" className="btn btn-secundario btn-pequeno" onClick={onOpenForm} disabled={sending}>Corrigir dados</button>}
        {flow.backendReady
          ? <button type="button" className="btn btn-primario btn-pequeno" onClick={onConfirm} disabled={sending || !flow.preview?.tokenConfirmacao || readiness.ready === false || readiness.enabled === false}>{sending ? 'Confirmando...' : 'Confirmar cadastro'}</button>
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
    setFlow({ action, step: 'URL', url: '', affiliateUrl: '', preview: null, backendReady: false })
    setDraft('')
    setMessages((current) => [...current, {
      role: 'assistente',
      text: action === ACTION_PRODUCT
        ? 'Cole o link do produto e o seu link afiliado nos campos abaixo. Se a análise estiver segura, eu cadastro automaticamente; se houver dúvida, mostro a prévia.'
        : `Cadastrar ${label}: cole o link abaixo. Vou analisar a ficha técnica antes de qualquer cadastro.`,
    }])
  }

  function cancelRegistration() {
    setFlow(null)
    setDraft('')
    setMessages((current) => [...current, { role: 'assistente', text: 'Cadastro por URL cancelado. Nenhum registro foi criado.' }])
  }

  async function finishRegistration(preview, automatic = false) {
    const result = await adminService.chatbot.confirmRegistration({ tokenConfirmacao: preview.tokenConfirmacao, confirmar: true })
    const hardware = result?.hardware
    const product = result?.produto
    const offer = result?.oferta
    const parts = [
      hardware?.id ? `Hardware #${hardware.id} ${String(hardware.acao || '').toLowerCase()}` : '',
      product?.id ? `Produto #${product.id} ${String(product.acao || '').toLowerCase()}` : '',
      offer?.id ? `Oferta #${offer.id} ${String(offer.acao || '').toLowerCase()}` : '',
    ].filter(Boolean)
    const prefix = automatic ? 'Cadastro automático concluído.' : 'Cadastro concluído.'
    setMessages((current) => [...current, { role: 'assistente', text: parts.length ? `${prefix} ${parts.join(' · ')}` : responseText(result) }])
    setFlow(null)
    return result
  }

  async function analyzeRegistration(url, affiliateUrl = '') {
    setSending(true)
    try {
      try {
        const body = {
          acao: flow.action,
          url,
          ...(flow.action === ACTION_PRODUCT && affiliateUrl ? { urlAfiliada: affiliateUrl } : {}),
        }
        const result = await adminService.chatbot.analyzeRegistration(body)
        if (flow.action === ACTION_PRODUCT && affiliateUrl && canAutoConfirm(result)) {
          setMessages((current) => [...current, { role: 'assistente', text: 'Análise segura e sem conflitos. Cadastrando Produto e Oferta...' }])
          await finishRegistration(result, true)
          return
        }
        setFlow((current) => ({ ...current, step: 'PREVIEW', url, affiliateUrl, preview: result, backendReady: true }))
        setMessages((current) => [...current, { role: 'assistente', text: 'Encontrei dados que precisam de conferência. Revise a prévia abaixo antes de confirmar.' }])
        return
      } catch (error) {
        if (!unsupportedChatbotRoute(error)) throw error
      }

      const preview = await adminService.ai.importLink(url)
      const previewWithAffiliate = flow.action === ACTION_PRODUCT && affiliateUrl
        ? {
            ...preview,
            ofertaColetada: {
              ...(preview?.ofertaColetada || {}),
              urlOriginal: preview?.ofertaColetada?.urlOriginal || url,
              urlAfiliada: affiliateUrl,
            },
          }
        : preview
      setFlow((current) => ({ ...current, step: 'PREVIEW', url, affiliateUrl, preview: previewWithAffiliate, backendReady: false }))
      setMessages((current) => [...current, { role: 'assistente', text: 'A IA analisou o link. O backend de confirmação automática ainda não está disponível, então deixei a prévia pronta para abrir no formulário.' }])
    } catch (error) {
      setFlow((current) => current ? { ...current, step: 'URL', preview: null } : current)
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível analisar esse link.' }])
    } finally {
      setSending(false)
    }
  }

  async function confirmRegistration() {
    const readiness = getAiReadiness(flow?.preview || {})
    if (!flow?.backendReady || !flow?.preview?.tokenConfirmacao || sending || readiness.ready === false || readiness.enabled === false) return
    setSending(true)
    try {
      await finishRegistration(flow.preview, false)
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'Não foi possível confirmar o cadastro.' }])
    } finally {
      setSending(false)
    }
  }

  function openFallbackForm() {
    if (!flow?.preview) return
    const url = clean(flow.url)
    const currentPayload = getAiPayload(flow.preview)
    const analysis = flow.preview?.analise || flow.preview?.analysis || {}
    const hardwareData = analysis?.hardware?.dadosDetectados || analysis?.hardware?.dados || analysis?.hardware?.data || {}
    const productData = analysis?.produto?.dadosDetectados || analysis?.produto?.dados || analysis?.produto?.data || {}
    const offerData = analysis?.oferta?.dadosDetectados || analysis?.oferta?.dados || analysis?.oferta?.data || {}
    const category = analysis?.categoria || hardwareData?.categoria || productData?.categoria
    const transferable = Object.keys(currentPayload).length
      ? flow.preview
      : {
          ...flow.preview,
          categoriaSugerida: category,
          cadastroSugerido: {
            ...(flow.preview?.cadastroSugerido || {}),
            payload: { ...hardwareData, ...productData, ...(category ? { categoria: category } : {}) },
          },
          ofertaColetada: Object.keys(offerData).length ? offerData : flow.preview?.ofertaColetada,
        }

    if (flow.action === ACTION_HARDWARE) {
      storeAiImportPreview({ ...transferable, destinoSugerido: 'HARDWARE', urlOrigem: transferable?.urlOrigem || url })
      navigate('/admin/hardwares/novo?origem=chatbot')
    } else {
      storeAiImportPreview({ ...transferable, destinoSugerido: 'PRODUTO', urlOrigem: transferable?.urlOrigem || url })
      navigate(`/admin/produtos/novo?origem=chatbot${url ? `&url=${encodeURIComponent(url)}` : ''}`)
    }
    onClose?.()
  }

  async function send(event) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

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

  const inputPlaceholder = 'Pergunte sobre o catálogo...'

  return (
    <aside className="admin-ia-painel" data-aberto={open ? 'true' : 'false'} aria-hidden={!open}>
      <header className="admin-ia-cabecalho"><div className="admin-ia-cabecalho-info"><span className="admin-ia-cabecalho-icone">✦</span><div><strong>Assistente Admin</strong><small>Backend / catálogo</small></div></div><button className="admin-ia-fechar" type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="admin-ia-msgs" aria-live="polite">
        {!flow && (canCreateProduct || canCreateHardware) && <div className="admin-ia-quick-actions" aria-label="Ações rápidas do assistente">
          {canCreateProduct && <button type="button" onClick={() => startRegistration(ACTION_PRODUCT)}><span aria-hidden="true">＋</span><strong>Cadastrar Produto</strong><small>2 links → IA → cadastro</small></button>}
          {canCreateHardware && <button type="button" onClick={() => startRegistration(ACTION_HARDWARE)}><span aria-hidden="true">◇</span><strong>Cadastrar Hardware</strong><small>Link → ficha técnica</small></button>}
        </div>}
        {messages.map((message,index)=><div key={`${message.role}-${index}`} className={`admin-ia-chat-msg admin-ia-chat-msg--${message.role}`}>{message.text}</div>)}
        {flow?.step === 'PREVIEW' && <RegistrationPreview flow={flow} onConfirm={confirmRegistration} onCancel={cancelRegistration} onOpenForm={openFallbackForm} sending={sending} />}
        {sending&&<div className="admin-ia-chat-digitando"><span/><span/><span/></div>}
      </div>
      {flow?.step === 'URL'
        ? <RegistrationLinkForm
            flow={flow}
            onChange={(field, value) => setFlow((current) => current ? { ...current, [field]: value } : current)}
            onSubmit={analyzeRegistration}
            onCancel={cancelRegistration}
            sending={sending}
          />
        : <form className="admin-ia-entrada" onSubmit={send}><textarea className="admin-ia-textarea" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={inputPlaceholder} maxLength={2000}/><button className="admin-ia-enviar" type="submit" disabled={!draft.trim()||sending}>➤</button></form>}
    </aside>
  )
}
