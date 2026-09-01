import { useEffect, useMemo, useState } from 'react'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
}

function normalizeReview(item = {}) {
  const produto = item.produto && typeof item.produto === 'object' ? item.produto : {}
  const hardware = item.hardware && typeof item.hardware === 'object' ? item.hardware : {}
  const notebook = item.notebook && typeof item.notebook === 'object' ? item.notebook : {}
  const build = item.build && typeof item.build === 'object' ? item.build : {}
  const usuario = item.usuario && typeof item.usuario === 'object' ? item.usuario : {}
  const targetType = String(first(item.tipoEntidade, item.entidadeTipo, item.tipo, produto.id && 'PRODUTO', hardware.id && 'HARDWARE', notebook.id && 'NOTEBOOK', build.id && 'PC_MONTADO', '') || '').toUpperCase()
  const targetId = first(item.entidadeId, item.produtoId, item.hardwareId, item.notebookId, item.buildId, produto.id, hardware.id, notebook.id, build.id)
  const targetName = first(item.entidadeNome, item.itemNome, produto.nome, hardware.nome, notebook.nome, notebook.produto?.nome, build.nome, build.produto?.nome, targetId ? `#${targetId}` : '—')

  return {
    ...item,
    id: first(item.id, item.avaliacaoId),
    nota: Number(first(item.nota, item.rating, 0)) || 0,
    titulo: String(first(item.titulo, item.title, '') || ''),
    comentario: String(first(item.comentario, item.texto, item.comment, '') || ''),
    criadoEm: first(item.criadoEm, item.createdAt, item.dataCriacao),
    atualizadoEm: first(item.atualizadoEm, item.updatedAt, item.dataAtualizacao),
    targetType,
    targetId,
    targetName,
    userName: first(usuario.nome, item.usuarioNome, item.autor?.nome, item.nomeUsuario, 'Usuário'),
    userEmail: first(usuario.email, item.usuarioEmail, item.autor?.email, ''),
  }
}

function typeLabel(value) {
  const labels = {
    PRODUTO: 'Produto',
    HARDWARE: 'Hardware',
    NOTEBOOK: 'Notebook',
    PC_MONTADO: 'PC Montado',
    BUILD: 'Build',
    COMUNIDADE: 'Comunidade',
  }
  return labels[value] || value || '—'
}

function stars(value) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0))
  return `${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}`
}

export default function AdminReviews() {
  const toast = useAdminToast()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [rating, setRating] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  async function load() {
    try {
      const result = await adminService.reviews.list()
      setItems((result || []).map(normalizeReview))
      setError(null)
    } catch (err) {
      if (err?.status === 404) {
        err.message = 'O frontend está pronto para gerenciar avaliações, mas a rota /api/admin/avaliacoes ainda não está disponível no backend.'
      }
      setError(err)
    }
  }

  useEffect(() => { load() }, [])

  const types = useMemo(() => [...new Set((items || []).map((item) => item.targetType).filter(Boolean))].sort(), [items])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return (items || []).filter((item) => {
      if (type && item.targetType !== type) return false
      if (rating && Number(item.nota) !== Number(rating)) return false
      if (!term) return true
      return [item.id, item.titulo, item.comentario, item.userName, item.userEmail, item.targetName, item.targetType, item.targetId]
        .join(' ').toLocaleLowerCase('pt-BR').includes(term)
    })
  }, [items, search, type, rating])

  function edit(item) {
    setEditing({
      id: item.id,
      nota: String(item.nota || 5),
      titulo: item.titulo || '',
      comentario: item.comentario || '',
      targetName: item.targetName,
      userName: item.userName,
    })
  }

  async function save(event) {
    event.preventDefault()
    if (!editing?.id) return
    setSaving(true)
    try {
      await adminService.reviews.update(editing.id, {
        nota: Number(editing.nota),
        titulo: editing.titulo.trim() || null,
        comentario: editing.comentario.trim() || null,
      })
      toast.show('Avaliação atualizada.')
      setEditing(null)
      await load()
    } catch (err) {
      if (err?.status === 404) err.message = 'A rota administrativa para editar avaliações ainda não está disponível no backend.'
      toast.show(err.message, 'erro')
    } finally { setSaving(false) }
  }

  async function remove(item) {
    if (!item?.id) return
    const ok = window.confirm(`Excluir a avaliação de ${item.userName} em “${item.targetName}”? Essa ação não pode ser desfeita.`)
    if (!ok) return
    setDeletingId(item.id)
    try {
      await adminService.reviews.remove(item.id)
      toast.show('Avaliação excluída.')
      if (editing?.id === item.id) setEditing(null)
      await load()
    } catch (err) {
      if (err?.status === 404) err.message = 'A rota administrativa para excluir avaliações ainda não está disponível no backend.'
      toast.show(err.message, 'erro')
    } finally { setDeletingId(null) }
  }

  if (error) return <AdminError error={error} />
  if (!items) return <AdminLoading text="Carregando avaliações..." />

  return <>
    <AdminPageHeader title="Avaliações" description="Revise, edite ou exclua avaliações publicadas pelos usuários." />

    {editing && <section className="admin-form-card admin-review-editor">
      <form onSubmit={save}>
        <section className="admin-form-section">
          <div className="admin-review-editor-head">
            <div><h2>Editar avaliação</h2><p>{editing.targetName} · {editing.userName}</p></div>
            <button className="admin-action-button" type="button" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
          <div className="admin-form-grid">
            <div className="admin-field"><label>Nota</label><select className="admin-select" value={editing.nota} onChange={(e) => setEditing((current) => ({ ...current, nota: e.target.value }))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} estrela{value === 1 ? '' : 's'}</option>)}</select></div>
            <div className="admin-field"><label>Título</label><input className="admin-input" value={editing.titulo} maxLength={120} onChange={(e) => setEditing((current) => ({ ...current, titulo: e.target.value }))} /></div>
            <div className="admin-field full"><label>Comentário</label><textarea className="admin-textarea" rows="5" value={editing.comentario} maxLength={2000} onChange={(e) => setEditing((current) => ({ ...current, comentario: e.target.value }))} /></div>
          </div>
        </section>
        <footer className="admin-form-footer"><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></footer>
      </form>
    </section>}

    <section className="admin-toolbar admin-review-toolbar">
      <label className="admin-toolbar-field"><span>Pesquisar</span><input className="admin-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Usuário, produto, comentário ou ID" /></label>
      <label className="admin-toolbar-field"><span>Tipo</span><select className="admin-select" value={type} onChange={(e) => setType(e.target.value)}><option value="">Todos</option>{types.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}</select></label>
      <label className="admin-toolbar-field"><span>Nota</span><select className="admin-select" value={rating} onChange={(e) => setRating(e.target.value)}><option value="">Todas</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} estrela{value === 1 ? '' : 's'}</option>)}</select></label>
    </section>

    <section className="admin-table-card mobile-cards"><div className="admin-table-wrap"><table className="admin-table admin-review-table"><thead><tr><th>Avaliação</th><th>Item</th><th>Usuário</th><th>Data</th><th>Ações</th></tr></thead><tbody>{filtered.length ? filtered.map((item) => <tr key={item.id}>
      <td data-label="Avaliação"><strong className="admin-review-stars">{stars(item.nota)} <span>{item.nota}/5</span></strong>{item.titulo && <div className="admin-review-title">{item.titulo}</div>}<p className="admin-review-comment">{item.comentario || 'Sem comentário.'}</p><small>#{item.id}</small></td>
      <td data-label="Item"><strong>{item.targetName}</strong><br /><small>{typeLabel(item.targetType)}{item.targetId ? ` · #${item.targetId}` : ''}</small></td>
      <td data-label="Usuário"><strong>{item.userName}</strong>{item.userEmail && <><br /><small>{item.userEmail}</small></>}</td>
      <td data-label="Data">{formatDate(item.atualizadoEm || item.criadoEm)}</td>
      <td data-label="Ações"><div className="admin-row-actions"><button className="admin-action-button" type="button" onClick={() => edit(item)}>Editar</button><button className="admin-action-button admin-action-button--danger" type="button" disabled={deletingId !== null} onClick={() => remove(item)}>{String(deletingId) === String(item.id) ? 'Excluindo...' : 'Excluir'}</button></div></td>
    </tr>) : <EmptyRow columns={5} text="Nenhuma avaliação encontrada." />}</tbody></table></div><div className="admin-list-footer"><span>{filtered.length} de {items.length} avaliação(ões)</span></div></section>
  </>
}
