import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import AdminMultiOfferEditor from '../components/AdminMultiOfferEditor'
import { emptyOfferRow, normalizeOfferRow } from '../components/AdminMultiOfferEditor.utils'
import { consumeAiImportPreview } from '../utils/aiImportTransfer'

const EMPTY = {
  nome: '', marca: '', modelo: '', descricao: '', mpn: '', gtin: '', imagemUrl: '', imagemHoverUrl: '',
  publicado: true, ativo: true, especificacao: '{}',
}

const NOTEBOOK_SPEC_FIELDS = new Set([
  'processadorNome', 'processadorMarca', 'processadorGeracao', 'nucleos', 'threads', 'clockBaseMhz', 'clockTurboMhz', 'tdpWatts',
  'gpuNome', 'gpuIntegrada', 'gpuDedicada', 'vramGb', 'tgpWatts',
  'ramInstaladaGb', 'tipoMemoria', 'frequenciaMhz', 'ramSoldadaGb', 'slotsRamTotal', 'slotsRamLivres', 'ramMaximaGb', 'upgradeRam',
  'armazenamentoGb', 'tipoArmazenamento', 'slotsM2Total', 'slotsM2Livres', 'upgradeArmazenamento',
  'tamanhoTelaPolegadas', 'resolucaoLargura', 'resolucaoAltura', 'taxaAtualizacaoHz', 'tipoPainel', 'brilhoNits', 'touch',
  'bateriaWh', 'autonomiaInformadaHoras', 'potenciaCarregadorWatts',
  'pesoKg', 'larguraMm', 'alturaMm', 'profundidadeMm',
  'wifi', 'bluetooth', 'usbA', 'usbC', 'thunderbolt', 'hdmi', 'displayPort', 'ethernet', 'leitorCartao',
  'sistemaOperacional', 'webcam', 'resolucaoWebcam', 'tecladoIluminado', 'tecladoNumerico', 'leitorDigital',
])

function cleanText(value) {
  return String(value ?? '').trim()
}

function sanitizeNotebookSpec(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([key, fieldValue]) => {
      if (!NOTEBOOK_SPEC_FIELDS.has(key) || fieldValue === undefined || fieldValue === null || fieldValue === '') return false
      if ((key === 'ramInstaladaGb' || key === 'ramMaximaGb') && (!Number.isFinite(Number(fieldValue)) || Number(fieldValue) <= 0)) return false
      return true
    }),
  )
}

function parseNotebookSpec(value) {
  try { return sanitizeNotebookSpec(JSON.parse(value || '{}')) } catch { return {} }
}

function optionalString(value, editing) {
  const clean = cleanText(value)
  return clean || (editing ? null : undefined)
}

function normalizedNotebookForm(item = {}) {
  const product = item.produto && typeof item.produto === 'object' ? item.produto : {}
  const specification = sanitizeNotebookSpec(item.especificacao || item.especificacoes || {})
  return {
    ...EMPTY,
    nome: String(item.nome ?? product.nome ?? ''),
    marca: String(item.marca ?? product.marca ?? ''),
    modelo: String(item.modelo ?? product.modelo ?? ''),
    descricao: String(item.descricao ?? product.descricao ?? ''),
    mpn: String(item.mpn ?? product.mpn ?? ''),
    gtin: String(item.gtin ?? product.gtin ?? ''),
    imagemUrl: String(item.imagemUrl ?? product.imagemUrl ?? ''),
    imagemHoverUrl: String(item.imagemHoverUrl ?? product.imagemHoverUrl ?? ''),
    publicado: Boolean(item.publicado ?? product.publicado),
    ativo: typeof item.ativo === 'boolean' ? item.ativo : (typeof product.ativo === 'boolean' ? product.ativo : true),
    especificacao: JSON.stringify(specification, null, 2),
  }
}

function previewFields(preview) {
  const payload = preview?.cadastroSugerido?.payload || preview?.acaoFrontend?.payloadInicial || {}
  const source = Object.keys(payload).length ? payload : (preview?.normalizacao?.camposNormalizados || {})
  const flat = {
    nome: source.nome,
    marca: source.marca,
    modelo: source.modelo,
    processador: source.especificacao?.processadorNome ?? source.processadorNome,
    memoriaGb: source.especificacao?.ramInstaladaGb ?? source.ramInstaladaGb,
    armazenamentoGb: source.especificacao?.armazenamentoGb ?? source.armazenamentoGb,
    telaPolegadas: source.especificacao?.tamanhoTelaPolegadas ?? source.tamanhoTelaPolegadas,
  }
  return Object.entries(flat).filter(([, value]) => value !== null && value !== undefined && value !== '')
}

function notebookSpecFromAi(source = {}) {
  const rawSpec = source.especificacao && typeof source.especificacao === 'object'
    ? source.especificacao
    : source
  const direct = sanitizeNotebookSpec(rawSpec)
  const aliases = {
    processadorNome: rawSpec.processadorNome ?? rawSpec.processador ?? rawSpec.cpuNome ?? rawSpec.cpu,
    gpuNome: rawSpec.gpuNome ?? rawSpec.gpu ?? rawSpec.placaVideo,
    ramInstaladaGb: rawSpec.ramInstaladaGb ?? rawSpec.memoriaRamGb ?? rawSpec.ramGb,
    armazenamentoGb: rawSpec.armazenamentoGb ?? rawSpec.ssdGb,
    tamanhoTelaPolegadas: rawSpec.tamanhoTelaPolegadas ?? rawSpec.telaPolegadas,
    sistemaOperacional: rawSpec.sistemaOperacional ?? rawSpec.sistema,
    pesoKg: rawSpec.pesoKg,
  }
  return {
    ...direct,
    ...Object.fromEntries(Object.entries(aliases).filter(([, value]) => value !== undefined && value !== null && value !== '')),
  }
}

function toIsoDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function normalizeSearch(value) {
  return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function AdminNotebookForm() {
  const { id } = useParams()
  const editing = Boolean(id && id !== 'novo')
  const navigate = useNavigate()
  const toast = useAdminToast()
  const { user } = useAuth()
  const canImportLink = String(user?.papel || '').toUpperCase() === 'ADMIN'
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(editing)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [transferredPreview] = useState(() => editing ? null : consumeAiImportPreview('NOTEBOOK'))
  const [transferredApplied, setTransferredApplied] = useState(false)
  const [partners, setPartners] = useState([])
  const [offerRows, setOfferRows] = useState([])
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    let active = true
    const requests = [
      adminService.offers.partners().catch(() => []),
      editing ? adminService.notebooks.get(id) : Promise.resolve(null),
    ]
    Promise.all(requests)
      .then(([partnerItems, item]) => {
        if (!active) return
        setPartners(Array.isArray(partnerItems) ? partnerItems : [])
        if (item) {
          setForm(normalizedNotebookForm(item))
          setOfferRows(Array.isArray(item?.produto?.ofertas) ? item.produto.ofertas.map(normalizeOfferRow) : [])
        }
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [editing, id])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const specification = useMemo(() => parseNotebookSpec(form.especificacao), [form.especificacao])

  function updateSpec(key, value, type = 'text') {
    setForm((current) => {
      let next = parseNotebookSpec(current.especificacao)
      if (value === '' || value === null || value === undefined) {
        next = { ...next }
        delete next[key]
      } else if (type === 'number') {
        const number = Number(value)
        if (Number.isFinite(number)) next = { ...next, [key]: number }
      } else if (type === 'boolean') {
        next = { ...next, [key]: Boolean(value) }
      } else {
        next = { ...next, [key]: value }
      }
      return { ...current, especificacao: JSON.stringify(next, null, 2) }
    })
  }

  function updateOffer(index, key, value) {
    setOfferRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  function addOffer(prefill = {}) {
    setOfferRows((current) => [...current, { ...emptyOfferRow(), ...prefill }])
  }

  function removeOffer(index) {
    setOfferRows((current) => {
      const row = current[index]
      if (!row) return current
      if (row.id) return current.map((item, rowIndex) => rowIndex === index ? { ...item, _removed: true } : item)
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  function applyImportPreview(preview = importPreview, notify = true) {
    const payload = preview?.cadastroSugerido?.payload || preview?.acaoFrontend?.payloadInicial || {}
    const normalized = preview?.normalizacao?.camposNormalizados || {}
    const source = Object.keys(payload).length ? payload : normalized
    if (!Object.keys(source).length) {
      toast.show('A IA não retornou campos para preencher. Faça o cadastro manualmente.', 'alerta')
      return
    }

    const image = source.imagemUrl || normalized.imagemUrl || preview?.coleta?.meta?.['og:image'] || preview?.coleta?.meta?.imagem || ''
    const aiSpec = notebookSpecFromAi(source)

    setForm((current) => {
      const currentSpec = parseNotebookSpec(current.especificacao)
      return {
        ...current,
        nome: source.nome || current.nome,
        marca: source.marca || current.marca,
        modelo: source.modelo || current.modelo,
        descricao: source.descricao || current.descricao,
        mpn: source.mpn || current.mpn,
        gtin: source.gtin || source.ean || current.gtin,
        imagemUrl: image || current.imagemUrl,
        imagemHoverUrl: source.imagemHoverUrl || current.imagemHoverUrl,
        especificacao: JSON.stringify({ ...currentSpec, ...aiSpec }, null, 2),
      }
    })
    setImageError(false)

    const suggestedOffer = preview?.ofertaSugerida || {}
    const url = cleanText(suggestedOffer.urlOriginal || importUrl || preview?.urlFinal || preview?.urlOrigem)
    if (url && !offerRows.some((row) => !row._removed && cleanText(row.urlOriginal))) {
      const siteName = cleanText(preview?.coleta?.meta?.siteName || preview?.coleta?.meta?.['og:site_name'])
      const matchedPartner = suggestedOffer.parceiroId
        ? partners.find((partner) => Number(partner.id) === Number(suggestedOffer.parceiroId))
        : siteName
          ? partners.find((partner) => normalizeSearch(partner.nome).includes(normalizeSearch(siteName)) || normalizeSearch(siteName).includes(normalizeSearch(partner.nome)))
          : null
      addOffer({
        urlOriginal: url,
        parceiroId: suggestedOffer.parceiroId ? String(suggestedOffer.parceiroId) : (matchedPartner?.id ? String(matchedPartner.id) : ''),
        preco: suggestedOffer.preco ?? '',
        precoAnterior: suggestedOffer.precoAnterior ?? '',
      })
    }

    if (notify) toast.show('Dados da IA aplicados ao Notebook. Revise tudo antes de salvar.')
  }

  useEffect(() => {
    if (editing || loading || transferredApplied || !transferredPreview) return
    setImportPreview(transferredPreview)
    setImportUrl(cleanText(transferredPreview?.urlOrigem || transferredPreview?.urlFinal))
    applyImportPreview(transferredPreview, false)
    setTransferredApplied(true)
    toast.show('Prévia do Produto IA transferida para o cadastro de Notebook. Revise antes de salvar.')
  }, [editing, loading, transferredApplied, transferredPreview])

  async function importData() {
    const url = cleanText(importUrl)
    if (!canImportLink || !url) return
    setImporting(true)
    setImportPreview(null)
    try {
      const result = await adminService.ai.importLink(url, 'NOTEBOOK')
      setImportPreview(result)
      if (!result?.cadastroSugerido?.payload && !result?.normalizacao) {
        toast.show(result?.avisoIa || 'A página foi coletada, mas não foi possível montar uma prévia de Notebook.', 'alerta')
        return
      }
      applyImportPreview(result, false)
      toast.show('A IA do backend preencheu o Notebook. Revise os campos antes de salvar.')
    } catch (err) {
      toast.show(err?.message || 'Não foi possível analisar o link com a IA.', 'erro')
    } finally {
      setImporting(false)
    }
  }

  function buildOfferEntry(row, productId) {
    const parceiroId = Number(row.parceiroId)
    const preco = Number(row.preco)
    const precoAnterior = cleanText(row.precoAnterior) ? Number(row.precoAnterior) : undefined
    const frete = cleanText(row.frete) ? Number(row.frete) : undefined
    const urlOriginal = cleanText(row.urlOriginal)

    if (!Number.isInteger(parceiroId) || parceiroId < 1) throw new Error('Selecione o parceiro de todas as ofertas.')
    if (!Number.isFinite(preco) || preco <= 0) throw new Error('Informe um preço válido em todas as ofertas.')
    if (!urlOriginal) throw new Error('Informe a URL original em todas as ofertas.')
    if (precoAnterior !== undefined && (!Number.isFinite(precoAnterior) || precoAnterior <= 0)) throw new Error('Revise o preço anterior das ofertas.')
    if (frete !== undefined && (!Number.isFinite(frete) || frete < 0)) throw new Error('Revise o frete das ofertas.')

    const common = {
      preco,
      precoAnterior: precoAnterior ?? null,
      frete: frete ?? null,
      urlOriginal,
      urlAfiliada: cleanText(row.urlAfiliada) || null,
      vendedorNome: cleanText(row.vendedorNome) || null,
      vendedorIdentificador: cleanText(row.vendedorIdentificador) || null,
      validoAte: toIsoDate(row.validoAte) ?? null,
    }
    return row.id
      ? { id: row.id, update: common }
      : { create: { produtoId: Number(productId), parceiroId, ...common } }
  }

  async function saveOffers(productId) {
    for (const row of offerRows) {
      if (row._removed) {
        if (row.id) await adminService.offers.setStatus(row.id, 'INDISPONIVEL')
        continue
      }
      const entry = buildOfferEntry(row, productId)
      if (entry.id) {
        await adminService.offers.update(entry.id, entry.update)
        if (String(row.status || 'ATIVA').toUpperCase() !== 'ATIVA') await adminService.offers.setStatus(entry.id, 'ATIVA')
      } else {
        await adminService.offers.create(entry.create)
      }
    }
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let spec
      try { spec = sanitizeNotebookSpec(JSON.parse(form.especificacao || '{}')) } catch { throw new Error('O JSON de especificação está inválido.') }

      const body = {
        nome: cleanText(form.nome),
        marca: cleanText(form.marca),
        modelo: cleanText(form.modelo),
        descricao: optionalString(form.descricao, editing),
        mpn: optionalString(form.mpn, editing),
        gtin: optionalString(form.gtin, editing),
        imagemUrl: optionalString(form.imagemUrl, editing),
        imagemHoverUrl: optionalString(form.imagemHoverUrl, editing),
        publicado: Boolean(form.publicado),
        ativo: Boolean(form.ativo),
        especificacao: spec,
      }

      // Valida as ofertas antes de salvar o Notebook para reduzir salvamento parcial por erro de formulário.
      for (const row of offerRows) if (!row._removed) buildOfferEntry(row, 1)

      const saved = editing
        ? await adminService.notebooks.update(id, body)
        : await adminService.notebooks.create(body)

      const produtoId = Number(saved?.produtoId ?? saved?.produto?.id)
      const warnings = []
      if (offerRows.length) {
        if (!Number.isInteger(produtoId) || produtoId < 1) warnings.push('O backend não retornou produtoId para vincular as ofertas.')
        else {
          try { await saveOffers(produtoId) } catch (offerError) { warnings.push(`Ofertas: ${offerError?.message || 'não foi possível salvar.'}`) }
        }
      }

      if (warnings.length) toast.show(`Notebook salvo. ${warnings.join(' ')}`, 'alerta')
      else toast.show(offerRows.some((row) => !row._removed) ? 'Notebook e ofertas salvos.' : 'Notebook salvo.')
      navigate(`/admin/notebooks/${saved?.id || id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading />
  if (error && editing && !form.nome) return <AdminError error={error} />

  return <>
    <AdminPageHeader title={editing ? 'Editar notebook' : 'Novo notebook'} description="Cadastro especializado de Notebook com IA, ficha técnica e múltiplas ofertas.">
      <AdminBack to="/admin/notebooks">Cancelar</AdminBack>
    </AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        {canImportLink && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading">
            <div><h2>Preencher Notebook com IA</h2><p>Cole o link. O backend recebe categoriaEsperada=NOTEBOOK e não transforma o anúncio em Processador por causa da CPU citada.</p></div>
            <span className="admin-import-badge">Somente ADMIN</span>
          </div>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>URL do notebook</label><input className="admin-input" type="url" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://loja.com/notebook/asus-vivobook-15" /></div>
            <div className="admin-field full"><button className="btn btn-primario" type="button" disabled={importing || !cleanText(importUrl)} onClick={importData}>{importing ? 'Analisando com IA...' : 'Analisar e preencher Notebook'}</button></div>
          </div>
          {importPreview && <div className="admin-import-preview">
            <div className="admin-import-preview-head"><div><span className="admin-import-preview-status">{importPreview.status || 'PRÉVIA'}</span><h3>Prévia para revisão</h3></div><strong>{importPreview.destinoSugerido || 'NOTEBOOK'}</strong></div>
            {importPreview.avisoIa && <p className="admin-inline-warning">{importPreview.avisoIa}</p>}
            {importPreview.normalizacao?.textoExplicativo && <p className="admin-import-preview-copy">{importPreview.normalizacao.textoExplicativo}</p>}
            <div className="admin-import-preview-fields">{previewFields(importPreview).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div>
            <div className="admin-import-preview-actions">
              <button className="btn btn-secundario" type="button" onClick={() => { setImportPreview(null); setImportUrl('') }}>Descartar prévia</button>
              <button className="btn btn-primario" type="button" onClick={() => applyImportPreview()}>Aplicar prévia</button>
            </div>
          </div>}
        </section>}

        <section className="admin-form-section">
          <h2>Identificação</h2>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(event) => update('nome', event.target.value)} placeholder="ASUS Vivobook 15" /></div>
            <div className="admin-field"><label>Marca</label><input className="admin-input" required value={form.marca} onChange={(event) => update('marca', event.target.value)} placeholder="ASUS" /></div>
            <div className="admin-field"><label>Modelo</label><input className="admin-input" required value={form.modelo} onChange={(event) => update('modelo', event.target.value)} placeholder="X1504VA" /></div>
            <div className="admin-field"><label>MPN</label><input className="admin-input" value={form.mpn} onChange={(event) => update('mpn', event.target.value)} placeholder="X1504VA-NJ1745W" /></div>
            <div className="admin-field"><label>GTIN</label><input className="admin-input" value={form.gtin} onChange={(event) => update('gtin', event.target.value.replace(/\D/g, ''))} placeholder="7891234567890" /></div>
            <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(event) => update('descricao', event.target.value)} placeholder="Notebook de 15,6 polegadas para trabalho, estudos e uso diário." /></div>
            <div className="admin-field full"><label>Imagem principal</label><input className="admin-input" type="url" value={form.imagemUrl} onChange={(event) => { update('imagemUrl', event.target.value); setImageError(false) }} placeholder="https://cdn.exemplo.com/notebook-frente.jpg" /></div>
            <div className="admin-field full"><label>Imagem secundária/hover</label><input className="admin-input" type="url" value={form.imagemHoverUrl} onChange={(event) => update('imagemHoverUrl', event.target.value)} placeholder="https://cdn.exemplo.com/notebook-aberto.jpg" /></div>
            {form.imagemUrl && <div className="admin-field full"><div className="admin-mounted-image-preview">{imageError ? <span>Não foi possível carregar essa URL de imagem.</span> : <img src={form.imagemUrl} alt="Prévia do Notebook" onError={() => setImageError(true)} />}</div></div>}
          </div>
        </section>

        <section className="admin-form-section">
          <div className="admin-section-heading"><div><h2>Especificações principais</h2><p>Campos visíveis usados diretamente pela ficha pública do Notebook.</p></div><span className="admin-import-badge">TÉCNICO</span></div>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>CPU / Processador</label><input className="admin-input" value={specification.processadorNome ?? ''} onChange={(event) => updateSpec('processadorNome', event.target.value)} placeholder="Intel Core i5-1235U" /></div>
            <div className="admin-field"><label>Memória RAM (GB)</label><input className="admin-input" type="number" min="1" step="1" value={specification.ramInstaladaGb ?? ''} onChange={(event) => updateSpec('ramInstaladaGb', event.target.value, 'number')} placeholder="16" /></div>
            <div className="admin-field"><label>Tipo de memória</label><select className="admin-select" value={specification.tipoMemoria ?? ''} onChange={(event) => updateSpec('tipoMemoria', event.target.value)}><option value="">Selecione</option><option value="DDR3">DDR3</option><option value="DDR4">DDR4</option><option value="DDR5">DDR5</option></select></div>
            <div className="admin-field"><label>Memória máxima (GB)</label><input className="admin-input" type="number" min="1" step="1" value={specification.ramMaximaGb ?? ''} onChange={(event) => updateSpec('ramMaximaGb', event.target.value, 'number')} placeholder="32" /><small className="admin-help">Opcional. Deixe vazio se a capacidade máxima não for conhecida.</small></div>
            <div className="admin-field"><label>Armazenamento (GB)</label><input className="admin-input" type="number" min="1" step="1" value={specification.armazenamentoGb ?? ''} onChange={(event) => updateSpec('armazenamentoGb', event.target.value, 'number')} placeholder="512" /></div>
            <div className="admin-field"><label>Tipo de armazenamento</label><input className="admin-input" value={specification.tipoArmazenamento ?? ''} onChange={(event) => updateSpec('tipoArmazenamento', event.target.value)} placeholder="SSD NVMe M.2" /></div>
            <div className="admin-field"><label>Tela (polegadas)</label><input className="admin-input" type="number" min="1" step="0.1" value={specification.tamanhoTelaPolegadas ?? ''} onChange={(event) => updateSpec('tamanhoTelaPolegadas', event.target.value, 'number')} placeholder="15.6" /></div>
            <div className="admin-field"><label>Taxa de atualização (Hz)</label><input className="admin-input" type="number" min="1" step="1" value={specification.taxaAtualizacaoHz ?? ''} onChange={(event) => updateSpec('taxaAtualizacaoHz', event.target.value, 'number')} placeholder="60" /></div>
            <div className="admin-field"><label>Resolução — largura</label><input className="admin-input" type="number" min="1" step="1" value={specification.resolucaoLargura ?? ''} onChange={(event) => updateSpec('resolucaoLargura', event.target.value, 'number')} placeholder="1920" /></div>
            <div className="admin-field"><label>Resolução — altura</label><input className="admin-input" type="number" min="1" step="1" value={specification.resolucaoAltura ?? ''} onChange={(event) => updateSpec('resolucaoAltura', event.target.value, 'number')} placeholder="1080" /></div>
            <div className="admin-field full"><label>GPU</label><input className="admin-input" value={specification.gpuNome ?? ''} onChange={(event) => updateSpec('gpuNome', event.target.value)} placeholder="Intel Iris Xe / NVIDIA GeForce RTX 4050" /></div>
            <div className="admin-field"><label>Peso (kg)</label><input className="admin-input" type="number" min="0.1" step="0.01" value={specification.pesoKg ?? ''} onChange={(event) => updateSpec('pesoKg', event.target.value, 'number')} placeholder="1.65" /></div>
          </div>
          <details className="admin-mounted-advanced">
            <summary>Avançado: editar especificação completa em JSON</summary>
            <div className="admin-field"><textarea className="admin-textarea admin-code-area" value={form.especificacao} onChange={(event) => update('especificacao', event.target.value)} placeholder={'{\n  "processadorNome": "Intel Core i5-1235U",\n  "ramInstaladaGb": 16,\n  "armazenamentoGb": 512,\n  "tamanhoTelaPolegadas": 15.6\n}'} /><small className="admin-help">CPU, GPU, RAM, armazenamento, tela, bateria, mobilidade e conectividade.</small></div>
          </details>
        </section>

        <AdminMultiOfferEditor
          rows={offerRows}
          partners={partners}
          onChange={updateOffer}
          onAdd={() => addOffer()}
          onRemove={removeOffer}
          title="Ofertas do Notebook"
          description="Você pode cadastrar e editar várias ofertas para o mesmo Notebook. O preço pertence à Oferta, não à especificação técnica."
        />

        {error && <div className="admin-form-section"><p className="admin-form-error">{error.message}</p></div>}
        <footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : (offerRows.some((row) => !row._removed) ? 'Salvar Notebook e ofertas' : 'Salvar Notebook')}</button></footer>
      </div>
      <aside className="admin-sticky-side"><div className="admin-card"><header className="admin-card-header"><h2>Prévia</h2></header><div className="admin-card-body">
        <div className="admin-mounted-side-preview">{form.imagemUrl && !imageError ? <img src={form.imagemUrl} alt="" onError={() => setImageError(true)} /> : <div className="admin-empty">Sem imagem</div>}<div><small>{form.marca || 'Notebook'}</small><h3>{form.nome || 'Nome do Notebook'}</h3><strong>{specification.ramInstaladaGb ? `${specification.ramInstaladaGb} GB RAM` : 'Ficha técnica'}</strong></div></div>
        <hr className="admin-divider" />
        <label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(event) => update('publicado', event.target.checked)} /> Publicado</label><br /><br />
        <label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(event) => update('ativo', event.target.checked)} /> Ativo</label>
      </div></div></aside>
    </form>
  </>
}
