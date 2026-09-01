import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import AdminMultiOfferEditor from '../components/AdminMultiOfferEditor'
import { emptyOfferRow, normalizeOfferRow } from '../components/AdminMultiOfferEditor.utils'
import { consumeAiImportPreview } from '../utils/aiImportTransfer'
import { getAiOffer, getAiPayload } from '../utils/aiImportContract'

const EMPTY = {
  nome: '', marca: '', modelo: '', descricao: '', imagemUrl: '', imagemHoverUrl: '', categoria: '', finalidade: '', resolucaoRecomendada: '',
  publicado: false, ativo: true, componentes: '[]', configuracao3D: '{}',
}

const REQUIRED_PUBLISHED_CATEGORIES = ['PROCESSADOR', 'PLACA_MAE', 'MEMORIA_RAM', 'ARMAZENAMENTO', 'FONTE', 'GABINETE']

function cleanText(value) {
  return String(value ?? '').trim()
}

function optionalString(value, editing) {
  const clean = cleanText(value)
  return clean || (editing ? null : undefined)
}

function normalizeSearch(value) {
  return cleanText(value).toLocaleLowerCase('pt-BR')
}

function sanitizeComponents(value) {
  if (!Array.isArray(value)) throw new Error('Componentes deve ser uma lista JSON.')
  return value.map((item, index) => {
    const hardwareId = Number(item?.hardwareId ?? item?.hardware?.id)
    const categoria = String(item?.categoria ?? item?.hardware?.categoria ?? '').trim().toUpperCase()
    if (!Number.isInteger(hardwareId) || hardwareId < 1 || !categoria) {
      throw new Error(`Componente ${index + 1}: informe hardwareId válido e categoria.`)
    }
    const quantidade = Number(item?.quantidade)
    const ordem = Number(item?.ordem)
    const posicao = String(item?.posicao || '').trim()
    return {
      hardwareId,
      categoria,
      ...(Number.isInteger(quantidade) && quantidade >= 1 ? { quantidade } : { quantidade: 1 }),
      ...(posicao ? { posicao: posicao.slice(0, 100) } : {}),
      ...(Number.isInteger(ordem) && ordem >= 0 ? { ordem } : { ordem: index }),
    }
  })
}

function parseComponents(value) {
  try {
    return sanitizeComponents(JSON.parse(value || '[]'))
  } catch {
    return []
  }
}

function safeConfiguration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração 3D deve ser um objeto JSON.')
  return value
}

function normalizedMountedForm(item = {}) {
  let cleanComponents
  try { cleanComponents = sanitizeComponents(item.componentes || []) } catch { cleanComponents = [] }
  return {
    ...EMPTY,
    ...item,
    nome: String(item.nome ?? ''),
    marca: String(item.marca ?? ''),
    modelo: String(item.modelo ?? ''),
    descricao: String(item.descricao ?? ''),
    imagemUrl: String(item.imagemUrl ?? item.produto?.imagemUrl ?? ''),
    imagemHoverUrl: String(item.imagemHoverUrl ?? item.produto?.imagemHoverUrl ?? ''),
    categoria: String(item.categoria ?? ''),
    finalidade: String(item.finalidade ?? ''),
    resolucaoRecomendada: String(item.resolucaoRecomendada ?? ''),
    publicado: Boolean(item.publicado ?? item.produto?.publicado),
    ativo: typeof item.ativo === 'boolean' ? item.ativo : (typeof item.produto?.ativo === 'boolean' ? item.produto.ativo : true),
    componentes: JSON.stringify(cleanComponents, null, 2),
    configuracao3D: JSON.stringify(item.configuracao3D || {}, null, 2),
  }
}

function previewFields(preview) {
  return Object.entries(preview?.normalizacao?.camposNormalizados || {})
    .filter(([key, value]) => key !== 'evidencias' && value !== null && value !== '' && typeof value !== 'object')
    .slice(0, 12)
}

function validAiComponents(value) {
  if (!Array.isArray(value) || !value.length) return null
  try {
    return sanitizeComponents(value)
  } catch {
    return null
  }
}


function toIsoDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export default function AdminMountedForm() {
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
  const [transferredPreview] = useState(() => editing ? null : consumeAiImportPreview('PC_MONTADO'))
  const [transferredApplied, setTransferredApplied] = useState(false)
  const [aiComponentNotice, setAiComponentNotice] = useState('')
  const [hardwares, setHardwares] = useState([])
  const [partners, setPartners] = useState([])
  const [hardwareSearch, setHardwareSearch] = useState('')
  const [hardwareCategory, setHardwareCategory] = useState('TODOS')
  const [offerRows, setOfferRows] = useState([])
  const [hardwareLoadError, setHardwareLoadError] = useState('')
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    let active = true
    const requests = [
      adminService.hardwares.listForBuild().catch((err) => { setHardwareLoadError(err?.message || 'Não foi possível carregar o catálogo de Hardware.'); return [] }),
      adminService.offers.partners().catch(() => []),
      editing ? adminService.builds.get(id) : Promise.resolve(null),
    ]

    Promise.all(requests)
      .then(([hardwareItems, partnerItems, item]) => {
        if (!active) return
        const usableHardwares = Array.isArray(hardwareItems) ? hardwareItems.filter((hardware) => hardware?.ativo !== false) : []
        setHardwares(usableHardwares)
        if (usableHardwares.length) setHardwareLoadError('')
        setPartners(Array.isArray(partnerItems) ? partnerItems : [])
        if (item) {
          setForm(normalizedMountedForm(item))
          setOfferRows(Array.isArray(item?.produto?.ofertas) ? item.produto.ofertas.map(normalizeOfferRow) : [])
        }
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [editing, id])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
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

  const selectedComponents = useMemo(() => parseComponents(form.componentes), [form.componentes])
  const hardwareById = useMemo(() => new Map(hardwares.map((item) => [Number(item.id), item])), [hardwares])
  const hardwareResults = useMemo(() => {
    const term = normalizeSearch(hardwareSearch)
    return hardwares
      .filter((hardware) => hardwareCategory === 'TODOS' || String(hardware.categoria || '').toUpperCase() === hardwareCategory)
      .filter((hardware) => !term || normalizeSearch([
        hardware.nome,
        hardware.marca,
        hardware.modelo,
        hardware.categoria,
        hardware.id,
      ].join(' ')).includes(term))
      .slice(0, 24)
  }, [hardwareSearch, hardwareCategory, hardwares])

  const hardwareCategories = useMemo(() => [...new Set(hardwares.map((item) => String(item.categoria || '').toUpperCase()).filter(Boolean))].sort(), [hardwares])

  const missingPublishedCategories = useMemo(() => {
    const categories = new Set(selectedComponents.map((item) => item.categoria))
    return REQUIRED_PUBLISHED_CATEGORIES.filter((category) => !categories.has(category))
  }, [selectedComponents])

  function writeComponents(items) {
    const normalized = items.map((item, index) => ({ ...item, ordem: index }))
    update('componentes', JSON.stringify(normalized, null, 2))
  }

  function addHardware(hardware) {
    const hardwareId = Number(hardware?.id)
    const categoria = cleanText(hardware?.categoria).toUpperCase()
    if (!Number.isInteger(hardwareId) || hardwareId < 1 || !categoria) {
      toast.show('Este Hardware não possui ID/categoria válidos para a Build.', 'erro')
      return
    }

    const current = [...selectedComponents]
    const existingIndex = current.findIndex((item) => item.hardwareId === hardwareId)
    if (existingIndex >= 0) {
      current[existingIndex] = {
        ...current[existingIndex],
        quantidade: Math.max(1, Number(current[existingIndex].quantidade || 1)) + 1,
      }
    } else {
      current.push({ hardwareId, categoria, quantidade: 1, ordem: current.length })
    }
    writeComponents(current)
    setHardwareSearch('')
  }

  function changeComponent(index, key, value) {
    const current = [...selectedComponents]
    if (!current[index]) return
    if (key === 'quantidade') current[index] = { ...current[index], quantidade: Math.max(1, Number(value) || 1) }
    else if (key === 'posicao') {
      const posicao = cleanText(value)
      const next = { ...current[index] }
      if (posicao) next.posicao = value
      else delete next.posicao
      current[index] = next
    }
    writeComponents(current)
  }

  function removeComponent(index) {
    writeComponents(selectedComponents.filter((_, itemIndex) => itemIndex !== index))
  }

  function applyImportPreview(preview = importPreview, notify = true) {
    const source = getAiPayload(preview)
    if (!Object.keys(source).length) {
      toast.show('A IA não retornou campos para preencher. Faça o cadastro manualmente.', 'alerta')
      return
    }

    const image = source.imagemUrl ?? preview?.coleta?.meta?.['og:image'] ?? preview?.coleta?.meta?.imagem ?? ''
    const components = validAiComponents(source.componentes)
    const configuration = source.configuracao3D && typeof source.configuracao3D === 'object' && !Array.isArray(source.configuracao3D)
      ? source.configuracao3D
      : null
    const detected = preview?.cadastroSugerido?.componentesDetectados || preview?.acaoFrontend?.componentesDetectados || []

    setForm((current) => ({
      ...current,
      nome: source.nome ?? current.nome,
      marca: source.marca ?? current.marca,
      modelo: source.modelo ?? current.modelo,
      descricao: source.descricao ?? current.descricao,
      imagemUrl: image ?? current.imagemUrl,
      imagemHoverUrl: source.imagemHoverUrl ?? current.imagemHoverUrl,
      categoria: source.categoria ?? current.categoria,
      finalidade: source.finalidade ?? current.finalidade,
      resolucaoRecomendada: source.resolucaoRecomendada ?? source.resolucao ?? current.resolucaoRecomendada,
      componentes: components ? JSON.stringify(components, null, 2) : current.componentes,
      configuracao3D: configuration ? JSON.stringify(configuration, null, 2) : current.configuracao3D,
    }))
    setImageError(false)

    const suggestedOffer = getAiOffer(preview) || {}
    const originalUrl = cleanText(suggestedOffer.urlOriginal || importUrl || preview?.urlFinal || preview?.urlOrigem)
    if (originalUrl && !offerRows.some((row) => !row._removed && cleanText(row.urlOriginal))) {
      const storeName = cleanText(preview?.coleta?.meta?.siteName || preview?.coleta?.meta?.['og:site_name'])
      const matchedPartner = suggestedOffer.parceiroId
        ? partners.find((partner) => Number(partner.id) === Number(suggestedOffer.parceiroId))
        : storeName
          ? partners.find((partner) => normalizeSearch(partner.nome).includes(normalizeSearch(storeName)) || normalizeSearch(storeName).includes(normalizeSearch(partner.nome)))
          : null
      addOffer({
        urlOriginal: originalUrl,
        parceiroId: suggestedOffer.parceiroId ? String(suggestedOffer.parceiroId) : (matchedPartner?.id ? String(matchedPartner.id) : ''),
        preco: suggestedOffer.preco ?? '',
        precoAnterior: suggestedOffer.precoAnterior ?? '',
      })
    }

    if (components?.length) {
      setAiComponentNotice(`${components.length} componente(s) foram vinculados pela IA a Hardwares reais do catálogo. Confira os vínculos abaixo.`)
    } else if (Array.isArray(detected) && detected.length) {
      const linked = detected.filter((item) => Number(item?.hardwareId) > 0).length
      setAiComponentNotice(`A IA identificou ${detected.length} componente(s); ${linked} foram vinculados ao catálogo. Pesquise abaixo os que ainda faltam.`)
    } else {
      setAiComponentNotice('Dados gerais preenchidos. Pesquise e adicione os componentes reais da Build abaixo.')
    }

    if (notify) toast.show('Dados da IA do backend aplicados ao PC Montado. Revise tudo antes de salvar.')
  }

  useEffect(() => {
    if (editing || loading || transferredApplied || !transferredPreview) return
    setImportPreview(transferredPreview)
    setImportUrl(cleanText(transferredPreview?.urlOrigem || transferredPreview?.urlFinal))
    applyImportPreview(transferredPreview, false)
    setTransferredApplied(true)
    toast.show('Prévia do Produto IA transferida para o cadastro de PC Montado. Revise antes de salvar.')
  }, [editing, loading, transferredApplied, transferredPreview])

  async function importData() {
    const url = cleanText(importUrl)
    if (!canImportLink || !url) return
    setImporting(true)
    setImportPreview(null)
    setAiComponentNotice('')
    try {
      const result = await adminService.ai.importLink(url, 'PC_MONTADO')
      setImportPreview(result)
      if (!result?.cadastroSugerido?.payload && !result?.normalizacao) {
        toast.show(result?.avisoIa || 'A página foi coletada, mas não foi possível montar uma prévia de PC Montado.', 'alerta')
        return
      }
      applyImportPreview(result, false)
      toast.show('A IA do backend preencheu o PC Montado. Revise os componentes antes de salvar.')
    } catch (err) {
      toast.show(err?.message || 'Não foi possível analisar o link com a IA.', 'erro')
    } finally {
      setImporting(false)
    }
  }

  function buildOfferEntry(row, produtoId) {
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
      : { create: { produtoId: Number(produtoId), parceiroId, ...common } }
  }

  async function saveOffers(produtoId) {
    for (const row of offerRows) {
      if (row._removed) {
        if (row.id) await adminService.offers.setStatus(row.id, 'INDISPONIVEL')
        continue
      }
      const entry = buildOfferEntry(row, produtoId)
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
      let parsedComponents
      let parsedConfiguration
      try {
        parsedComponents = JSON.parse(form.componentes || '[]')
        parsedConfiguration = JSON.parse(form.configuracao3D || '{}')
      } catch {
        throw new Error('Revise os campos avançados de componentes/configuração 3D.')
      }

      const componentes = sanitizeComponents(parsedComponents)
      if (!componentes.length) throw new Error('Adicione pelo menos um componente usando a pesquisa de Hardware.')
      const configuracao3D = safeConfiguration(parsedConfiguration)

      if (form.publicado && missingPublishedCategories.length) {
        throw new Error(`Para publicar, ainda faltam componentes obrigatórios: ${missingPublishedCategories.join(', ')}.`)
      }

      const body = {
        nome: cleanText(form.nome),
        marca: optionalString(form.marca, editing),
        modelo: optionalString(form.modelo, editing),
        descricao: optionalString(form.descricao, editing),
        imagemUrl: optionalString(form.imagemUrl, editing),
        imagemHoverUrl: optionalString(form.imagemHoverUrl, editing),
        categoria: optionalString(form.categoria, editing),
        finalidade: optionalString(form.finalidade, editing),
        resolucaoRecomendada: optionalString(form.resolucaoRecomendada, editing),
        publicado: Boolean(form.publicado),
        ativo: Boolean(form.ativo),
        componentes,
        configuracao3D,
      }

      // Valida as ofertas antes de criar/atualizar a Build, reduzindo salvamento parcial por erro de formulário.
      for (const row of offerRows) if (!row._removed) buildOfferEntry(row, 1)

      const saved = editing
        ? await adminService.builds.update(id, body)
        : await adminService.builds.create(body)

      const postSaveWarnings = []
      const produtoId = Number(saved?.produtoId ?? saved?.produto?.id)
      if (offerRows.length) {
        if (!Number.isInteger(produtoId) || produtoId < 1) {
          postSaveWarnings.push('Ofertas: o backend não retornou produtoId para vincular as ofertas.')
        } else {
          try {
            await saveOffers(produtoId)
          } catch (offerErr) {
            postSaveWarnings.push(`Ofertas: ${offerErr?.message || 'não foi possível salvar.'}`)
          }
        }
      }

      if (postSaveWarnings.length) toast.show(`PC montado salvo. ${postSaveWarnings.join(' ')}`, 'alerta')
      else toast.show(offerRows.some((row) => !row._removed) ? 'PC montado e ofertas salvos.' : 'PC montado salvo.')
      navigate(`/admin/montados/${saved?.id || id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLoading />
  if (error && editing && !form.nome) return <AdminError error={error} />

  return <>
    <AdminPageHeader title={editing ? 'Editar PC montado' : 'Novo PC montado'} description="Cadastre o PC completo usando apenas Hardwares do catálogo. Produtos/ofertas individuais são opcionais e servem apenas para compras por peça.">
      <AdminBack to="/admin/montados">Cancelar</AdminBack>
    </AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        {canImportLink && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading">
            <div><h2>Cadastrar PC Montado com IA</h2><p>Cole o link de um computador montado. A IA preenche o que encontrar para revisão; nada é salvo automaticamente.</p></div>
            <span className="admin-import-badge">Somente ADMIN</span>
          </div>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>URL do PC montado</label><input className="admin-input" type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://loja.com/pc-gamer/ryzen-7-rtx-4070" /></div>
            <div className="admin-field full"><button className="btn btn-primario" type="button" disabled={importing || !cleanText(importUrl)} onClick={importData}>{importing ? 'Analisando com IA...' : 'Analisar e preencher PC Montado'}</button></div>
          </div>
          {importPreview && <div className="admin-import-preview">
            <div className="admin-import-preview-head"><div><span className="admin-import-preview-status">{importPreview.status || 'PRÉVIA'}</span><h3>Prévia para revisão</h3></div><strong>PC Montado</strong></div>
            {importPreview.avisoIa && <p className="admin-inline-warning">{importPreview.avisoIa}</p>}
            {importPreview.normalizacao?.textoExplicativo && <p className="admin-import-preview-copy">{importPreview.normalizacao.textoExplicativo}</p>}
            <div className="admin-import-preview-fields">{previewFields(importPreview).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}</div>
            {aiComponentNotice && <p className="admin-inline-warning">{aiComponentNotice}</p>}
            <div className="admin-import-preview-actions">
              <button className="btn btn-secundario" type="button" onClick={() => { setImportPreview(null); setImportUrl(''); setAiComponentNotice('') }}>Descartar prévia</button>
              <button className="btn btn-primario" type="button" onClick={() => applyImportPreview()}>Aplicar prévia ao PC Montado</button>
            </div>
            <small className="admin-help">A IA não inventa hardwareId. Peças sem vínculo real devem ser escolhidas na pesquisa de Hardware abaixo.</small>
          </div>}
        </section>}

        <section className="admin-form-section"><h2>Identificação</h2><div className="admin-form-grid">
          <div className="admin-field full"><label>Nome</label><input className="admin-input" required value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="PC Gamer Ryzen 7 + RTX 4070" /></div>
          <div className="admin-field"><label>Marca</label><input className="admin-input" value={form.marca} onChange={(e) => update('marca', e.target.value)} placeholder="CriaByte" /></div>
          <div className="admin-field"><label>Modelo</label><input className="admin-input" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} placeholder="CB-GAMER-4070" /></div>
          <div className="admin-field"><label>Categoria</label><input className="admin-input" value={form.categoria} onChange={(e) => update('categoria', e.target.value)} placeholder="PC Gamer" /></div>
          <div className="admin-field"><label>Finalidade</label><input className="admin-input" value={form.finalidade} onChange={(e) => update('finalidade', e.target.value)} placeholder="Jogos e criação de conteúdo" /></div>
          <div className="admin-field"><label>Resolução recomendada</label><input className="admin-input" value={form.resolucaoRecomendada} onChange={(e) => update('resolucaoRecomendada', e.target.value)} placeholder="1440p" /></div>
          <div className="admin-field full"><label>Descrição</label><textarea className="admin-textarea" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} placeholder="PC montado para jogos em 1440p com foco em alto desempenho." /></div>
          <div className="admin-field full"><label>Imagem principal</label><input className="admin-input" type="url" value={form.imagemUrl} onChange={(e) => { update('imagemUrl', e.target.value); setImageError(false) }} placeholder="https://cdn.exemplo.com/pc-gamer-frente.jpg" /><small className="admin-help">Use uma URL HTTPS pública da imagem.</small></div>
          <div className="admin-field full"><label>Imagem secundária/hover</label><input className="admin-input" type="url" value={form.imagemHoverUrl} onChange={(e) => update('imagemHoverUrl', e.target.value)} placeholder="https://cdn.exemplo.com/pc-gamer-lateral.jpg" /></div>
          {form.imagemUrl && <div className="admin-field full"><div className="admin-mounted-image-preview">{imageError ? <span>Não foi possível carregar essa URL de imagem.</span> : <img src={form.imagemUrl} alt="Prévia do PC montado" onError={() => setImageError(true)} />}</div></div>}
        </div></section>

        <section className="admin-form-section">
          <div className="admin-section-heading"><div><h2>Componentes do PC</h2><p>Use os Hardwares reais do catálogo. Não é necessário cadastrar cada peça em Produtos nem informar preço para montar o PC completo.</p></div><strong>{selectedComponents.length} item(ns)</strong></div>
          {hardwareLoadError && <p className="admin-inline-warning">{hardwareLoadError}</p>}
          <div className="admin-form-grid admin-mounted-hardware-toolbar">
            <div className="admin-field"><label>Categoria</label><select className="admin-select" value={hardwareCategory} onChange={(event) => setHardwareCategory(event.target.value)}><option value="TODOS">Todas</option>{hardwareCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></div>
            <div className="admin-field"><label>Pesquisar Hardware</label><input className="admin-input" type="search" value={hardwareSearch} onChange={(event) => setHardwareSearch(event.target.value)} placeholder="Ryzen 7, RTX 4070, B650, DDR5..." autoComplete="off" /></div>
          </div>
          <div className="admin-mounted-catalog-status"><span>{hardwares.length} Hardware(s) carregado(s)</span><span>{hardwareResults.length} resultado(s) nesta visualização</span></div>
          <div className="admin-mounted-hardware-results" role="listbox">
            {hardwareResults.length ? hardwareResults.map((hardware) => <button key={hardware.id} type="button" className="admin-mounted-hardware-result" onClick={() => addHardware(hardware)}>
              <span><strong>{hardware.nome || `Hardware #${hardware.id}`}</strong><small>{[hardware.marca, hardware.modelo].filter(Boolean).join(' · ') || `ID ${hardware.id}`}</small></span>
              <em>{hardware.categoria || 'HARDWARE'}</em>
            </button>) : <div className="admin-mounted-hardware-empty">Nenhum Hardware encontrado. Tente outra categoria ou termo.</div>}
          </div>

          {selectedComponents.length ? <div className="admin-mounted-components">
            {selectedComponents.map((component, index) => {
              const hardware = hardwareById.get(Number(component.hardwareId))
              return <article className="admin-mounted-component" key={`${component.hardwareId}-${index}`}>
                <div className="admin-mounted-component-main"><strong>{hardware?.nome || `Hardware #${component.hardwareId}`}</strong><small>{component.categoria} · ID {component.hardwareId}</small></div>
                <label><span>Qtd.</span><input className="admin-input" type="number" min="1" step="1" value={component.quantidade || 1} onChange={(e) => changeComponent(index, 'quantidade', e.target.value)} /></label>
                <label><span>Posição</span><input className="admin-input" value={component.posicao || ''} onChange={(e) => changeComponent(index, 'posicao', e.target.value)} placeholder="Opcional" /></label>
                <button className="admin-action-button admin-action-button--danger" type="button" onClick={() => removeComponent(index)}>Remover</button>
              </article>
            })}
          </div> : <p className="admin-mounted-components-empty">Nenhum componente adicionado. Pesquise uma peça acima e clique para adicionar.</p>}

          {form.publicado && missingPublishedCategories.length > 0 && <p className="admin-inline-warning">Para publicar ainda faltam: {missingPublishedCategories.join(', ')}.</p>}

          <details className="admin-mounted-advanced">
            <summary>Avançado: editar componentes em JSON</summary>
            <div className="admin-field"><textarea className="admin-textarea admin-code-area" value={form.componentes} onChange={(e) => update('componentes', e.target.value)} placeholder={'[\n  { "hardwareId": 1, "categoria": "PROCESSADOR", "quantidade": 1 }\n]'} /><small className="admin-help">Use apenas se precisar fazer ajuste manual avançado.</small></div>
          </details>
        </section>

        <AdminMultiOfferEditor
          rows={offerRows}
          partners={partners}
          onChange={updateOffer}
          onAdd={() => addOffer()}
          onRemove={removeOffer}
          title="Ofertas do PC Montado"
          description="Opcional: cadastre o preço e o link do PC completo vendido pelo parceiro. As ofertas individuais das peças são tratadas separadamente."
        />

        <section className="admin-form-section"><h2>Configuração 3D</h2><textarea className="admin-textarea admin-code-area" value={form.configuracao3D} onChange={(e) => update('configuracao3D', e.target.value)} placeholder={'{\n  "camera": {},\n  "pecas": []\n}'} /></section>
        {error && <section className="admin-form-section"><p className="admin-form-error">{error.message}</p></section>}
        <footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : (offerRows.some((row) => !row._removed) ? 'Salvar PC e ofertas' : 'Salvar PC montado')}</button></footer>
      </div>
      <aside className="admin-sticky-side"><div className="admin-card"><header className="admin-card-header"><h2>Prévia</h2></header><div className="admin-card-body">
        <div className="admin-mounted-side-preview">{form.imagemUrl && !imageError ? <img src={form.imagemUrl} alt="" onError={() => setImageError(true)} /> : <div className="admin-empty">Sem imagem</div>}<div><small>{form.categoria || 'PC Montado'}</small><h3>{form.nome || 'Nome do PC'}</h3><strong>{offerRows.filter((row) => !row._removed).length ? `${offerRows.filter((row) => !row._removed).length} oferta(s)` : `${selectedComponents.length} componente(s)`}</strong></div></div>
        <hr className="admin-divider" />
        <label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(e) => update('publicado', e.target.checked)} /> Publicado</label><br /><br />
        <label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label>
      </div></div></aside>
    </form>
  </>
}
