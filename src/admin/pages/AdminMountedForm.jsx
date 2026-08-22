import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const EMPTY = {
  nome: '', marca: '', modelo: '', descricao: '', imagemUrl: '', imagemHoverUrl: '', categoria: '', finalidade: '', resolucaoRecomendada: '',
  publicado: false, ativo: true, componentes: '[]', configuracao3D: '{}',
}

const EMPTY_OFFER = {
  parceiroId: '', preco: '', precoAnterior: '', frete: '', validoAte: '', vendedorNome: '', vendedorIdentificador: '', urlOriginal: '', urlAfiliada: '',
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

function formatMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Preço não informado'
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  const [aiComponentNotice, setAiComponentNotice] = useState('')
  const [hardwares, setHardwares] = useState([])
  const [partners, setPartners] = useState([])
  const [hardwareSearch, setHardwareSearch] = useState('')
  const [includeOffer, setIncludeOffer] = useState(false)
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    let active = true
    const requests = [
      adminService.hardwares.list().catch(() => []),
      adminService.offers.partners().catch(() => []),
      editing ? adminService.builds.get(id) : Promise.resolve(null),
    ]

    Promise.all(requests)
      .then(([hardwareItems, partnerItems, item]) => {
        if (!active) return
        setHardwares(Array.isArray(hardwareItems) ? hardwareItems : [])
        setPartners(Array.isArray(partnerItems) ? partnerItems : [])
        if (item) setForm(normalizedMountedForm(item))
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [editing, id])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const updateOffer = (key, value) => setOfferForm((current) => ({ ...current, [key]: value }))

  const selectedComponents = useMemo(() => parseComponents(form.componentes), [form.componentes])
  const hardwareById = useMemo(() => new Map(hardwares.map((item) => [Number(item.id), item])), [hardwares])
  const hardwareResults = useMemo(() => {
    const term = normalizeSearch(hardwareSearch)
    if (term.length < 2) return []
    return hardwares
      .filter((hardware) => normalizeSearch([
        hardware.nome,
        hardware.marca,
        hardware.modelo,
        hardware.categoria,
        hardware.id,
      ].join(' ')).includes(term))
      .slice(0, 12)
  }, [hardwareSearch, hardwares])

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
    const source = preview?.normalizacao?.camposNormalizados || {}
    if (!Object.keys(source).length) {
      toast.show('A IA não retornou campos para preencher. Faça o cadastro manualmente.', 'alerta')
      return
    }

    const image = source.imagemUrl || preview?.coleta?.meta?.imagem || preview?.coleta?.meta?.ogImage || ''
    const components = validAiComponents(source.componentes)
    const configuration = source.configuracao3D && typeof source.configuracao3D === 'object' && !Array.isArray(source.configuracao3D)
      ? source.configuracao3D
      : null

    setForm((current) => ({
      ...current,
      nome: source.nome || current.nome,
      marca: source.marca || current.marca,
      modelo: source.modelo || current.modelo,
      descricao: source.descricao || current.descricao,
      imagemUrl: image || current.imagemUrl,
      imagemHoverUrl: source.imagemHoverUrl || current.imagemHoverUrl,
      categoria: source.categoria || current.categoria,
      finalidade: source.finalidade || current.finalidade,
      resolucaoRecomendada: source.resolucaoRecomendada || source.resolucao || current.resolucaoRecomendada,
      componentes: components ? JSON.stringify(components, null, 2) : current.componentes,
      configuracao3D: configuration ? JSON.stringify(configuration, null, 2) : current.configuracao3D,
    }))
    setImageError(false)

    const price = source.preco ?? source.precoAtual ?? source.melhorPreco
    const originalUrl = source.urlOriginal || importUrl
    const affiliateUrl = source.urlAfiliada || source.urlAfiliado
    const storeName = cleanText(source.parceiro || source.loja || preview?.coleta?.meta?.siteName)
    const matchedPartner = storeName
      ? partners.find((partner) => normalizeSearch(partner.nome).includes(normalizeSearch(storeName)) || normalizeSearch(storeName).includes(normalizeSearch(partner.nome)))
      : null

    if (price || originalUrl || affiliateUrl) {
      setIncludeOffer(true)
      setOfferForm((current) => ({
        ...current,
        parceiroId: matchedPartner?.id ? String(matchedPartner.id) : current.parceiroId,
        preco: price ?? current.preco,
        urlOriginal: originalUrl || current.urlOriginal,
        urlAfiliada: affiliateUrl || current.urlAfiliada,
      }))
    }

    if (Array.isArray(source.componentes) && source.componentes.length && !components) {
      setAiComponentNotice('A IA identificou componentes, mas eles não possuem hardwareId válido. Use a pesquisa abaixo para vincular cada peça ao Hardware existente.')
    } else if (components) {
      setAiComponentNotice('Os componentes retornados pela IA possuem hardwareId e foram aplicados. Confira cada vínculo antes de salvar.')
    } else {
      setAiComponentNotice('Dados gerais preenchidos. Agora pesquise e adicione os componentes reais da Build.')
    }

    if (notify) toast.show('Dados da IA aplicados ao PC Montado. Revise tudo antes de salvar.')
  }

  async function importData() {
    const url = cleanText(importUrl)
    if (!canImportLink || !url) return
    setImporting(true)
    setImportPreview(null)
    setAiComponentNotice('')
    try {
      const result = await adminService.ai.importLink(url)
      setImportPreview(result)
      if (result?.iaDisponivel === false) {
        toast.show(result?.avisoIa || 'A página foi coletada, mas a IA não conseguiu normalizar os dados.', 'alerta')
        return
      }
      applyImportPreview(result, false)
      toast.show('Dados encontrados pela IA foram preenchidos no PC Montado. Revise antes de salvar.')
    } catch (err) {
      toast.show(err?.message || 'Não foi possível analisar o link com a IA.', 'erro')
    } finally {
      setImporting(false)
    }
  }

  function makeOfferBody(produtoId) {
    const parceiroId = Number(offerForm.parceiroId)
    const preco = Number(offerForm.preco)
    const precoAnterior = cleanText(offerForm.precoAnterior) ? Number(offerForm.precoAnterior) : undefined
    const frete = cleanText(offerForm.frete) ? Number(offerForm.frete) : undefined
    const urlOriginal = cleanText(offerForm.urlOriginal)

    if (!Number.isInteger(parceiroId) || parceiroId < 1) throw new Error('Selecione o parceiro da oferta.')
    if (!Number.isFinite(preco) || preco <= 0) throw new Error('Informe um preço válido para a oferta do PC Montado.')
    if (precoAnterior !== undefined && (!Number.isFinite(precoAnterior) || precoAnterior <= 0)) throw new Error('Preço anterior da oferta é inválido.')
    if (frete !== undefined && (!Number.isFinite(frete) || frete < 0)) throw new Error('Frete da oferta é inválido.')
    if (!urlOriginal) throw new Error('Informe a URL original da oferta.')

    return {
      produtoId: Number(produtoId),
      parceiroId,
      preco,
      ...(precoAnterior !== undefined ? { precoAnterior } : {}),
      ...(frete !== undefined ? { frete } : {}),
      urlOriginal,
      ...(cleanText(offerForm.urlAfiliada) ? { urlAfiliada: cleanText(offerForm.urlAfiliada) } : {}),
      ...(cleanText(offerForm.vendedorNome) ? { vendedorNome: cleanText(offerForm.vendedorNome) } : {}),
      ...(cleanText(offerForm.vendedorIdentificador) ? { vendedorIdentificador: cleanText(offerForm.vendedorIdentificador) } : {}),
      ...(toIsoDate(offerForm.validoAte) ? { validoAte: toIsoDate(offerForm.validoAte) } : {}),
    }
  }

  async function ensureProductImages(saved) {
    const produtoId = Number(saved?.produtoId ?? saved?.produto?.id)
    if (!Number.isInteger(produtoId) || produtoId < 1) return null

    const desiredImage = cleanText(form.imagemUrl)
    const desiredHover = cleanText(form.imagemHoverUrl)
    const savedImage = cleanText(saved?.imagemUrl ?? saved?.produto?.imagemUrl)
    const savedHover = cleanText(saved?.imagemHoverUrl ?? saved?.produto?.imagemHoverUrl)

    if (desiredImage === savedImage && desiredHover === savedHover) return null
    if (!desiredImage && !desiredHover) return null

    await adminService.products.update(produtoId, {
      imagemUrl: desiredImage || null,
      imagemHoverUrl: desiredHover || null,
    })
    return produtoId
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

      // Valida a oferta antes de criar/atualizar a Build, para evitar salvar parcialmente por erro de formulário.
      if (includeOffer) makeOfferBody(1)

      const saved = editing
        ? await adminService.builds.update(id, body)
        : await adminService.builds.create(body)

      const postSaveWarnings = []

      try {
        await ensureProductImages(saved)
      } catch (imageErr) {
        postSaveWarnings.push(`Imagem: ${imageErr?.message || 'não foi possível sincronizar com o Produto.'}`)
      }

      if (includeOffer) {
        const produtoId = Number(saved?.produtoId ?? saved?.produto?.id)
        if (!Number.isInteger(produtoId) || produtoId < 1) {
          postSaveWarnings.push('Oferta: o PC foi salvo, mas o backend não retornou produtoId para vincular a oferta.')
        } else {
          try {
            await adminService.offers.create(makeOfferBody(produtoId))
          } catch (offerErr) {
            postSaveWarnings.push(`Oferta: ${offerErr?.message || 'não foi possível criar a oferta.'}`)
          }
        }
      }

      if (postSaveWarnings.length) {
        toast.show(`PC montado salvo. ${postSaveWarnings.join(' ')}`, 'alerta')
      } else {
        toast.show(includeOffer ? 'PC montado e oferta salvos.' : 'PC montado salvo.')
      }
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
    <AdminPageHeader title={editing ? 'Editar PC montado' : 'Novo PC montado'} description="Cadastre os dados, escolha os componentes reais do catálogo e, se quiser, já crie a oferta do PC no mesmo fluxo.">
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
          <div className="admin-section-heading"><div><h2>Componentes do PC</h2><p>Pesquise o Hardware já cadastrado e adicione as peças da máquina.</p></div><strong>{selectedComponents.length} item(ns)</strong></div>
          <div className="admin-field full admin-mounted-hardware-picker">
            <label>Pesquisar Hardware</label>
            <input className="admin-input" type="search" value={hardwareSearch} onChange={(e) => setHardwareSearch(e.target.value)} placeholder="Ex.: Ryzen 7 5700X3D, RTX 4070, B650, DDR5..." autoComplete="off" />
            {hardwareSearch.trim().length >= 2 && <div className="admin-mounted-hardware-results" role="listbox">
              {hardwareResults.length ? hardwareResults.map((hardware) => <button key={hardware.id} type="button" className="admin-mounted-hardware-result" onClick={() => addHardware(hardware)}>
                <span><strong>{hardware.nome || `Hardware #${hardware.id}`}</strong><small>{[hardware.marca, hardware.modelo].filter(Boolean).join(' · ') || `ID ${hardware.id}`}</small></span>
                <em>{hardware.categoria || 'HARDWARE'}</em>
              </button>) : <div className="admin-mounted-hardware-empty">Nenhum Hardware encontrado.</div>}
            </div>}
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

        <section className="admin-form-section">
          <div className="admin-section-heading">
            <div><h2>Oferta do PC Montado</h2><p>O preço comercial fica em Oferta e será vinculado ao Produto criado para este PC.</p></div>
            <label className="admin-switch"><input type="checkbox" checked={includeOffer} onChange={(e) => setIncludeOffer(e.target.checked)} /> Incluir oferta</label>
          </div>
          {includeOffer && <div className="admin-offer-editor">
            <div className="admin-form-grid">
              <div className="admin-field"><label>Parceiro</label><select className="admin-select" required value={offerForm.parceiroId} onChange={(e) => updateOffer('parceiroId', e.target.value)}><option value="">Selecione</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}</select></div>
              <div className="admin-field"><label>Preço atual</label><input className="admin-input" type="number" min="0.01" step="0.01" required value={offerForm.preco} onChange={(e) => updateOffer('preco', e.target.value)} placeholder="4999.90" /></div>
              <div className="admin-field"><label>Preço anterior</label><input className="admin-input" type="number" min="0.01" step="0.01" value={offerForm.precoAnterior} onChange={(e) => updateOffer('precoAnterior', e.target.value)} placeholder="5499.90" /></div>
              <div className="admin-field"><label>Frete</label><input className="admin-input" type="number" min="0" step="0.01" value={offerForm.frete} onChange={(e) => updateOffer('frete', e.target.value)} placeholder="0.00" /></div>
              <div className="admin-field"><label>Vendedor</label><input className="admin-input" value={offerForm.vendedorNome} onChange={(e) => updateOffer('vendedorNome', e.target.value)} placeholder="Loja oficial" /></div>
              <div className="admin-field"><label>ID do vendedor</label><input className="admin-input" value={offerForm.vendedorIdentificador} onChange={(e) => updateOffer('vendedorIdentificador', e.target.value)} placeholder="Opcional" /></div>
              <div className="admin-field full"><label>URL original</label><input className="admin-input" type="url" required value={offerForm.urlOriginal} onChange={(e) => updateOffer('urlOriginal', e.target.value)} placeholder="https://loja.com/produto" /></div>
              <div className="admin-field full"><label>URL afiliada</label><input className="admin-input" type="url" value={offerForm.urlAfiliada} onChange={(e) => updateOffer('urlAfiliada', e.target.value)} placeholder="https://link-afiliado..." /></div>
              <div className="admin-field"><label>Validade</label><input className="admin-input" type="datetime-local" value={offerForm.validoAte} onChange={(e) => updateOffer('validoAte', e.target.value)} /></div>
            </div>
          </div>}
        </section>

        <section className="admin-form-section"><h2>Configuração 3D</h2><textarea className="admin-textarea admin-code-area" value={form.configuracao3D} onChange={(e) => update('configuracao3D', e.target.value)} placeholder={'{\n  "camera": {},\n  "pecas": []\n}'} /></section>
        {error && <section className="admin-form-section"><p className="admin-form-error">{error.message}</p></section>}
        <footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : (includeOffer ? 'Salvar PC e oferta' : 'Salvar PC montado')}</button></footer>
      </div>
      <aside className="admin-sticky-side"><div className="admin-card"><header className="admin-card-header"><h2>Prévia</h2></header><div className="admin-card-body">
        <div className="admin-mounted-side-preview">{form.imagemUrl && !imageError ? <img src={form.imagemUrl} alt="" onError={() => setImageError(true)} /> : <div className="admin-empty">Sem imagem</div>}<div><small>{form.categoria || 'PC Montado'}</small><h3>{form.nome || 'Nome do PC'}</h3><strong>{includeOffer ? formatMoney(offerForm.preco) : `${selectedComponents.length} componente(s)`}</strong></div></div>
        <hr className="admin-divider" />
        <label className="admin-switch"><input type="checkbox" checked={form.publicado} onChange={(e) => update('publicado', e.target.checked)} /> Publicado</label><br /><br />
        <label className="admin-switch"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label>
      </div></div></aside>
    </form>
  </>
}
