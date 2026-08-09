import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getNotebookById } from '../../services/notebooksService'
import ReviewsPanel from '../../components/ReviewsPanel/ReviewsPanel'
import { asArray, asNumber, asText, formatCurrency, formatRating } from '../../utils/display'
import { setDocumentMeta } from '../../utils/pageMeta'
import './NotebookDetails.css'

const sections = [
  {
    title: 'Processador',
    fields: [
      ['Modelo', 'cpu'], ['Marca', 'cpuBrand'], ['Geração', 'cpuGeneration'], ['Núcleos', 'cpuCores'], ['Threads', 'cpuThreads'],
      ['Clock base', 'cpuBaseClockGhz', ' GHz'], ['Clock turbo', 'cpuBoostClockGhz', ' GHz'], ['TDP', 'cpuTdpWatts', ' W'],
    ],
  },
  {
    title: 'Placa de vídeo',
    fields: [['GPU', 'gpu'], ['GPU dedicada', 'dedicatedGpu'], ['VRAM', 'vramGb', ' GB'], ['TGP', 'gpuTgpWatts', ' W']],
  },
  {
    title: 'Memória e armazenamento',
    fields: [
      ['RAM instalada', 'ramGb', ' GB'], ['Tipo de RAM', 'ramType'], ['Frequência', 'ramFrequencyMhz', ' MHz'], ['RAM máxima', 'maxRamGb', ' GB'],
      ['Slots de RAM', 'ramSlots'], ['Slots livres', 'freeRamSlots'], ['RAM soldada', 'solderedRamGb', ' GB'], ['Upgrade de RAM', 'upgradeRam'],
      ['Armazenamento', 'storageGb', ' GB'], ['Tipo', 'storageType'], ['Slots M.2', 'm2Slots'], ['M.2 livres', 'freeM2Slots'], ['Upgrade de armazenamento', 'upgradeStorage'],
    ],
  },
  {
    title: 'Tela',
    fields: [['Tamanho', 'screenInches', '”'], ['Resolução', 'resolution'], ['Taxa de atualização', 'refreshRateHz', ' Hz'], ['Painel', 'panel'], ['Brilho', 'brightnessNits', ' nits'], ['Touch', 'touch']],
  },
  {
    title: 'Mobilidade e conectividade',
    fields: [
      ['Bateria', 'batteryWh', ' Wh'], ['Carregador', 'chargerWatts', ' W'], ['Peso', 'weightKg', ' kg'], ['Dimensões', 'dimensions'],
      ['Wi‑Fi', 'wifi'], ['Bluetooth', 'bluetooth'], ['USB-A', 'usbA'], ['USB-C', 'usbC'], ['Thunderbolt', 'thunderbolt'], ['HDMI', 'hdmi'], ['Ethernet', 'ethernet'],
    ],
  },
  {
    title: 'Outros recursos',
    fields: [['Sistema operacional', 'os'], ['Webcam', 'webcam'], ['Teclado iluminado', 'backlitKeyboard'], ['Teclado numérico', 'numericKeypad'], ['Leitor de digital', 'fingerprint']],
  },
]

function displayValue(key, value, suffix = '') {
  if (key === 'dedicatedGpu') return value ? 'Sim' : 'Não'
  if ((key === 'vramGb' || key === 'gpuTgpWatts') && !value) return 'Não se aplica'
  if (value === null || value === undefined || value === '') return 'Não informado'
  return `${value}${typeof value === 'number' ? suffix : ''}`
}

export default function NotebookDetails() {
  const { id } = useParams()
  const [notebook, setNotebook] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getNotebookById(id).then((value) => { if (active) setNotebook(value) }).catch(() => { if (active) setNotebook(null) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!notebook) return
    setDocumentMeta({
      title: `${notebook.name} — CriaByte`,
      description: notebook.description || `Veja ficha técnica, avaliações e ofertas de ${notebook.name}.`,
    })
  }, [notebook])

  const bestOffer = useMemo(() => notebook?.offers?.length
    ? [...asArray(notebook.offers)].sort((a, b) => asNumber(a.price) - asNumber(b.price))[0]
    : null, [notebook])

  if (loading) return <main className="page-container notebook-details-status">Carregando notebook...</main>
  if (!notebook) return <main className="page-container notebook-details-status"><h1>Notebook não encontrado</h1><Link className="button button--secondary" to="/notebooks">Voltar para notebooks</Link></main>

  return (
    <main className="notebook-details">
      <section className="notebook-details__hero">
        <div className="page-container notebook-details__hero-grid">
          <div className="notebook-details__visual"><div className="notebook-details__device"><span>NB</span></div></div>
          <div className="notebook-details__intro">
            <Link className="notebook-details__back" to="/notebooks">← Notebooks</Link>
            <span className="eyebrow">{asText(notebook.brand)} · {asText(notebook.use, 'Uso geral')}</span>
            <h1>{notebook.name}</h1>
            <p>{notebook.description}</p>
            <div className="notebook-details__rating"><strong>★ {formatRating(notebook.rating)}</strong><span>{asNumber(notebook.reviewsCount, 0)} avaliações</span></div>
            <div className="notebook-details__tags">{asArray(notebook.tags).map((tag, index) => <span key={`${asText(tag, 'tag')}-${index}`}>{asText(tag, '')}</span>)}</div>
          </div>
          <aside className="notebook-details__buy-box">
            <span>A partir de</span>
            <strong>{formatCurrency(bestOffer?.price ?? notebook.price)}</strong>
            {asNumber(notebook.previousPrice) > asNumber(notebook.price) && <del>{formatCurrency(notebook.previousPrice)}</del>}
            <p>{asArray(notebook.offers).length} oferta{asArray(notebook.offers).length === 1 ? '' : 's'} disponível{asArray(notebook.offers).length === 1 ? '' : 'is'}.</p>
            <a className="button button--primary" href="#onde-comprar">Onde comprar</a>
            <Link className="button button--secondary" to="/notebooks">Comparar com outro</Link>
          </aside>
        </div>
      </section>

      <div className="page-container notebook-details__layout">
        <div className="notebook-details__main">
          <section className="notebook-details__summary">
            <header><span className="eyebrow">Resumo</span><h2>Visão rápida</h2></header>
            <div className="notebook-details__summary-grid">
              <div><span>Processador</span><strong>{notebook.specs?.cpu}</strong></div>
              <div><span>GPU</span><strong>{notebook.specs?.gpu}</strong></div>
              <div><span>Memória</span><strong>{notebook.specs?.ramGb} GB {notebook.specs?.ramType}</strong></div>
              <div><span>Armazenamento</span><strong>{notebook.specs?.storageGb} GB {notebook.specs?.storageType}</strong></div>
              <div><span>Tela</span><strong>{notebook.specs?.screenInches}” · {notebook.specs?.refreshRateHz} Hz</strong></div>
              <div><span>Peso</span><strong>{notebook.specs?.weightKg} kg</strong></div>
            </div>
          </section>

          {sections.map((section) => <section className="notebook-details__section" key={section.title}>
            <h2>{section.title}</h2>
            <dl>{section.fields.map(([label, key, suffix]) => <div key={key}><dt>{label}</dt><dd>{displayValue(key, notebook.specs?.[key], suffix)}</dd></div>)}</dl>
          </section>)}

          <section className="notebook-details__section" id="onde-comprar">
            <div className="notebook-details__section-heading"><div><span className="eyebrow">Parceiros</span><h2>Onde comprar</h2></div><span>Ordenado pelo menor preço</span></div>
            <div className="notebook-details__offers">
              {[...asArray(notebook.offers)].sort((a, b) => asNumber(a.price) - asNumber(b.price)).map((offerItem, index) => <article key={`${offerItem.store}-${offerItem.price}`}>
                <div><strong>{offerItem.store}</strong>{index === 0 && <span>Melhor preço</span>}</div>
                <div>{asNumber(offerItem.previousPrice) > asNumber(offerItem.price) ? <del>{formatCurrency(offerItem.previousPrice)}</del> : null}<strong>{formatCurrency(offerItem.price)}</strong></div>
                {offerItem.url && offerItem.url !== '#' ? (
                  <a className="button button--secondary" href={offerItem.url} target="_blank" rel="sponsored noopener noreferrer">Comprar</a>
                ) : (
                  <button className="button button--secondary" type="button" disabled>Link indisponível</button>
                )}
              </article>)}
            </div>
            <p className="notebook-details__mock-note">Preços e disponibilidade podem mudar conforme as lojas atualizam suas ofertas.</p>
          </section>

          <ReviewsPanel
            entityType="notebook"
            entityId={notebook.id}
            initialRating={notebook.rating}
            initialCount={notebook.reviewsCount}
            title="Opinião dos usuários"
            intro="Avalie desempenho, tela, bateria, acabamento e possibilidades de upgrade."
          />
        </div>

        <aside className="notebook-details__sidebar">
          <div><span className="eyebrow">Upgrade</span><h3>Possibilidades</h3><p><strong>RAM:</strong> {notebook.specs?.upgradeRam}</p><p><strong>Armazenamento:</strong> {notebook.specs?.upgradeStorage}</p></div>
          <div><span className="eyebrow">Uso indicado</span><h3>{notebook.use}</h3><p>A classificação é informativa e poderá vir do catálogo revisado pelo admin.</p></div>
        </aside>
      </div>
    </main>
  )
}
