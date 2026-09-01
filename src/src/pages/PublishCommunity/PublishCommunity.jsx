import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import {
  atualizarPublicacaoComunidade,
  buscarBuildPorSlug,
  publicarBuild,
} from '../../services/communityService'
import { savedBuildsService } from '../../services/savedBuildsService'
import './PublishCommunity.css'

const purposes = ['GAMER', 'TRABALHO', 'PROGRAMACAO', 'EDICAO', 'STREAMING', 'WORKSTATION', 'USO_GERAL']
const resolutions = ['NAO_APLICAVEL', '1080P', '1440P', '4K']

const purposeLabel = {
  GAMER: 'Gamer', TRABALHO: 'Trabalho', PROGRAMACAO: 'Programação', EDICAO: 'Edição', STREAMING: 'Streaming', WORKSTATION: 'Workstation', USO_GERAL: 'Uso geral',
}
const resolutionLabel = { NAO_APLICAVEL: 'Não aplicável', '1080P': '1080p', '1440P': '1440p', '4K': '4K' }

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))
}

const PENDING_PUBLICATION_KEY = 'pcBuilderPublicacaoPendente'
const PUBLISHED_CONFIGURATION = '__publicada__'

function readPendingPublication() {
  try {
    const raw = sessionStorage.getItem(PENDING_PUBLICATION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw)
    return value?.configuracao ? value : null
  } catch {
    return null
  }
}

function communityBuildAsSaved(build) {
  if (!build) return null
  return {
    id: `community-${build.id}`,
    nome: build.title,
    communityBuildId: build.id,
    precoTotal: Number(build.price || build.currentPrice || 0),
    consumoTotal: Number(build.consumption || 0),
    quantidade: (build.components || []).reduce((total, item) => total + Math.max(1, Number(item.quantidade) || 1), 0),
    configuracao: build.builderConfiguration,
    componentes: (build.components || []).map((item, index) => ({
      categoria: item.categoria || item.hardware?.categoria || 'Componente',
      categoriaCodigo: item.categoria || item.hardware?.categoria || '',
      hardwareId: item.hardwareId ?? item.hardware?.id ?? null,
      slot: item.posicao || `Componente ${index + 1}`,
      posicao: item.posicao || null,
      nome: item.nome || item.hardware?.nome || item.modelo || 'Componente',
      marca: item.marca || item.hardware?.marca || '',
      modelo: item.modelo || item.hardware?.modelo || '',
      quantidade: Math.max(1, Number(item.quantidade) || 1),
      origem: item.origem || (item.hardwareId ?? item.hardware?.id ? 'CATALOGO' : 'EXTERNO'),
      especificacoes: item.especificacoes || undefined,
      fonteDadosUrl: item.fonteDadosUrl || undefined,
      modelo3dUrl: item.modelo3dUrl || undefined,
      imagemUrl: item.imagemUrl || item.hardware?.imagemUrl || undefined,
    })),
  }
}

export default function PublishCommunity() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('editar')?.trim() || ''
  const editMode = Boolean(editId)
  const pendingBuild = useMemo(() => readPendingPublication(), [])
  const savedBuilds = useMemo(() => savedBuildsService.list(user?.email || ''), [user?.email])
  const selectableBuilds = useMemo(() => (
    pendingBuild
      ? [pendingBuild, ...savedBuilds.filter((item) => String(item.id) !== String(pendingBuild.id))]
      : savedBuilds
  ), [pendingBuild, savedBuilds])

  const pendingEditsThisPublication = editMode && String(pendingBuild?.communityBuildId || '') === String(editId)
  const initialBuildId = editMode
    ? (pendingEditsThisPublication ? String(pendingBuild.id) : PUBLISHED_CONFIGURATION)
    : (selectableBuilds[0]?.id ? String(selectableBuilds[0].id) : '')

  const [publication, setPublication] = useState(editMode ? undefined : null)
  const [buildId, setBuildId] = useState(initialBuildId)
  const [title, setTitle] = useState(editMode ? '' : (selectableBuilds[0]?.temporaria ? '' : (selectableBuilds[0]?.nome || '')))
  const [description, setDescription] = useState('')
  const [purpose, setPurpose] = useState('GAMER')
  const [resolution, setResolution] = useState('1080P')
  const [visibility, setVisibility] = useState('PUBLICA')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editMode) return undefined
    let active = true
    buscarBuildPorSlug(editId)
      .then((data) => {
        if (!active) return
        setPublication(data || null)
        if (!data) return
        setTitle(data.title || '')
        setDescription(data.description || '')
        setPurpose(data.purpose || 'GAMER')
        setResolution(data.resolution || 'NAO_APLICAVEL')
        setVisibility(data.visibility || 'PUBLICA')
      })
      .catch((requestError) => {
        if (!active) return
        setPublication(null)
        setError(requestError?.message || 'Não foi possível carregar esta publicação.')
      })
    return () => { active = false }
  }, [editId, editMode])

  const publishedSaved = useMemo(() => communityBuildAsSaved(publication), [publication])
  const selected = buildId === PUBLISHED_CONFIGURATION
    ? publishedSaved
    : selectableBuilds.find((build) => String(build.id) === buildId) || null

  const canEdit = !editMode || Boolean(user && publication && (
    String(publication.authorId || '') === String(user.id || '')
    || String(user.papel || '').toUpperCase() === 'ADMIN'
  ))

  function changeBuild(value) {
    setBuildId(value)
    const next = value === PUBLISHED_CONFIGURATION
      ? publishedSaved
      : selectableBuilds.find((build) => String(build.id) === value)
    if (!editMode && next && !title.trim()) setTitle(next.nome || '')
  }

  async function submit(event) {
    event.preventDefault()
    if (!selected || !canEdit) return
    setSubmitting(true)
    setError('')
    try {
      const common = {
        titulo: title.trim(),
        descricao: description.trim(),
        finalidade: purpose,
        resolucao: resolution,
        visibilidade: visibility,
      }

      const result = editMode
        ? await atualizarPublicacaoComunidade(editId, {
            ...common,
            ...(buildId !== PUBLISHED_CONFIGURATION ? { build: selected } : {}),
          })
        : await publicarBuild({
            build: selected,
            ...common,
          }, user)

      if (selected?.temporaria || selected?.pendentePublicacao || pendingEditsThisPublication) {
        sessionStorage.removeItem(PENDING_PUBLICATION_KEY)
      }
      navigate(`/comunidade/${result.id ?? result.slug ?? editId}`)
    } catch (requestError) {
      setError(requestError?.message || (editMode ? 'Não foi possível salvar as alterações.' : 'Não foi possível publicar a build.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (editMode && publication === undefined) {
    return <main className="page-container publish-community publish-community--empty"><strong>Carregando publicação…</strong></main>
  }

  if (editMode && !publication) {
    return (
      <main className="page-container publish-community publish-community--empty">
        <span className="eyebrow">Comunidade</span>
        <h1>Publicação não encontrada.</h1>
        <p>{error || 'Esta build não existe ou não está disponível para edição.'}</p>
        <Link className="button button--secondary" to="/comunidade">Voltar para a Comunidade</Link>
      </main>
    )
  }

  if (editMode && !canEdit) {
    return (
      <main className="page-container publish-community publish-community--empty">
        <span className="eyebrow">Comunidade</span>
        <h1>Você não pode editar esta publicação.</h1>
        <p>Somente o autor da build ou um administrador pode alterar seus dados.</p>
        <Link className="button button--secondary" to={`/comunidade/${publication.id}`}>Voltar para a build</Link>
      </main>
    )
  }

  if (!editMode && !selectableBuilds.length) {
    return (
      <main className="page-container publish-community publish-community--empty">
        <span className="eyebrow">Comunidade</span>
        <h1>Monte um PC antes de publicar.</h1>
        <p>A publicação usa uma configuração real do CriaByte. Você pode publicar diretamente ao finalizar o PC ou escolher uma build já salva.</p>
        <div><Link className="button button--primary" to="/montar">Montar meu PC</Link><Link className="button button--secondary" to="/minhas-builds">Minhas Builds</Link></div>
      </main>
    )
  }

  return (
    <main className="publish-community">
      <section className="publish-community__hero">
        <div className="page-container">
          <Link to={editMode ? `/comunidade/${publication.id}` : '/comunidade'} className="publish-community__back">← {editMode ? 'Voltar para a build' : 'Comunidade'}</Link>
          <span className="eyebrow">{editMode ? 'Gerenciar publicação' : 'Compartilhe uma montagem real'}</span>
          <h1>{editMode ? 'Editar build publicada' : 'Publicar build na Comunidade'}</h1>
          <p>{editMode
            ? 'Altere os dados públicos da build. Você também pode substituir os componentes por uma versão editada e salva no Montador 3D.'
            : 'Publique a montagem atual ou escolha uma build salva. As peças ficam registradas na própria publicação, mesmo quando ainda não aparecem no catálogo.'}</p>
        </div>
      </section>

      <section className="page-container publish-community__layout">
        <form className="publish-community__form" onSubmit={submit}>
          <label>
            <span>{editMode ? 'Componentes usados' : 'Build'}</span>
            <select value={buildId} onChange={(event) => changeBuild(event.target.value)} required>
              {editMode && <option value={PUBLISHED_CONFIGURATION}>Manter configuração publicada</option>}
              {selectableBuilds.map((build) => (
                <option key={build.id} value={build.id}>
                  {build.temporaria
                    ? (build.communityBuildId ? 'Montagem editada no 3D' : 'Montagem atual (não salva)')
                    : build.nome}
                </option>
              ))}
            </select>
          </label>
          {editMode && buildId !== PUBLISHED_CONFIGURATION && (
            <div className="publish-community__notice publish-community__notice--warning">
              <strong>Os componentes da publicação serão substituídos</strong>
              <p>Ao salvar, a configuração selecionada acima passará a ser a configuração pública desta build.</p>
            </div>
          )}
          <label><span>Título público</span><input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={200} required placeholder="Ex.: Meu PC gamer AM4 custo-benefício" /></label>
          <label><span>Descrição</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} placeholder="Conte por que você montou esse PC, como usa e quais dúvidas ou experiências quer compartilhar." /></label>
          <div className="publish-community__row">
            <label><span>Finalidade</span><select value={purpose} onChange={(event) => setPurpose(event.target.value)}>{purposes.map((value) => <option value={value} key={value}>{purposeLabel[value]}</option>)}</select></label>
            <label><span>Resolução alvo</span><select value={resolution} onChange={(event) => setResolution(event.target.value)}>{resolutions.map((value) => <option value={value} key={value}>{resolutionLabel[value]}</option>)}</select></label>
          </div>
          <label><span>Visibilidade</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="PUBLICA">Pública</option><option value="NAO_LISTADA">Não listada</option><option value="PRIVADA">Privada</option></select></label>
          <div className="publish-community__notice"><strong>Compatibilidade antes de publicar</strong><p>Configurações com incompatibilidades críticas conhecidas não podem ser publicadas. Peças sem vínculo com o catálogo continuam permitidas como snapshot.</p></div>
          {error && <p className="publish-community__error" role="alert">{error}</p>}
          <div className="publish-community__actions"><Link className="button button--secondary" to={editMode ? `/comunidade/${publication.id}` : '/comunidade'}>Cancelar</Link><button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Salvando…' : editMode ? 'Salvar alterações' : 'Publicar build'}</button></div>
        </form>

        <aside className="publish-community__summary">
          <span className="eyebrow">{editMode ? 'Configuração usada' : 'Build selecionada'}</span>
          <h2>{selected?.nome}</h2>
          <div><span>Peças</span><strong>{selected?.quantidade || selected?.componentes?.length || 0}</strong></div>
          <div><span>Preço disponível</span><strong>{Number(selected?.precoTotal) > 0 ? money(selected?.precoTotal) : '—'}</strong></div>
          <div><span>Consumo salvo</span><strong>{Number(selected?.consumoTotal || 0) > 0 ? `${Number(selected?.consumoTotal || 0)} W` : '—'}</strong></div>
          <ul>{(selected?.componentes || []).slice(0, 8).map((item, index) => <li key={`${item.slot || item.posicao || 'item'}-${index}`}><span>{item.categoria}</span><strong>{item.nome}</strong></li>)}</ul>
          {!editMode && selected && <Link className="button button--secondary" to={savedBuildsService.createBuilderPath(selected)}>Revisar no 3D</Link>}
          {editMode && <p className="publish-community__summary-note">Para editar os componentes no 3D, use o botão “Editar componentes no 3D” na página da build. Ao finalizar, você volta para esta tela com a nova configuração selecionada.</p>}
        </aside>
      </section>
    </main>
  )
}
