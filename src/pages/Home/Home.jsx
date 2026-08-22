import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MountedPcCard from '../../components/MountedPcCard/MountedPcCard'
import OfferCard from '../../components/OfferCard/OfferCard'
import HomeHero3D from '../../components/HomeHero3D/HomeHero3D'
import { getFeaturedMountedPcs, getFeaturedOfferGroups } from '../../services/homeService'
import './Home.css'

export default function Home() {
  const [mountedPcs, setMountedPcs] = useState([])
  const [offerGroups, setOfferGroups] = useState([])
  const [activeOfferGroup, setActiveOfferGroup] = useState('hardwares')
  const [loadingHighlights, setLoadingHighlights] = useState(true)
  const previewRef = useRef(null)

  useEffect(() => {
    let active = true

    Promise.allSettled([getFeaturedMountedPcs(), getFeaturedOfferGroups()]).then(([pcsResult, groupsResult]) => {
      if (!active) return
      setMountedPcs(pcsResult.status === 'fulfilled' && Array.isArray(pcsResult.value) ? pcsResult.value : [])
      setOfferGroups(groupsResult.status === 'fulfilled' && Array.isArray(groupsResult.value) ? groupsResult.value : [])
      setLoadingHighlights(false)
    })

    return () => { active = false }
  }, [])

  const selectedGroup = offerGroups.find((group) => group.id === activeOfferGroup) ?? offerGroups[0]

  useEffect(() => {
    const elements = [...document.querySelectorAll('[data-home-reveal]')]
    if (!elements.length) return undefined

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }

    let observer
    const reveal = (element) => {
      element.classList.add('is-visible')
      observer?.unobserve(element)
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting || entry.intersectionRatio > 0) reveal(entry.target)
      })
    }, { threshold: 0.01, rootMargin: '0px 0px 14% 0px' })

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect()
      if (rect.top < window.innerHeight * 1.08 && rect.bottom > 0) reveal(element)
      else observer.observe(element)
    })

    // Fallback: conteúdo nunca fica invisível por causa do efeito de entrada
    // caso o navegador não dispare o IntersectionObserver como esperado.
    const fallback = window.setTimeout(() => {
      elements.forEach((element) => element.classList.add('is-visible'))
    }, 1400)

    return () => {
      window.clearTimeout(fallback)
      observer.disconnect()
    }
  }, [loadingHighlights, mountedPcs.length, offerGroups.length])

  function moverPreview(event) {
    const preview = previewRef.current
    if (!preview || window.matchMedia('(pointer: coarse)').matches) return
    const rect = preview.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    preview.style.setProperty('--preview-rotate-y', `${((x - 0.5) * 12).toFixed(2)}deg`)
    preview.style.setProperty('--preview-rotate-x', `${((0.5 - y) * 7).toFixed(2)}deg`)
    preview.style.setProperty('--preview-light-x', `${(x * 100).toFixed(1)}%`)
    preview.style.setProperty('--preview-light-y', `${(y * 100).toFixed(1)}%`)
  }

  function resetarPreview() {
    const preview = previewRef.current
    if (!preview) return
    preview.style.removeProperty('--preview-rotate-y')
    preview.style.removeProperty('--preview-rotate-x')
    preview.style.removeProperty('--preview-light-x')
    preview.style.removeProperty('--preview-light-y')
  }

  return (
    <>
      <section className="home-hero">
        <div className="page-container home-hero__inner">
          <div className="home-hero__content home-enter home-enter--content">
            <span className="eyebrow">Montagem visual e sem ordem obrigatória</span>
            <h1>Monte seu PC e veja tudo em <span>3D antes de comprar.</span></h1>
            <p>
              Escolha as peças no seu ritmo, acompanhe a montagem em tempo real e confira compatibilidade,
              consumo e fluxo de ar antes de decidir.
            </p>

            <div className="home-hero__benefits" aria-label="Principais recursos">
              <span>◇ Visualização 3D</span>
              <span>✓ Compatibilidade automática</span>
              <span>↻ Monte no seu ritmo</span>
            </div>

            <div className="home-hero__actions">
              <Link className="button button--primary" to="/montar">Comece a montar seu PC</Link>
              <Link className="button button--secondary" to="/ofertas">Ver ofertas</Link>
              <a className="button button--ghost-home" href="#como-funciona">Entenda como funciona</a>
            </div>
          </div>

          <div ref={previewRef} className="home-hero__preview home-enter home-enter--preview" aria-label="Prévia conceitual do montador 3D" onPointerMove={moverPreview} onPointerLeave={resetarPreview}>
            <div className="home-preview__top">
              <span><i /> Prévia interativa</span>
              <small>Arraste para girar</small>
            </div>
            <div className="home-preview__stage">
              <HomeHero3D />
            </div>
            <div className="home-preview__bottom">
              <span>Visualização 3D interativa</span>
              <strong>CriaByte 3D</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-how" id="como-funciona" data-home-reveal>
        <div className="page-container">
          <header className="home-section__header">
            <span className="eyebrow">Simples desde o primeiro clique</span>
            <h2>Como funciona</h2>
            <p>Você monta livremente. A ferramenta organiza as informações e avisa quando algo precisa de atenção.</p>
          </header>

          <div className="home-how__grid">
            <article><span className="home-how__number">01</span><span className="home-how__icon" aria-hidden="true">＋</span><h3>Escolha as peças livremente</h3><p>Comece por qualquer categoria e use vários slots quando fizer sentido, como RAM, armazenamento e fans.</p></article>
            <article><span className="home-how__number">02</span><span className="home-how__icon" aria-hidden="true">3D</span><h3>Veja tudo em tempo real</h3><p>Cada componente selecionado aparece na montagem com feedback visual e identificação no palco 3D.</p></article>
            <article><span className="home-how__number">03</span><span className="home-how__icon" aria-hidden="true">✓</span><h3>Confira antes de comprar</h3><p>Revise compatibilidade, preço total, consumo estimado, fonte recomendada e fluxo de ar.</p></article>
          </div>
        </div>
      </section>

      <section className="home-section home-features" data-home-reveal>
        <div className="page-container">
          <header className="home-section__header">
            <span className="eyebrow">O que a ferramenta resolve</span>
            <h2>Menos dúvida. Mais clareza na montagem.</h2>
            <p>Informações práticas sem esconder o diferencial do 3D e sem transformar a experiência em uma vitrine de vendas.</p>
          </header>

          <div className="home-features__grid">
            <article><span aria-hidden="true">◇</span><h3>Visualização 3D real</h3><p>Veja a posição dos componentes e interaja com a montagem antes de partir para o hardware real.</p></article>
            <article><span aria-hidden="true">✓</span><h3>Compatibilidade automática</h3><p>Alertas curtos mostram incompatibilidades e pontos que merecem atenção durante a seleção.</p></article>
            <article><span aria-hidden="true">↔</span><h3>Espaço e fluxo de ar</h3><p>Organize entrada e saída das ventoinhas e entenda melhor o equilíbrio térmico da build.</p></article>
            <article><span aria-hidden="true">⚡</span><h3>Energia e custo</h3><p>Acompanhe consumo, fonte recomendada e preço total enquanto escolhe os componentes.</p></article>
          </div>
        </div>
      </section>

      <section className="home-builder-cta" data-home-reveal>
        <div className="page-container home-builder-cta__inner">
          <div><span className="eyebrow">Pronto para testar sua configuração?</span><h2>Monte primeiro. Compare preços depois.</h2></div>
          <Link className="button button--primary" to="/montar">Montar meu PC agora</Link>
        </div>
      </section>

      <section className="home-section home-mounted" data-home-reveal>
        <div className="page-container">
          <header className="home-section__header home-section__header--row">
            <div><span className="eyebrow">PCs prontos para comparar</span><h2>PCs Montados em destaque</h2><p>Builds comerciais ficam separadas da Comunidade e podem reunir avaliação, ofertas reais e abertura completa no 3D.</p></div>
            <Link className="home-text-link" to="/montados">Ver todos os montados →</Link>
          </header>

          {loadingHighlights ? <div className="home-loading-block">Carregando PCs em destaque…</div> : null}
          {!loadingHighlights && mountedPcs.length ? <div className="home-mounted__grid">{mountedPcs.map((pc, index) => <MountedPcCard key={pc.id ?? `mounted-${index}`} pc={pc} />)}</div> : null}
          {!loadingHighlights && !mountedPcs.length ? <div className="home-empty-block">Os PCs em destaque aparecerão aqui quando houver dados disponíveis.</div> : null}

          <p className="home-data-note">Avaliações, ofertas e preços são exibidos quando há dados disponíveis no catálogo.</p>
        </div>
      </section>

      <section className="home-section home-offers" data-home-reveal>
        <div className="page-container">
          <header className="home-section__header home-section__header--row">
            <div><span className="eyebrow">Depois de escolher, compare</span><h2>Ofertas selecionadas</h2><p>Hardwares, periféricos, monitores, notebooks e setup ficam organizados por categoria.</p></div>
            <Link className="home-text-link" to="/ofertas">Ver todas as ofertas →</Link>
          </header>

          {offerGroups.length ? <div className="home-offers__tabs" role="tablist" aria-label="Categorias de ofertas">
            {offerGroups.map((group, index) => (
              <button key={group.id ?? `offer-group-${index}`} type="button" role="tab" aria-selected={group.id === selectedGroup?.id} className={group.id === selectedGroup?.id ? 'is-active' : ''} onClick={() => setActiveOfferGroup(group.id)}>{group.label}</button>
            ))}
          </div> : null}

          {selectedGroup ? (
            <div className="home-offers__panel" role="tabpanel">
              <div className="home-offers__intro"><h3>{selectedGroup.label}</h3><p>{selectedGroup.description}</p></div>
              <div className="home-offers__grid">{selectedGroup.products.slice(0, 10).map((product, index) => <OfferCard key={product.id ?? `offer-${index}`} product={product} />)}</div>
            </div>
          ) : !loadingHighlights ? <div className="home-empty-block">As ofertas aparecerão aqui quando houver produtos com preço disponível.</div> : null}

          <p className="home-data-note">Mostramos até 10 destaques por categoria. Preços e descontos vêm das ofertas cadastradas.</p>
        </div>
      </section>

      <section className="home-section home-commerce" data-home-reveal>
        <div className="page-container home-commerce__panel">
          <div><span className="eyebrow">Compre quando estiver pronto</span><h2>Escolha com calma. Compare antes de comprar.</h2><p>Explore peças individuais ou computadores montados. Os links de compra entram como apoio depois que a configuração já faz sentido.</p></div>
          <div className="home-commerce__actions"><Link className="button button--primary" to="/ofertas">Ver ofertas</Link><Link className="button button--secondary" to="/pecas">Comprar peças</Link><Link className="button button--secondary" to="/montados">Ver PCs montados</Link></div>
        </div>
      </section>

      <section className="home-community" data-home-reveal>
        <div className="page-container home-community__panel">
          <div><span className="eyebrow">Ajuda feita por quem monta</span><h2>Montou seu PC em casa? Compartilhe na Comunidade.</h2><p>Publique uma configuração real, tire dúvidas, responda outros usuários e use builds da comunidade como ponto de partida.</p></div>
          <div className="home-community__actions"><Link className="button button--primary" to="/comunidade">Conhecer a Comunidade</Link><Link className="button button--secondary" to="/comunidade/publicar">Publicar build</Link></div>
        </div>
      </section>

      <section className="home-final" data-home-reveal>
        <div className="page-container home-final__inner"><span className="eyebrow">Sua build, suas escolhas</span><h2>Monte com liberdade e confira tudo antes de comprar.</h2><p>O 3D continua sendo o centro da experiência. Loja, ofertas, PCs Montados e Comunidade complementam a montagem.</p><Link className="button button--primary" to="/montar">Começar montagem</Link></div>
      </section>
    </>
  )
}
