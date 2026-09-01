import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { listarMinhasBuilds } from '../../services/communityService'
import './Account.css'

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || 'C') + (parts[1]?.[0] || 'B')).toUpperCase()
}

export default function Account() {
  const { user } = useAuth()
  const [communityBuilds, setCommunityBuilds] = useState([])

  useEffect(() => {
    let active = true
    listarMinhasBuilds(user).then((items) => {
      if (active) setCommunityBuilds(Array.isArray(items) ? items : [])
    }).catch(() => {
      if (active) setCommunityBuilds([])
    })
    return () => { active = false }
  }, [user])

  const communityStats = useMemo(() => {
    const published = communityBuilds.filter((build) => build.status === 'PUBLICADA').length
    const drafts = communityBuilds.filter((build) => build.status === 'RASCUNHO').length
    return { total: communityBuilds.length, published, drafts }
  }, [communityBuilds])

  return (
    <section className="account-page">
      <div className="page-container">
        <header className="account-heading"><div><span className="eyebrow">Sua conta</span><h1>Olá, {user.nome}.</h1><p>Acesse suas builds, publique na comunidade e gerencie seu perfil.</p></div></header>

        <section className="account-profile">
          <div className="account-avatar" aria-hidden="true">{initials(user.nome)}</div>
          <div className="account-profile__identity"><strong>{user.nome}</strong><span>{user.email}</span></div>
          <span className="account-role">{user.papel}</span>
          <Link className="button button--secondary account-profile__edit" to="/conta/editar">Alterar cadastro</Link>
        </section>

        <section className="account-community-stats" aria-label="Resumo das publicações na comunidade">
          <div><span>Builds da Comunidade</span><strong>{communityStats.total}</strong></div>
          <div><span>Publicadas</span><strong>{communityStats.published}</strong></div>
          <div><span>Rascunhos</span><strong>{communityStats.drafts}</strong></div>
          <Link to="/comunidade/publicar">Publicar nova build →</Link>
        </section>

        <div className="account-grid">
          <article className="account-card"><span className="account-card__icon" aria-hidden="true">◎</span><h2>Perfil e segurança</h2><p>Altere nome, e-mail ou senha em uma página separada de configurações.</p><Link className="button button--secondary" to="/conta/editar">Editar cadastro</Link></article>
          <article className="account-card"><span className="account-card__icon" aria-hidden="true">▦</span><h2>Minhas builds</h2><p>Organize suas configurações salvas, compartilhe links e volte ao Montador 3D.</p><Link className="button button--secondary" to="/minhas-builds">Abrir minhas builds</Link></article>
          <article className="account-card"><span className="account-card__icon" aria-hidden="true">◌</span><h2>Comunidade</h2><p>Você tem {communityStats.published} build(s) publicada(s) e {communityStats.drafts} rascunho(s) na comunidade.</p><div className="account-card__actions"><Link className="button button--secondary" to="/comunidade">Abrir comunidade</Link><Link className="button button--secondary" to="/comunidade/publicar">Publicar build</Link></div></article>
          <article className="account-card"><span className="account-card__icon" aria-hidden="true">＋</span><h2>Nova montagem</h2><p>Abra o Montador 3D para iniciar uma nova configuração.</p><Link className="button button--primary" to="/montar">Montar novo PC</Link></article>
          <article className="account-card"><span className="account-card__icon" aria-hidden="true">%</span><h2>Enviar oferta</h2><p>Encontrou um bom preço? Envie o link e as especificações para análise antes da publicação.</p><Link className="button button--secondary" to="/enviar-oferta">Enviar uma oferta</Link></article>
          {['ADMIN', 'EDITOR'].includes(String(user.papel || '').toUpperCase()) && <article className="account-card"><span className="account-card__icon" aria-hidden="true">%</span><h2>Busca de Ofertas</h2><p>Veja os Produtos que possuem Oferta ativa e link afiliado cadastrado no CriaByte.</p><Link className="button button--secondary" to="/busca-ofertas">Abrir Busca de Ofertas</Link></article>}
          {['ADMIN', 'EDITOR', 'REVISOR'].includes(String(user.papel || '').toUpperCase()) && <article className="account-card"><span className="account-card__icon" aria-hidden="true">◇</span><h2>Administração</h2><p>Gerencie catálogo, ofertas, usuários e conteúdo usando a mesma conta.</p><Link className="button button--secondary" to="/admin">Abrir Admin</Link></article>}
        </div>
      </div>
    </section>
  )
}
