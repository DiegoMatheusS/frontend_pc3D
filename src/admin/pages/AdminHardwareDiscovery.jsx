import { useEffect, useMemo, useState } from 'react'
import { AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { hardwareSchemaFor } from '../components/AdminTechnicalFields'
import { adminService } from '../services/adminService'

const CATEGORIES = [
  ['PROCESSADOR', 'Processadores'],
  ['PLACA_MAE', 'Placas-mãe'],
  ['MEMORIA_RAM', 'Memórias RAM'],
  ['PLACA_VIDEO', 'Placas de vídeo'],
  ['ARMAZENAMENTO', 'Armazenamento'],
  ['FONTE', 'Fontes'],
  ['GABINETE', 'Gabinetes'],
  ['COOLER', 'Coolers'],
  ['VENTOINHA', 'Ventoinhas'],
]

const STATUS_OPTIONS = [
  ['', 'Todos'],
  ['PRONTO', 'Prontos para cadastrar'],
  ['PRECISA_REVISAO', 'Precisam revisão'],
  ['FICHA_INCOMPLETA', 'Ficha incompleta'],
]

const STATUS_LABEL = {
  PRONTO: 'Pronto',
  PRECISA_REVISAO: 'Precisa revisão',
  FICHA_INCOMPLETA: 'Ficha incompleta',
}

const HIDDEN_TECH_KEYS = new Set(['dataLancamento'])
const FORBIDDEN_DISPLAY_TOKENS = ['preco', 'price', 'oferta']

function hasValue(value) {
  if (value === 0 || value === false) return true
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function text(value, fallback = '—') {
  if (value === 0) return '0'
  if (value === false) return 'Não'
  if (value === true) return 'Sim'
  if (!hasValue(value)) return fallback
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function humanize(key = '') {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function listStrings(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).filter(([, enabled]) => enabled !== false && enabled !== null).map(([key, item]) => typeof item === 'string' ? item : key)
      : value ? [value] : []
  return [...new Set(source.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return String(item).trim()
    return String(item?.nome || item?.name || item?.fonte || item?.provider || item?.id || '').trim()
  }).filter(Boolean))]
}

function candidatePayload(item) {
  // Contrato final da Etapa 2: `payload` é o objeto oficial que o backend
  // devolve na descoberta e espera receber novamente no cadastro.
  // Aliases antigos ficam apenas como fallback visual para não quebrar uma resposta em cache.
  const payload = item?.payload || item?.payloadHardware || item?.hardware || {}
  return payload && typeof payload === 'object' ? payload : {}
}

function candidateId(item, index = 0) {
  return String(item?.idTemporario || item?.chaveComparacao || item?.identidade?.chave || `${candidatePayload(item)?.marca || 'hardware'}-${candidatePayload(item)?.modelo || candidatePayload(item)?.nome || index}`)
}

function normalizePercent(value) {
  let number = Number(value)
  if (!Number.isFinite(number) && value && typeof value === 'object') {
    number = Number(value.percentual ?? value.percent ?? value.valor ?? value.score)
  }
  if (!Number.isFinite(number)) return null
  if (number > 0 && number <= 1) number *= 100
  return Math.max(0, Math.min(100, Math.round(number)))
}

function candidateQuality(item) {
  return normalizePercent(item?.metaAiWhatsappFallback?.coberturaAtual ?? item?.cobertura ?? item?.coberturaTecnica ?? item?.qualidade)
}

function metaAiFallbackFor(item) {
  const fallback = item?.metaAiWhatsappFallback
  return fallback && typeof fallback === 'object' ? fallback : null
}

function shouldShowMetaAiButton(item) {
  const fallback = metaAiFallbackFor(item)
  const prompt = typeof fallback?.promptSugerido === 'string' ? fallback.promptSugerido.trim() : ''
  return fallback?.recomendado === true && Boolean(prompt)
}

function shouldShowAiButton(item) {
  const quality = candidateQuality(item)
  const status = candidateStatus(item)
  const explicit = item?.iaTecnicaFallback?.recomendado ?? item?.iaComplemento?.recomendado
  if (typeof explicit === 'boolean') return explicit
  return status !== 'PRONTO' || (quality !== null && quality < 100)
}

function uniqueStrings(...values) {
  return [...new Set(values.flatMap((value) => listStrings(value)).filter(Boolean))]
}

function candidateStatus(item) {
  const explicit = String(item?.statusFicha || '').toUpperCase()
  if (STATUS_LABEL[explicit]) return explicit
  const requiredMissing = listStrings(item?.camposObrigatoriosAusentes)
  const conflicts = Array.isArray(item?.conflitos) ? item.conflitos : []
  if (requiredMissing.length) return 'FICHA_INCOMPLETA'
  if (conflicts.length) return 'PRECISA_REVISAO'
  return 'PRONTO'
}

function candidateIdentity(item, payload) {
  return {
    nome: payload?.nome || item?.nome || 'Hardware sem nome',
    marca: payload?.marca || item?.marca || '',
    modelo: payload?.modelo || item?.modelo || '',
    mpn: payload?.mpn || item?.mpn || '',
    gtin: payload?.gtin || payload?.ean || item?.gtin || item?.ean || '',
  }
}

function fieldValue(type, value) {
  if (!hasValue(value)) return '—'
  if (type === 'boolean') return value === true ? 'Sim' : value === false ? 'Não' : text(value)
  if ((type === 'csv' || type === 'csvNumber' || type === 'multiSelect') && Array.isArray(value)) return value.join(', ')
  if (type === 'date') return String(value).slice(0, 10)
  return text(value)
}

function techDataFor(item) {
  const payload = candidatePayload(item)
  const categoria = String(payload?.categoria || item?.categoria || '').toUpperCase()
  const schema = hardwareSchemaFor(categoria)
  const spec = schema ? (payload?.[schema.key] || item?.especificacoesEncontradas || {}) : (item?.especificacoesEncontradas || {})
  const rows = []
  const covered = new Set()

  if (schema) {
    schema.fields.forEach(([key, label, type]) => {
      covered.add(key)
      if (HIDDEN_TECH_KEYS.has(key)) return
      const value = spec?.[key]
      if (hasValue(value)) rows.push({ key, label, value: fieldValue(type, value), raw: value })
    })
    ;(schema.repeaters || []).forEach((repeater) => {
      covered.add(repeater.key)
      const value = spec?.[repeater.key]
      if (hasValue(value)) rows.push({ key: repeater.key, label: repeater.title, value: text(value), raw: value, repeater })
    })
  }

  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    Object.entries(spec).forEach(([key, value]) => {
      const lower = key.toLowerCase()
      if (covered.has(key) || HIDDEN_TECH_KEYS.has(key) || FORBIDDEN_DISPLAY_TOKENS.some((token) => lower.includes(token)) || !hasValue(value)) return
      rows.push({ key, label: humanize(key), value: text(value), raw: value })
    })
  }

  return { categoria, schema, spec, rows }
}

function SpecValue({ row }) {
  if (Array.isArray(row.raw) && row.raw.some((item) => item && typeof item === 'object')) {
    return <div className="admin-discovery-repeater-list">{row.raw.map((item, index) => <div key={`${row.key}-${index}`} className="admin-discovery-repeater-item"><strong>{row.label} {index + 1}</strong><dl>{Object.entries(item || {}).filter(([, value]) => hasValue(value)).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{text(value)}</dd></div>)}</dl></div>)}</div>
  }
  return <span>{row.value}</span>
}

function HardwareCard({ item, index, selected, busy, metaBusy, aiBusy, itemError, aiError, onToggle, onOpen, onMetaAi, onAi, onAdd }) {
  const payload = candidatePayload(item)
  const identity = candidateIdentity(item, payload)
  const { categoria, rows } = techDataFor(item)
  const quality = candidateQuality(item)
  const status = candidateStatus(item)
  const sources = listStrings(item?.fontes)
  const missing = listStrings(item?.camposObrigatoriosAusentes?.length ? item.camposObrigatoriosAusentes : item?.camposAusentes)
  const conflicts = Array.isArray(item?.conflitos) ? item.conflitos : []
  const warnings = listStrings(item?.avisos)
  const key = candidateId(item, index)
  const showMetaAi = shouldShowMetaAiButton(item)
  const metaApplied = item?.metaAiWhatsappAplicado === true
  const showAi = shouldShowAiButton(item)
  const aiApplied = item?.iaTecnicaAplicada === true
  const aiCompleted = aiApplied && (candidateStatus(item) === 'PRONTO' || quality === 100)

  return (
    <article className={`admin-discovery-card status-${status.toLowerCase().replaceAll('_', '-')}`}>
      <div className="admin-discovery-card-top">
        <label className="admin-discovery-select" title="Selecionar para cadastro em lote">
          <input type="checkbox" checked={selected} onChange={() => onToggle(key)} disabled={busy} />
          <span>Selecionar</span>
        </label>
        <span className={`admin-discovery-status admin-discovery-status--${status.toLowerCase().replaceAll('_', '-')}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="admin-discovery-card-title">
        <span className="admin-discovery-category-mark" aria-hidden="true">{categoria === 'PROCESSADOR' ? 'CPU' : categoria === 'PLACA_VIDEO' ? 'GPU' : categoria === 'PLACA_MAE' ? 'MB' : categoria === 'MEMORIA_RAM' ? 'RAM' : categoria === 'ARMAZENAMENTO' ? 'SSD' : categoria === 'FONTE' ? 'PSU' : categoria === 'GABINETE' ? 'CASE' : categoria === 'VENTOINHA' ? 'FAN' : 'HW'}</span>
        <div>
          <h2>{identity.nome}</h2>
          <p>{[identity.marca, identity.modelo].filter(Boolean).join(' · ') || categoria.replaceAll('_', ' ')}</p>
        </div>
      </div>

      {(identity.mpn || identity.gtin) && <div className="admin-discovery-identifiers">
        {identity.mpn && <span><small>MPN</small><strong>{identity.mpn}</strong></span>}
        {identity.gtin && <span><small>GTIN</small><strong>{identity.gtin}</strong></span>}
      </div>}

      <dl className="admin-discovery-spec-preview">
        {rows.slice(0, 7).map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{Array.isArray(row.raw) && row.raw.some((entry) => entry && typeof entry === 'object') ? `${row.raw.length} item(ns)` : row.value}</dd></div>)}
        {!rows.length && <div className="admin-discovery-no-spec"><dt>Ficha técnica</dt><dd>Dados técnicos ainda não encontrados.</dd></div>}
      </dl>

      <div className="admin-discovery-quality">
        <div><span>Cobertura da ficha</span><strong>{quality === null ? '—' : `${quality}%`}</strong></div>
        <div className="admin-discovery-quality-track" aria-hidden="true"><span style={{ width: `${quality ?? 0}%` }} /></div>
      </div>

      {(warnings.length > 0 || missing.length > 0 || conflicts.length > 0) && <div className="admin-discovery-alerts">
        {warnings.length > 0 && <span>{warnings.length} aviso(s)</span>}
        {missing.length > 0 && <span>{missing.length} campo(s) ainda ausente(s)</span>}
        {conflicts.length > 0 && <span>{conflicts.length} conflito(s) para revisar</span>}
      </div>}

      {itemError && <div className="admin-discovery-item-error" role="alert">{itemError}</div>}
      {aiError && <div className="admin-discovery-item-error" role="alert">{aiError}</div>}

      <div className="admin-discovery-sources">
        <small>Fontes</small>
        <div>{sources.length ? sources.slice(0, 4).map((source) => <span key={source}>{source}</span>) : <span>Não informada</span>}{sources.length > 4 && <span>+{sources.length - 4}</span>}</div>
      </div>

      <div className={`admin-discovery-card-actions ${(showMetaAi || metaApplied) ? 'has-meta-ai' : ''} ${(showAi || aiApplied) ? 'has-ai' : ''}`}>
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => onOpen(item)} disabled={busy || metaBusy || aiBusy}>Ver ficha completa</button>
        {(showAi || aiApplied) && <button type="button" className="btn btn-pequeno admin-discovery-ai-btn" onClick={() => onAi(item, index)} disabled={busy || metaBusy || aiBusy || aiCompleted}>{aiBusy ? 'Completando com IA...' : aiCompleted ? 'Ficha completada pela IA' : aiApplied ? 'Completar novamente com IA' : 'Completar com IA'}</button>}
        {(showMetaAi || metaApplied) && <button type="button" className="btn btn-pequeno admin-discovery-meta-ai-btn" onClick={() => onMetaAi(item, index)} disabled={busy || metaBusy || aiBusy || metaApplied}>{metaApplied ? 'Dados complementados' : metaBusy ? 'Analisando resposta...' : 'Completar com Meta AI'}</button>}
        <button type="button" className="btn btn-primario btn-pequeno" onClick={() => onAdd(item, index)} disabled={busy || metaBusy || aiBusy}>{busy ? 'Cadastrando...' : 'Cadastrar'}</button>
      </div>
    </article>
  )
}

function HardwareDetailModal({ item, onClose, onAdd, busy }) {
  const payload = candidatePayload(item)
  const identity = candidateIdentity(item, payload)
  const { categoria, rows } = techDataFor(item)
  const sources = listStrings(item?.fontes)
  const missing = listStrings(item?.camposAusentes)
  const requiredMissing = listStrings(item?.camposObrigatoriosAusentes)
  const conflicts = Array.isArray(item?.conflitos) ? item.conflitos : []
  const warnings = listStrings(item?.avisos)
  const quality = candidateQuality(item)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return <div className="admin-discovery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="admin-discovery-modal" role="dialog" aria-modal="true" aria-labelledby="discovery-detail-title">
      <header className="admin-discovery-modal-head">
        <div><small>{categoria.replaceAll('_', ' ')}</small><h2 id="discovery-detail-title">{identity.nome}</h2><p>{[identity.marca, identity.modelo].filter(Boolean).join(' · ') || 'Ficha técnica encontrada pela IA'}</p></div>
        <button type="button" className="admin-discovery-modal-close" onClick={onClose} aria-label="Fechar">×</button>
      </header>

      <div className="admin-discovery-modal-body">
        <section className="admin-discovery-detail-summary">
          <div><span>Cobertura técnica</span><strong>{quality === null ? '—' : `${quality}%`}</strong></div>
          <div><span>Status</span><strong>{STATUS_LABEL[candidateStatus(item)]}</strong></div>
          <div><span>MPN</span><strong>{identity.mpn || '—'}</strong></div>
          <div><span>GTIN</span><strong>{identity.gtin || '—'}</strong></div>
        </section>

        {payload?.descricao && <section className="admin-discovery-detail-section"><h3>Descrição</h3><p className="admin-discovery-description">{payload.descricao}</p></section>}

        <section className="admin-discovery-detail-section">
          <h3>Ficha técnica completa</h3>
          {rows.length ? <dl className="admin-discovery-full-spec">{rows.map((row) => <div key={row.key}><dt>{row.label}</dt><dd><SpecValue row={row} /></dd></div>)}</dl> : <div className="admin-empty">Nenhuma especificação técnica estruturada foi retornada.</div>}
        </section>

        <section className="admin-discovery-detail-section admin-discovery-detail-columns">
          <div><h3>Fontes utilizadas</h3><div className="admin-discovery-chip-list">{sources.length ? sources.map((source) => <span key={source}>{source}</span>) : <span>Não informada</span>}</div>{item?.urlFontePrincipal && <a href={item.urlFontePrincipal} target="_blank" rel="noreferrer" className="admin-discovery-source-link">Abrir fonte principal</a>}</div>
          <div><h3>Campos ainda ausentes</h3><div className="admin-discovery-chip-list admin-discovery-chip-list--warning">{[...new Set([...requiredMissing, ...missing])].length ? [...new Set([...requiredMissing, ...missing])].map((field) => <span key={field}>{humanize(field)}</span>) : <span>Nenhum campo ausente informado</span>}</div></div>
        </section>

        {(warnings.length > 0 || conflicts.length > 0 || item?.erroDetalhamento) && <section className="admin-discovery-detail-section">
          <h3>Revisão</h3>
          <div className="admin-discovery-review-list">
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            {conflicts.map((conflict, index) => <p key={`conflict-${index}`}>{typeof conflict === 'string' ? conflict : text(conflict)}</p>)}
            {item?.erroDetalhamento && <p>{text(item.erroDetalhamento)}</p>}
          </div>
        </section>}
      </div>

      <footer className="admin-discovery-modal-actions">
        <button type="button" className="btn btn-secundario" onClick={onClose}>Fechar</button>
        <button type="button" className="btn btn-primario" onClick={() => onAdd(item)} disabled={busy}>{busy ? 'Cadastrando...' : 'Cadastrar Hardware'}</button>
      </footer>
    </section>
  </div>
}


function MetaAiWhatsappModal({ item, busy, error, onClose, onApply, onNotify }) {
  const [responseText, setResponseText] = useState('')
  const [localMessage, setLocalMessage] = useState('')
  const [localError, setLocalError] = useState('')
  const fallback = metaAiFallbackFor(item) || {}
  const payload = candidatePayload(item)
  const identity = candidateIdentity(item, payload)
  const categoria = String(payload?.categoria || item?.categoria || '').toUpperCase()
  const prompt = typeof fallback?.promptSugerido === 'string' ? fallback.promptSugerido.trim() : ''
  const coverage = normalizePercent(fallback?.coberturaAtual ?? candidateQuality(item))
  const missing = uniqueStrings(fallback?.camposAusentes, item?.camposObrigatoriosAusentes, item?.camposAusentes)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [busy, onClose])

  async function copyPrompt() {
    setLocalError('')
    if (!prompt) {
      setLocalError('A IA não retornou uma pergunta sugerida para este Hardware.')
      return
    }
    try {
      await navigator.clipboard.writeText(prompt)
      setLocalMessage('Pergunta copiada.')
      onNotify?.('Pergunta copiada.', 'info')
    } catch {
      setLocalError('Não foi possível copiar automaticamente. Selecione a pergunta e copie manualmente.')
    }
  }

  function openWhatsapp() {
    window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer')
  }

  async function importCapture(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLocalError('')
    setLocalMessage('')
    try {
      const parsed = JSON.parse(await file.text())
      const captured = typeof parsed?.response_text === 'string' ? parsed.response_text.trim() : ''
      if (!captured) throw new Error('O arquivo não contém response_text válido.')
      setResponseText(captured)
      setLocalMessage('Resposta importada do arquivo JSON.')
    } catch (err) {
      setLocalError(err?.message || 'Não foi possível importar o arquivo JSON.')
    }
  }

  function submit() {
    const resposta = responseText.trim()
    setLocalError('')
    setLocalMessage('')
    if (!resposta) {
      setLocalError('Cole ou importe a resposta completa do Meta AI antes de aplicar os dados.')
      return
    }
    onApply(resposta)
  }

  return <div className="admin-discovery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="admin-discovery-modal admin-meta-ai-modal" role="dialog" aria-modal="true" aria-labelledby="meta-ai-whatsapp-title">
      <header className="admin-discovery-modal-head admin-meta-ai-modal-head">
        <div><small>Meta AI · WhatsApp</small><h2 id="meta-ai-whatsapp-title">Completar ficha com Meta AI</h2><p>{identity.nome}</p></div>
        <button type="button" className="admin-discovery-modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
      </header>

      <div className="admin-discovery-modal-body admin-meta-ai-modal-body">
        <section className="admin-meta-ai-summary">
          <div><span>Hardware</span><strong>{identity.nome}</strong></div>
          <div><span>Categoria</span><strong>{categoria.replaceAll('_', ' ') || '—'}</strong></div>
          <div><span>Cobertura atual</span><strong>{coverage === null ? '—' : `${coverage}%`}</strong></div>
          <div><span>Limite sugerido</span><strong>{normalizePercent(fallback?.limiarCobertura) ?? 60}%</strong></div>
        </section>

        <section className="admin-meta-ai-section">
          <h3>Campos técnicos ainda ausentes</h3>
          <div className="admin-discovery-chip-list admin-discovery-chip-list--warning">{missing.length ? missing.map((field) => <span key={field}>{humanize(field)}</span>) : <span>Nenhum campo ausente informado</span>}</div>
        </section>

        <section className="admin-meta-ai-section">
          <div className="admin-meta-ai-section-title"><h3>Pergunta sugerida</h3><div className="admin-meta-ai-inline-actions"><button type="button" className="btn btn-secundario btn-pequeno" onClick={copyPrompt} disabled={busy || !prompt}>Copiar pergunta</button><button type="button" className="btn btn-secundario btn-pequeno" onClick={openWhatsapp} disabled={busy}>Abrir WhatsApp Web</button></div></div>
          <pre className="admin-meta-ai-prompt">{prompt || 'A IA não retornou promptSugerido para este candidato.'}</pre>
        </section>

        <section className="admin-meta-ai-section">
          <label className="admin-meta-ai-response-label" htmlFor="meta-ai-whatsapp-response"><span>Resposta do Meta AI</span><textarea id="meta-ai-whatsapp-response" className="admin-textarea admin-meta-ai-response" value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Cole aqui a resposta completa recebida no WhatsApp." disabled={busy} /></label>
          <div className="admin-meta-ai-import-row"><label className="btn btn-secundario btn-pequeno admin-meta-ai-file-button">Importar captura JSON<input type="file" accept=".json,application/json" onChange={importCapture} disabled={busy} /></label><small>Opcional: selecione meta_ai_whatsapp_capture.json. Apenas response_text será usado.</small></div>
        </section>

        {(localMessage || localError || error) && <div className={`admin-meta-ai-feedback ${(localError || error) ? 'is-error' : 'is-success'}`} role="status">{localError || error || localMessage}</div>}

        <div className="admin-meta-ai-security-note"><strong>Segurança:</strong> o CriaByte não lê a aba do WhatsApp e não envia chave da Produto IA pelo navegador. A resposta é enviada ao backend para interpretação e normalização.</div>
      </div>

      <footer className="admin-discovery-modal-actions">
        <button type="button" className="btn btn-secundario" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className="btn btn-primario" onClick={submit} disabled={busy || !responseText.trim()}>{busy ? 'Analisando resposta...' : 'Aplicar dados'}</button>
      </footer>
    </section>
  </div>
}

export default function AdminHardwareDiscovery() {
  const toast = useAdminToast()
  const [categoria, setCategoria] = useState('PROCESSADOR')
  const [marca, setMarca] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(50)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [addingIds, setAddingIds] = useState(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [batchErrors, setBatchErrors] = useState({})
  const [batchSummary, setBatchSummary] = useState(null)
  const [metaAiItem, setMetaAiItem] = useState(null)
  const [metaAiBusyIds, setMetaAiBusyIds] = useState(new Set())
  const [metaAiError, setMetaAiError] = useState('')
  const [iaTecnicaBusyIds, setIaTecnicaBusyIds] = useState(new Set())
  const [iaTecnicaErrors, setIaTecnicaErrors] = useState({})

  const items = useMemo(() => Array.isArray(result?.itens) ? result.itens : [], [result])
  const filteredItems = useMemo(() => items.filter((item) => !statusFilter || candidateStatus(item) === statusFilter), [items, statusFilter])
  const selectedItems = useMemo(() => items.filter((item, index) => selected.has(candidateId(item, index))), [items, selected])
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selected.has(candidateId(item, items.indexOf(item))))

  async function search(targetPage = 1) {
    setLoading(true)
    setError('')
    setSelected(new Set())
    setBatchErrors({})
    setBatchSummary(null)
    setMetaAiItem(null)
    setMetaAiError('')
    setIaTecnicaErrors({})
    try {
      const payload = await adminService.hardwares.discover({
        categoria,
        ...(marca.trim() ? { marca: marca.trim() } : {}),
        pagina: targetPage,
        limite: Number(limite),
      })
      setResult(payload || { itens: [] })
      setPagina(Number(payload?.pagina) || targetPage)
      if (!Array.isArray(payload?.itens) || !payload.itens.length) toast.show('Nenhum Hardware novo encontrado para estes filtros.', 'info')
    } catch (err) {
      setError(err?.message || 'Não foi possível buscar novos Hardwares.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(key) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected((current) => {
      const next = new Set(current)
      if (allFilteredSelected) filteredItems.forEach((item) => next.delete(candidateId(item, items.indexOf(item))))
      else filteredItems.forEach((item) => next.add(candidateId(item, items.indexOf(item))))
      return next
    })
  }

  function removeCandidates(keys) {
    const remove = new Set(keys)
    setResult((current) => {
      if (!current) return current
      const nextItems = (current.itens || []).filter((item, index) => !remove.has(candidateId(item, index)))
      return { ...current, itens: nextItems, novos: Math.max(0, Number(current.novos ?? current.itens?.length ?? 0) - ((current.itens?.length || 0) - nextItems.length)) }
    })
    setSelected((current) => {
      const next = new Set(current)
      remove.forEach((key) => next.delete(key))
      return next
    })
  }


  function openMetaAi(item) {
    setMetaAiError('')
    setMetaAiItem(item)
  }

  function replaceCandidate(key, updater) {
    let updatedItem = null
    setResult((current) => {
      if (!current) return current
      const nextItems = (current.itens || []).map((item, index) => {
        if (candidateId(item, index) !== key) return item
        updatedItem = updater(item)
        return updatedItem
      })
      return { ...current, itens: nextItems }
    })
    setDetailItem((current) => current && candidateId(current) === key && updatedItem ? updatedItem : current)
    return updatedItem
  }

  async function applyAiTecnica(item, index = items.indexOf(item)) {
    const key = candidateId(item, index)
    const payload = candidatePayload(item)
    const identity = candidateIdentity(item, payload)
    const categoriaAtual = String(payload?.categoria || item?.categoria || categoria || '').toUpperCase()

    setIaTecnicaErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setIaTecnicaBusyIds((current) => new Set(current).add(key))

    try {
      const response = await adminService.hardwares.enrichDiscoveredWithAi({
        provedor: 'GEMINI',
        categoria: categoriaAtual,
        nome: identity.nome,
        payload,
        somentePreencheLacunas: true,
      })

      const nextPayload = response?.payload && typeof response.payload === 'object' ? response.payload : payload
      const filled = uniqueStrings(response?.camposPreenchidos)
      const missingAfter = Array.isArray(response?.camposAusentes) ? listStrings(response.camposAusentes) : null
      const coverageAfter = normalizePercent(response?.coberturaDepois ?? response?.coberturaAtual)
      const statusAfter = String(response?.statusFicha || '').toUpperCase()
      const provider = String(response?.provedor || response?.provider || 'GEMINI').trim() || 'GEMINI'
      const used = response?.utilizado !== false

      replaceCandidate(key, (current) => {
        const removeFilled = (values) => listStrings(values).filter((field) => !filled.includes(field))
        const fallbackMissing = removeFilled(current?.camposAusentes)
        const nextMissing = missingAfter ?? fallbackMissing
        const nextRequiredMissing = missingAfter ?? removeFilled(current?.camposObrigatoriosAusentes)
        const nextSources = uniqueStrings(current?.fontes, used ? [provider] : [])
        const fallbackFromResponse = response?.metaAiWhatsappFallback && typeof response.metaAiWhatsappFallback === 'object'
          ? response.metaAiWhatsappFallback
          : null

        return {
          ...current,
          payload: nextPayload,
          payloadHardware: nextPayload,
          ...(coverageAfter !== null ? { coberturaTecnica: coverageAfter, cobertura: coverageAfter, qualidade: coverageAfter } : {}),
          ...(STATUS_LABEL[statusAfter] ? { statusFicha: statusAfter } : {}),
          fontes: nextSources,
          camposAusentes: nextMissing,
          camposObrigatoriosAusentes: nextRequiredMissing,
          iaTecnicaAplicada: used,
          iaTecnicaResultado: {
            utilizado: response?.utilizado,
            provedor: provider,
            modelo: response?.modelo || '',
            camposPreenchidos: filled,
            coberturaAntes: response?.coberturaAntes,
            coberturaDepois: response?.coberturaDepois,
            conflitos: Array.isArray(response?.conflitos) ? response.conflitos : [],
          },
          ...(fallbackFromResponse ? { metaAiWhatsappFallback: fallbackFromResponse } : {}),
        }
      })

      if (response?.utilizado === false) {
        toast.show(response?.mensagem || response?.message || 'A IA analisou a ficha, mas não encontrou novas lacunas seguras para preencher.', 'info')
      } else {
        const coverageText = coverageAfter !== null ? ` Cobertura: ${coverageAfter}%.` : ''
        const fieldsText = filled.length ? ` ${filled.length} campo(s) preenchido(s).` : ''
        toast.show(`Ficha complementada com ${provider}.${fieldsText}${coverageText}`)
      }
    } catch (err) {
      const message = err?.message || 'Não foi possível completar a ficha com IA.'
      setIaTecnicaErrors((current) => ({ ...current, [key]: message }))
      toast.show(message, 'erro')
    } finally {
      setIaTecnicaBusyIds((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function applyMetaAiWhatsapp(resposta) {
    if (!metaAiItem) return
    const index = items.indexOf(metaAiItem)
    const key = candidateId(metaAiItem, index)
    const payload = candidatePayload(metaAiItem)
    const identity = candidateIdentity(metaAiItem, payload)
    const categoriaAtual = String(payload?.categoria || metaAiItem?.categoria || categoria || '').toUpperCase()

    setMetaAiError('')
    setMetaAiBusyIds((current) => new Set(current).add(key))
    try {
      const response = await adminService.hardwares.enrichDiscoveredWithMetaAi({
        categoria: categoriaAtual,
        nome: identity.nome,
        payload,
        resposta,
        forcar: false,
      })

      const nextPayload = response?.payload && typeof response.payload === 'object' ? response.payload : payload
      const filled = uniqueStrings(response?.camposPreenchidos)
      const coverageAfter = normalizePercent(response?.coberturaDepois)
      const used = response?.utilizado !== false

      replaceCandidate(key, (current) => {
        const removeFilled = (values) => listStrings(values).filter((field) => !filled.includes(field))
        const nextSources = uniqueStrings(current?.fontes, used ? ['META_AI_WHATSAPP'] : [])
        return {
          ...current,
          payload: nextPayload,
          payloadHardware: nextPayload,
          ...(coverageAfter !== null ? { coberturaTecnica: coverageAfter, cobertura: coverageAfter } : {}),
          fontes: nextSources,
          camposAusentes: removeFilled(current?.camposAusentes),
          camposObrigatoriosAusentes: removeFilled(current?.camposObrigatoriosAusentes),
          metaAiWhatsappAplicado: used,
          metaAiWhatsappFallback: {
            ...(current?.metaAiWhatsappFallback || {}),
            recomendado: used ? false : current?.metaAiWhatsappFallback?.recomendado,
            ...(response?.coberturaDepois !== undefined ? { coberturaAtual: response.coberturaDepois } : {}),
          },
          metaAiWhatsappResultado: {
            utilizado: response?.utilizado,
            motivo: response?.motivo || '',
            camposPreenchidos: filled,
            coberturaAntes: response?.coberturaAntes,
            coberturaDepois: response?.coberturaDepois,
          },
        }
      })

      if (response?.utilizado === false) {
        const message = response?.motivo === 'COBERTURA_NORMAL_SUFICIENTE'
          ? 'A ficha já possui cobertura técnica suficiente.'
          : (response?.mensagem || response?.message || 'A resposta foi analisada, mas não foi necessário complementar a ficha.')
        toast.show(message, 'info')
      } else {
        const suffix = filled.length ? ` ${filled.length} campo(s) preenchido(s).` : ''
        toast.show(`Dados do Meta AI aplicados à ficha.${suffix}`)
      }
      setMetaAiItem(null)
    } catch (err) {
      const detail = typeof err?.data?.detail === 'string' ? err.data.detail
        : typeof err?.data?.detalhe === 'string' ? err.data.detalhe
          : typeof err?.details === 'string' ? err.details
            : ''
      const message = detail || err?.message || 'Não foi possível completar a ficha com o Meta AI.'
      setMetaAiError(message)
      toast.show(message, 'erro')
    } finally {
      setMetaAiBusyIds((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function addOne(item, index = items.indexOf(item)) {
    const key = candidateId(item, index)
    setAddingIds((current) => new Set(current).add(key))
    try {
      const response = await adminService.hardwares.createDiscovered({
        idTemporario: item?.idTemporario || key,
        payload: candidatePayload(item),
      })
      const status = String(response?.status || response?.resultado || '').toUpperCase()
      if (status === 'JA_EXISTE') {
        toast.show('Este Hardware já havia sido cadastrado e foi removido da lista.', 'info')
        removeCandidates([key])
      } else if (status === 'CRIADO') {
        toast.show('Hardware cadastrado com sucesso.')
        removeCandidates([key])
      } else {
        throw new Error(response?.mensagem || response?.message || 'O backend retornou um status de cadastro inesperado.')
      }
      setBatchErrors((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      if (detailItem && candidateId(detailItem) === key) setDetailItem(null)
    } catch (err) {
      const message = err?.message || 'Não foi possível cadastrar o Hardware.'
      setBatchErrors((current) => ({ ...current, [key]: message }))
      toast.show(message, 'erro')
    } finally {
      setAddingIds((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function addBatch() {
    if (!selectedItems.length) return
    if (!window.confirm(`Cadastrar ${selectedItems.length} Hardware(s) selecionado(s)?`)) return
    setBatchBusy(true)
    try {
      const sent = selectedItems.map((item, index) => ({
        idTemporario: item?.idTemporario || candidateId(item, index),
        payload: candidatePayload(item),
      }))
      const response = await adminService.hardwares.createDiscoveredBatch(sent)
      const results = Array.isArray(response?.resultados) ? response.resultados : []
      const selectedByTemporaryId = new Map(selectedItems.map((item, index) => {
        const key = candidateId(item, items.indexOf(item) >= 0 ? items.indexOf(item) : index)
        return [String(item?.idTemporario || key), key]
      }))
      const successfulKeys = []
      const itemErrors = {}

      results.forEach((entry) => {
        const temporaryId = String(entry?.idTemporario || '')
        const key = selectedByTemporaryId.get(temporaryId)
        if (!key) return
        const status = String(entry?.status || entry?.resultado || '').toUpperCase()
        if (status === 'CRIADO' || status === 'JA_EXISTE') {
          successfulKeys.push(key)
          return
        }
        if (status === 'ERRO') {
          itemErrors[key] = entry?.mensagem || entry?.message || (entry?.erro ? text(entry.erro) : '') || 'Erro ao cadastrar este Hardware.'
        }
      })

      removeCandidates(successfulKeys)
      setBatchErrors((current) => {
        const next = { ...current }
        successfulKeys.forEach((key) => delete next[key])
        Object.assign(next, itemErrors)
        return next
      })

      const summary = {
        totalSolicitado: Number(response?.totalSolicitado ?? selectedItems.length),
        criados: Number(response?.criados || 0),
        jaExistiam: Number(response?.jaExistiam || 0),
        erros: Number(response?.erros || 0),
      }
      setBatchSummary(summary)
      const message = `Lote concluído: ${summary.criados} criado(s), ${summary.jaExistiam} já existente(s), ${summary.erros} erro(s).`
      toast.show(message, summary.erros ? 'info' : undefined)
    } catch (err) {
      toast.show(err?.message || 'Não foi possível cadastrar o lote.', 'erro')
    } finally {
      setBatchBusy(false)
    }
  }

  const totalFound = Number(result?.totalEncontrados ?? 0)
  const alreadyRegistered = Number(result?.jaCadastrados ?? 0)
  const newCount = Number(result?.novos ?? items.length)
  const duplicateCount = Number(result?.duplicadosNaBusca ?? 0)
  const discardedCount = Number(result?.descartadosInvalidos ?? 0)

  return <>
    <AdminPageHeader title="Descobrir Hardwares com IA" description="Encontre novos modelos em fontes técnicas. O backend remove os Hardwares que já existem e você decide quais deseja cadastrar." />

    <section className="admin-discovery-search-card">
      <div className="admin-discovery-search-grid">
        <label className="admin-toolbar-field"><span>Categoria *</span><select className="admin-select" value={categoria} onChange={(event) => { setCategoria(event.target.value); setPagina(1); setResult(null); setSelected(new Set()); setBatchErrors({}); setBatchSummary(null) }}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-toolbar-field"><span>Marca</span><input className="admin-input" value={marca} onChange={(event) => setMarca(event.target.value)} placeholder="Ex.: Intel, AMD, ASUS" /></label>
        <label className="admin-toolbar-field"><span>Limite</span><select className="admin-select" value={limite} onChange={(event) => setLimite(Number(event.target.value))}><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></label>
        <label className="admin-toolbar-field"><span>Página</span><input className="admin-input" type="number" min="1" step="1" value={pagina} onChange={(event) => setPagina(Math.max(1, Number(event.target.value) || 1))} /></label>
      </div>
      <div className="admin-discovery-search-actions">
        <div className="admin-discovery-source-note">O navegador chama somente o backend do CriaByte. A consulta às fontes técnicas e a deduplicação são feitas no servidor.</div>
        <button className="btn btn-primario" type="button" onClick={() => search(pagina)} disabled={loading}>{loading ? 'Buscando com IA...' : 'Descobrir Hardwares'}</button>
      </div>
    </section>

    {error && <div className="admin-error-box admin-discovery-error"><strong>Não foi possível concluir a descoberta.</strong><span>{error}</span><button className="btn btn-secundario btn-pequeno" type="button" onClick={() => search(pagina)}>Tentar novamente</button></div>}

    {loading && <section className="admin-discovery-loading"><span className="route-loading__spinner" aria-hidden="true" /><div><strong>Procurando novos Hardwares...</strong><p>A IA está consultando e enriquecendo as fichas técnicas. Os modelos que já existem no CriaByte não serão mostrados.</p></div></section>}

    {result && !loading && <>
      <section className="admin-discovery-stats" aria-label="Resumo da descoberta">
        <article><span>Encontrados</span><strong>{totalFound}</strong></article>
        <article><span>Já cadastrados</span><strong>{alreadyRegistered}</strong><small>não exibidos</small></article>
        <article><span>Duplicados na busca</span><strong>{duplicateCount}</strong></article>
        <article><span>Descartados inválidos</span><strong>{discardedCount}</strong></article>
        <article className="is-new"><span>Novos</span><strong>{newCount}</strong><small>exibidos abaixo</small></article>
      </section>

      {(duplicateCount > 0 || discardedCount > 0) && <div className="admin-discovery-diagnostics">{duplicateCount > 0 && <span>{duplicateCount} duplicata(s) removida(s) da própria busca.</span>}{discardedCount > 0 && <span>{discardedCount} resultado(s) inválido(s) descartado(s).</span>}</div>}

      {batchSummary && <section className={`admin-discovery-batch-summary ${batchSummary.erros ? 'has-errors' : ''}`} aria-label="Resumo do cadastro em lote"><strong>Último lote</strong><span>Solicitados: {batchSummary.totalSolicitado}</span><span>Criados: {batchSummary.criados}</span><span>Já existiam: {batchSummary.jaExistiam}</span><span>Erros: {batchSummary.erros}</span></section>}

      <section className="admin-discovery-list-toolbar">
        <div className="admin-discovery-list-filters">
          <label className="admin-discovery-check-all"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} disabled={!filteredItems.length || batchBusy} /> <span>Selecionar exibidos</span></label>
          <label><span>Status da ficha</span><select className="admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="admin-discovery-batch-actions"><span>{selected.size} selecionado(s)</span><button type="button" className="btn btn-primario" disabled={!selectedItems.length || batchBusy} onClick={addBatch}>{batchBusy ? 'Cadastrando...' : `Cadastrar selecionados${selectedItems.length ? ` (${selectedItems.length})` : ''}`}</button></div>
      </section>

      {filteredItems.length ? <section className="admin-discovery-grid">{filteredItems.map((item) => {
        const originalIndex = items.indexOf(item)
        const key = candidateId(item, originalIndex)
        return <HardwareCard key={key} item={item} index={originalIndex} selected={selected.has(key)} busy={addingIds.has(key) || batchBusy} metaBusy={metaAiBusyIds.has(key)} aiBusy={iaTecnicaBusyIds.has(key)} itemError={batchErrors[key] || ''} aiError={iaTecnicaErrors[key] || ''} onToggle={toggle} onOpen={setDetailItem} onMetaAi={openMetaAi} onAi={applyAiTecnica} onAdd={addOne} />
      })}</section> : <section className="admin-discovery-empty"><strong>Nenhum Hardware novo para exibir.</strong><p>{items.length ? 'Nenhum resultado corresponde ao filtro de status atual.' : 'Todos os modelos encontrados já estão cadastrados, foram descartados ou a IA não encontrou candidatos novos.'}</p></section>}

      <div className="admin-discovery-pagination">
        <button type="button" className="btn btn-secundario btn-pequeno" disabled={loading || pagina <= 1} onClick={() => search(Math.max(1, pagina - 1))}>← Página anterior</button>
        <span>Página {pagina}</span>
        <button type="button" className="btn btn-secundario btn-pequeno" disabled={loading || totalFound < limite} onClick={() => search(pagina + 1)}>Próxima página →</button>
      </div>
    </>}

    {!result && !loading && <section className="admin-discovery-intro">
      <span className="admin-discovery-intro-icon" aria-hidden="true">IA</span>
      <div><h2>Descubra o que ainda falta no catálogo</h2><p>Escolha uma categoria, informe a marca se quiser reduzir o escopo e faça a busca. O backend devolve somente candidatos novos.</p><ul><li>Nenhum Produto, Oferta ou preço é criado nesta página.</li><li>Você pode revisar a ficha completa antes de cadastrar.</li><li>O cadastro em lote valida cada Hardware individualmente.</li></ul></div>
    </section>}

    {metaAiItem && <MetaAiWhatsappModal item={metaAiItem} busy={metaAiBusyIds.has(candidateId(metaAiItem, items.indexOf(metaAiItem)))} error={metaAiError} onClose={() => { if (!metaAiBusyIds.has(candidateId(metaAiItem, items.indexOf(metaAiItem)))) { setMetaAiItem(null); setMetaAiError('') } }} onApply={applyMetaAiWhatsapp} onNotify={(message, type) => toast.show(message, type)} />}
    {detailItem && <HardwareDetailModal item={detailItem} onClose={() => setDetailItem(null)} onAdd={addOne} busy={addingIds.has(candidateId(detailItem)) || batchBusy} />}
  </>
}
