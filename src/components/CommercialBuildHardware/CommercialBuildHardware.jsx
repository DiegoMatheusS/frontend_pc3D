import { useState } from 'react'
import { Link } from 'react-router-dom'
import useAccessibleDialog from '../../hooks/useAccessibleDialog'
import './CommercialBuildHardware.css'

const CATEGORY_LABELS = {
  PROCESSADOR: 'Processador', PLACA_MAE: 'Placa-mãe', MEMORIA_RAM: 'Memória RAM',
  PLACA_VIDEO: 'Placa de vídeo', ARMAZENAMENTO: 'Armazenamento', FONTE: 'Fonte',
  GABINETE: 'Gabinete', COOLER: 'Cooler', VENTOINHA: 'Ventoinha',
}
const SPEC_GROUPS = [
  ['Processador', 'especificacaoProcessador'], ['Placa de vídeo', 'especificacaoPlacaVideo'],
  ['Memória RAM', 'especificacaoMemoriaRam'], ['Armazenamento', 'especificacaoArmazenamento'],
  ['Fonte', 'especificacaoFonte'], ['Ventoinha', 'especificacaoVentoinha'],
  ['Refrigeração', 'especificacaoCooler'], ['Placa-mãe', 'especificacaoPlacaMae'],
  ['Gabinete', 'especificacaoGabinete'],
]
const FIELD_LABELS = {
  gpu: 'GPU', tdpWatts: 'TDP (W)', consumoWatts: 'Consumo (W)',
  potenciaWatts: 'Potência (W)', potenciaFonteRecomendadaWatts: 'Fonte recomendada (W)',
  memoriaVideoGb: 'Memória de vídeo (GB)', clockBaseMhz: 'Clock base (MHz)',
  clockBoostMhz: 'Clock boost (MHz)', frequenciaMhz: 'Frequência (MHz)',
  capacidadeGb: 'Capacidade (GB)', capacidadePorModuloGb: 'Capacidade por módulo (GB)',
  quantidadeModulos: 'Quantidade de módulos', tiposMemoriaSuportados: 'Tipos de memória suportados',
  soquete: 'Soquete', socket: 'Socket', tipo: 'Tipo', formato: 'Formato',
  interface: 'Interface', chipset: 'Chipset', nucleos: 'Núcleos', threads: 'Threads',
  certificacao: 'Certificação', modularidade: 'Modularidade', hdmi: 'HDMI', displayPort: 'DisplayPort',
  canaisMemoria: 'Canais de memória', slotsMemoria: 'Slots de memória',
  capacidadeMaximaMemoriaGb: 'Capacidade máxima de memória (GB)',
  tamanhoMm: 'Tamanho (mm)', comprimentoMm: 'Comprimento (mm)', larguraMm: 'Largura (mm)',
  alturaMm: 'Altura (mm)', conexoes: 'Conexões', possuiDissipador: 'Possui dissipador',
  rgb: 'RGB', argb: 'ARGB', pwm: 'PWM', modelo: 'Modelo', marca: 'Marca',
}
const EXCLUDED_KEYS = new Set(['id', 'hardwareId', 'criadoEm', 'atualizadoEm', 'produtoId', 'fonteUrl'])

function friendlyField(field) {
  return FIELD_LABELS[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase())
}

function specValue(value) {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' || typeof item === 'number' ? String(item) : '').filter(Boolean).join(', ')
  if (typeof value === 'number' || typeof value === 'string') return String(value).trim()
  return ''
}

function visibleSpecGroups(hardware) {
  return SPEC_GROUPS.map(([name, key]) => {
    const spec = hardware?.[key]
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
    const fields = Object.entries(spec)
      .filter(([field, value]) => !EXCLUDED_KEYS.has(field) && value !== null && value !== undefined)
      .map(([field, value]) => [friendlyField(field), specValue(value)])
      .filter(([, value]) => value !== '')
    return fields.length ? { name, fields } : null
  }).filter(Boolean)
}

export default function CommercialBuildHardware({ components = [] }) {
  const [selected, setSelected] = useState(null)
  const dialogRef = useAccessibleDialog(Boolean(selected), () => setSelected(null))
  const linked = (Array.isArray(components) ? components : []).filter((part) => part?.hardware?.id || part?.hardwareId)
  if (!linked.length) return null

  const hardware = selected?.hardware || {}
  const groups = visibleSpecGroups(hardware)
  return <>
    <section className="commercial-hardware-section mounted-detail__section">
      <header><span className="eyebrow">Catálogo CriaByte</span><h2>Hardwares identificados no anúncio</h2><p>Somente peças com modelo confirmado são vinculadas. Itens genéricos e acessórios continuam na descrição do vendedor.</p></header>
      <div className="commercial-hardware-list">
        {linked.map((part, index) => {
          const item = part.hardware || {}
          const category = CATEGORY_LABELS[part.categoria || item.categoria] || part.categoria || 'Componente'
          return <article className="commercial-hardware-item" key={`${part.hardwareId || item.id}-${index}`}>
            {item.imagemUrl && <img src={item.imagemUrl} alt="" loading="lazy" />}
            <div><small>{category}</small><strong>{item.nome || part.nome || `Hardware #${part.hardwareId}`}</strong><span>{Number(part.quantidade || 1) > 1 ? `${part.quantidade} unidades` : 'Modelo identificado'}</span></div>
            <button className="button button--secondary" type="button" onClick={() => setSelected(part)}>Saber mais</button>
          </article>
        })}
      </div>
    </section>

    {selected && <div className="commercial-hardware-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
      <section className="commercial-hardware-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="commercial-hardware-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="eyebrow">Ficha técnica disponível</span><h2 id="commercial-hardware-title">{hardware.nome || selected.nome || 'Hardware'}</h2><p>{[hardware.marca, hardware.modelo].filter(Boolean).join(' ')}</p></div><button type="button" aria-label="Fechar ficha técnica" className="commercial-hardware-close" onClick={() => setSelected(null)}>×</button></header>
        {groups.length ? groups.map((group) => <div className="commercial-hardware-spec-group" key={group.name}>
          <h3>{group.name}</h3><dl>{group.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </div>) : <p>Ainda não há especificações técnicas detalhadas para este modelo no catálogo.</p>}
        {hardware.produtoId && <Link className="button button--secondary" to={`/produto/${hardware.produtoId}`} onClick={() => setSelected(null)}>Ver página individual, se publicada</Link>}
      </section>
    </div>}
  </>
}
