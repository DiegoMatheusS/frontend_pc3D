/* eslint-disable react-refresh/only-export-components */
const POSICOES_REFRIGERACAO = ['FRENTE', 'TOPO', 'TRASEIRA', 'INFERIOR', 'LATERAL']

const HARDWARE_SCHEMAS = {
  PROCESSADOR: {
    key: 'especificacaoProcessador',
    title: 'Processador',
    fields: [
      ['socket', 'Socket', 'text', true],
      ['familia', 'Família', 'text'], ['linha', 'Linha', 'text'], ['geracao', 'Geração', 'text'], ['arquitetura', 'Arquitetura', 'text'],
      ['litografiaNm', 'Litografia (nm)', 'number'], ['nucleos', 'Núcleos', 'number'], ['threads', 'Threads', 'number'],
      ['frequenciaBaseMhz', 'Clock base (MHz)', 'number'], ['frequenciaTurboMhz', 'Clock turbo (MHz)', 'number'],
      ['cacheL2Mb', 'Cache L2 (MB)', 'number'], ['cacheL3Mb', 'Cache L3 (MB)', 'number'], ['tdpWatts', 'TDP (W)', 'number'],
      ['tiposMemoriaSuportados', 'Memórias suportadas', 'csv', true, 'Ex.: DDR4, DDR5'],
      ['frequenciaMemoriaMaximaMhz', 'Memória máxima (MHz)', 'number'], ['capacidadeMemoriaMaximaGb', 'Memória máxima (GB)', 'number'],
      ['canaisMemoria', 'Canais de memória', 'number'], ['temperaturaMaximaC', 'Temperatura máxima (°C)', 'number'],
      ['versaoPcie', 'Versão PCIe', 'text'], ['lanesPcie', 'Lanes PCIe', 'number'],
      ['possuiVideoIntegrado', 'Vídeo integrado', 'boolean'], ['modeloVideoIntegrado', 'Modelo do vídeo integrado', 'text'],
      ['suportaEcc', 'Suporta ECC', 'boolean'], ['coolerIncluso', 'Cooler incluso', 'boolean'],
      ['multiplicadorDesbloqueado', 'Multiplicador desbloqueado', 'boolean'], ['suporteOverclock', 'Suporte a overclock', 'boolean'],
      ['dataLancamento', 'Data de lançamento', 'date'],
    ],
  },
  PLACA_MAE: {
    key: 'especificacaoPlacaMae', title: 'Placa-mãe',
    fields: [
      ['socket', 'Socket', 'text', true], ['chipset', 'Chipset', 'text', true],
      ['formato', 'Formato', 'select', true, ['E_ATX','ATX','MICRO_ATX','MINI_ITX']],
      ['revisao', 'Revisão', 'text'], ['biosInicial', 'BIOS inicial', 'text'], ['biosMinima', 'BIOS mínima', 'text'],
      ['tiposMemoriaSuportados', 'Tipos de memória suportados', 'csv', true, 'Ex.: DDR4, DDR5'],
      ['formatosMemoriaSuportados', 'Formatos de memória suportados', 'csv', false, 'Ex.: DIMM, SO_DIMM'],
      ['frequenciasMemoriaJedecMhz', 'Frequências JEDEC (MHz)', 'csvNumber', true, 'Ex.: 3200, 4800'],
      ['frequenciasMemoriaOverclockMhz', 'Frequências OC (MHz)', 'csvNumber', true, 'Ex.: 3600, 6000'],
      ['slotsMemoria', 'Slots de memória', 'number', true], ['capacidadeMaximaMemoriaGb', 'Capacidade máxima (GB)', 'number'],
      ['capacidadeMaximaPorSlotGb', 'Máximo por slot (GB)', 'number'], ['saidasVideo', 'Saídas de vídeo', 'csv', true, 'Ex.: HDMI, DisplayPort'],
      ['portasSata', 'Portas SATA', 'number'], ['versaoPcie', 'Versão PCIe', 'text'], ['ethernet', 'Ethernet', 'text'],
      ['suportaXmp', 'Suporta XMP', 'boolean'], ['suportaExpo', 'Suporta EXPO', 'boolean'], ['suportaEcc', 'Suporta ECC', 'boolean'],
      ['suportaMemoriaRegistrada', 'Suporta memória registrada', 'boolean'],
      ['wifi', 'Wi-Fi', 'boolean'], ['bluetooth', 'Bluetooth', 'boolean'], ['biosFlashback', 'BIOS Flashback', 'boolean'],
    ],
    repeaters: [
      {
        key: 'slotsM2', title: 'Slots M.2', singular: 'slot M.2',
        help: 'Cadastre cada slot físico. Estes dados são usados pelo backend para validar interface, chave, tamanho, geração PCIe e compartilhamentos.',
        create: { codigo: '', interfacesSuportadas: [], chavesSuportadas: [], tamanhosSuportadosMm: [], geracaoPcieMaxima: '', pistasPcie: '', compartilhaCom: '', observacao: '', ativo: true },
        fields: [
          ['codigo', 'Código / identificação', 'text', true, 'Ex.: M2_1'],
          ['interfacesSuportadas', 'Interfaces suportadas', 'csv', true, 'Ex.: NVME_PCIE, SATA'],
          ['chavesSuportadas', 'Chaves suportadas', 'csv', true, 'Ex.: M, B_M'],
          ['tamanhosSuportadosMm', 'Tamanhos suportados (mm)', 'csvNumber', true, 'Ex.: 42, 60, 80, 110'],
          ['geracaoPcieMaxima', 'Geração PCIe máxima', 'number'],
          ['pistasPcie', 'Pistas PCIe', 'number'],
          ['compartilhaCom', 'Compartilha recursos com', 'text', false, 'Ex.: SATA_5_6 ou PCIEX16_2'],
          ['observacao', 'Observação', 'textarea'],
          ['ativo', 'Slot ativo', 'boolean'],
        ],
      },
    ],
  },
  MEMORIA_RAM: {
    key: 'especificacaoMemoriaRam', title: 'Memória RAM',
    fields: [
      ['tipo', 'Tipo', 'select', true, ['DDR3','DDR4','DDR5']], ['formato', 'Formato', 'select', true, ['DIMM','SO_DIMM']],
      ['capacidadePorModuloGb', 'Capacidade por módulo (GB)', 'number', true], ['quantidadeModulos', 'Quantidade de módulos', 'number', true],
      ['frequenciaMhz', 'Frequência (MHz)', 'number', true], ['frequenciaJedecMhz', 'Frequência JEDEC (MHz)', 'number'],
      ['latenciaCl', 'Latência CL', 'number'], ['tensaoVolts', 'Tensão (V)', 'number'], ['alturaMm', 'Altura (mm)', 'number'], ['consumoWatts', 'Consumo (W)', 'number'],
      ['ecc', 'ECC', 'boolean'], ['registrada', 'Registrada', 'boolean'], ['suportaXmp', 'XMP', 'boolean'], ['suportaExpo', 'EXPO', 'boolean'], ['rgb', 'RGB', 'boolean'],
    ],
  },
  GABINETE: {
    key: 'especificacaoGabinete', title: 'Gabinete',
    fields: [
      ['tamanho', 'Tamanho', 'select', true, ['FULL_TOWER','MID_TOWER','MINI_TOWER','SFF','OPEN_FRAME']],
      ['alturaMm', 'Altura (mm)', 'number', true], ['larguraMm', 'Largura (mm)', 'number', true], ['profundidadeMm', 'Profundidade (mm)', 'number', true],
      ['formatosPlacaMaeSuportados', 'Formatos de placa-mãe', 'csv', true, 'Ex.: ATX, MICRO_ATX, MINI_ITX'],
      ['formatosFonteSuportados', 'Formatos de fonte', 'csv', true, 'Ex.: ATX, SFX'],
      ['comprimentoMaximoFonteMm', 'Fonte máxima (mm)', 'number'], ['comprimentoMaximoGpuMm', 'GPU máxima (mm)', 'number'], ['alturaMaximaGpuMm', 'Altura máxima GPU (mm)', 'number'],
      ['slotsMaximosGpu', 'Slots máximos GPU', 'number'], ['alturaMaximaCoolerCpuMm', 'Cooler CPU máximo (mm)', 'number'],
      ['baias25', 'Baias 2.5"', 'number'], ['baias35', 'Baias 3.5"', 'number'], ['slotsTraseiros', 'Slots traseiros', 'number'],
      ['espacoGerenciamentoCabosMm', 'Espaço para cabos (mm)', 'number'], ['suportaGpuVertical', 'GPU vertical', 'boolean'],
    ],
    repeaters: [
      {
        key: 'suportesFans', title: 'Suportes de ventoinhas', singular: 'suporte de ventoinha',
        help: 'Informe as posições e capacidades reais do gabinete para o motor de refrigeração/compatibilidade.',
        create: { posicao: 'FRENTE', tamanhoMm: '', quantidadeMaxima: '', espessuraMaximaMm: '', observacao: '' },
        fields: [
          ['posicao', 'Posição', 'select', true, POSICOES_REFRIGERACAO],
          ['tamanhoMm', 'Tamanho da ventoinha (mm)', 'number', true],
          ['quantidadeMaxima', 'Quantidade máxima', 'number', true],
          ['espessuraMaximaMm', 'Espessura máxima (mm)', 'number'],
          ['observacao', 'Observação', 'textarea'],
        ],
      },
      {
        key: 'suportesRadiador', title: 'Suportes de radiador', singular: 'suporte de radiador',
        help: 'Cadastre cada posição de radiador aceita pelo gabinete, incluindo limite de espessura do conjunto.',
        create: { posicao: 'FRENTE', tamanhoMm: '', espessuraConjuntoMaximaMm: '', observacao: '' },
        fields: [
          ['posicao', 'Posição', 'select', true, POSICOES_REFRIGERACAO],
          ['tamanhoMm', 'Tamanho do radiador (mm)', 'number', true],
          ['espessuraConjuntoMaximaMm', 'Espessura máxima do conjunto (mm)', 'number'],
          ['observacao', 'Observação', 'textarea'],
        ],
      },
    ],
  },
  FONTE: {
    key: 'especificacaoFonte', title: 'Fonte',
    fields: [
      ['formato', 'Formato', 'select', true, ['ATX','SFX','SFX_L','TFX','FLEX_ATX']], ['potenciaWatts', 'Potência (W)', 'number', true],
      ['certificacao', 'Certificação', 'text'], ['modularidade', 'Modularidade', 'select', false, ['NAO_MODULAR','SEMI_MODULAR','MODULAR']],
      ['comprimentoMm', 'Comprimento (mm)', 'number'], ['larguraMm', 'Largura (mm)', 'number'], ['alturaMm', 'Altura (mm)', 'number'],
      ['padraoAtx', 'Padrão ATX', 'text'], ['eficienciaPercentual', 'Eficiência (%)', 'number'], ['correnteLinha12vAmperes', 'Linha 12V (A)', 'number'],
      ['conectoresAtx24Pinos', 'ATX 24 pinos', 'number'], ['conectoresEpsCpu', 'EPS CPU', 'number'], ['conectoresPcie6Pinos', 'PCIe 6 pinos', 'number'],
      ['conectoresPcie8Pinos', 'PCIe 8 pinos', 'number'], ['conectores12vhpwr', '12VHPWR', 'number'], ['conectores12v2x6', '12V-2x6', 'number'],
      ['conectoresSata', 'SATA', 'number'], ['conectoresMolex', 'Molex', 'number'], ['protecoes', 'Proteções', 'csv', false, 'Ex.: OVP, OCP, SCP'], ['tensaoEntrada', 'Tensão de entrada', 'text'],
    ],
  },
  PLACA_VIDEO: {
    key: 'especificacaoPlacaVideo', title: 'Placa de vídeo',
    fields: [
      ['chipset', 'Chipset', 'text'], ['gpu', 'GPU', 'text'], ['arquitetura', 'Arquitetura', 'text'], ['memoriaVideoGb', 'VRAM (GB)', 'number'],
      ['tipoMemoriaVideo', 'Tipo da VRAM', 'text'], ['barramentoBits', 'Barramento (bits)', 'number'], ['clockBaseMhz', 'Clock base (MHz)', 'number'], ['clockBoostMhz', 'Clock boost (MHz)', 'number'],
      ['geracaoPcie', 'Geração PCIe', 'number'], ['larguraPcie', 'Largura PCIe', 'number'], ['comprimentoMm', 'Comprimento (mm)', 'number', true],
      ['alturaMm', 'Altura (mm)', 'number'], ['espessuraMm', 'Espessura (mm)', 'number'], ['slotsOcupados', 'Slots ocupados', 'number'],
      ['consumoWatts', 'TGP/consumo (W)', 'number'], ['potenciaFonteRecomendadaWatts', 'Fonte recomendada (W)', 'number'],
      ['conectoresPcie6Pinos', 'PCIe 6 pinos', 'number'], ['conectoresPcie8Pinos', 'PCIe 8 pinos', 'number'], ['conectores12vhpwr', '12VHPWR', 'number'], ['conectores12v2x6', '12V-2x6', 'number'],
      ['saidasVideo', 'Saídas de vídeo', 'csv'], ['hdmi', 'HDMI', 'number'], ['displayPort', 'DisplayPort', 'number'],
    ],
  },
  COOLER: {
    key: 'especificacaoCooler', title: 'Cooler',
    fields: [
      ['tipo', 'Tipo', 'select', true, ['AIR_COOLER','WATER_COOLER']], ['socketsSuportados', 'Sockets suportados', 'csv', true, 'Ex.: AM4, AM5, LGA1700'],
      ['capacidadeTermicaWatts', 'Capacidade térmica (W)', 'number'], ['alturaMm', 'Altura (mm)', 'number'], ['larguraMm', 'Largura (mm)', 'number'], ['profundidadeMm', 'Profundidade (mm)', 'number'],
      ['alturaLivreRamMm', 'Folga RAM (mm)', 'number'], ['tamanhoRadiadorMm', 'Radiador (mm)', 'number'], ['espessuraRadiadorMm', 'Espessura radiador (mm)', 'number'],
      ['quantidadeVentoinhas', 'Quantidade de fans', 'number'], ['tamanhoVentoinhaMm', 'Fan (mm)', 'number'], ['espessuraVentoinhaMm', 'Espessura fan (mm)', 'number'],
      ['comprimentoMangueirasMm', 'Mangueiras (mm)', 'number'], ['conectorBomba', 'Conector da bomba', 'text'], ['consumoBombaWatts', 'Consumo bomba (W)', 'number'], ['consumoWatts', 'Consumo (W)', 'number'],
      ['rgb', 'RGB', 'boolean'], ['argb', 'ARGB', 'boolean'],
    ],
  },
  VENTOINHA: {
    key: 'especificacaoVentoinha', title: 'Ventoinha',
    fields: [
      ['tamanhoMm', 'Tamanho (mm)', 'number', true], ['espessuraMm', 'Espessura (mm)', 'number'], ['rpmMinima', 'RPM mínima', 'number'], ['rpmMaxima', 'RPM máxima', 'number'],
      ['fluxoArCfm', 'Fluxo de ar (CFM)', 'number'], ['pressaoEstaticaMmH2o', 'Pressão estática (mmH2O)', 'number'], ['ruidoDb', 'Ruído (dB)', 'number'],
      ['conector', 'Conector', 'select', true, ['DC_3_PINOS','PWM_4_PINOS','MOLEX','PROPRIETARIO']], ['tensaoVolts', 'Tensão (V)', 'number'], ['correnteAmperes', 'Corrente (A)', 'number'],
      ['pwm', 'PWM', 'boolean'], ['rgb', 'RGB', 'boolean'], ['argb', 'ARGB', 'boolean'], ['fluxoReverso', 'Fluxo reverso', 'boolean'],
    ],
  },
  ARMAZENAMENTO: {
    key: 'especificacaoArmazenamento', title: 'Armazenamento',
    fields: [
      ['tipo', 'Tipo', 'select', true, ['SSD','HDD']], ['formato', 'Formato', 'select', true, ['POLEGADAS_2_5','POLEGADAS_3_5','M2','PLACA_PCIE']],
      ['interface', 'Interface', 'select', true, ['SATA','NVME_PCIE','SAS']], ['capacidadeGb', 'Capacidade (GB)', 'number', true],
      ['tamanhoM2Mm', 'Tamanho M.2 (mm)', 'number'], ['chaveM2', 'Chave M.2', 'select', false, ['B','M','B_M']], ['geracaoPcie', 'Geração PCIe', 'number'], ['pistasPcie', 'Pistas PCIe', 'number'],
      ['leituraSequencialMbps', 'Leitura sequencial (MB/s)', 'number'], ['escritaSequencialMbps', 'Escrita sequencial (MB/s)', 'number'],
      ['alturaMm', 'Altura (mm)', 'number'], ['larguraMm', 'Largura (mm)', 'number'], ['profundidadeMm', 'Profundidade (mm)', 'number'], ['espessuraMm', 'Espessura (mm)', 'number'],
      ['consumoWatts', 'Consumo (W)', 'number'], ['possuiDissipador', 'Possui dissipador', 'boolean'],
    ],
  },
}

const PRODUCT_SCHEMAS = {
  monitor: { key: 'especificacaoMonitor', title: 'Monitor', fields: [
    ['tamanhoPolegadas','Tamanho (pol.)','number'], ['resolucao','Resolução','text'], ['taxaAtualizacaoHz','Taxa de atualização (Hz)','number'], ['tipoPainel','Painel','text'],
    ['tempoRespostaMs','Tempo de resposta (ms)','number'], ['brilhoNits','Brilho (nits)','number'], ['hdr','HDR','boolean'], ['adaptiveSync','Adaptive Sync','boolean'],
    ['gSync','G-Sync','boolean'], ['freeSync','FreeSync','boolean'], ['hdmi','HDMI','number'], ['displayPort','DisplayPort','number'], ['usbC','USB-C','number'], ['vesa','VESA','text'],
  ]},
  mouse: { key: 'especificacaoMouse', title: 'Mouse', fields: [
    ['sensor','Sensor','text'], ['dpiMaximo','DPI máximo','number'], ['pollingRateHz','Polling rate (Hz)','number'], ['botoes','Botões','number'], ['pesoGramas','Peso (g)','number'],
    ['conexao','Conexão','text'], ['mao','Pegada/mão','text'], ['bluetooth','Bluetooth','boolean'], ['wireless','Wireless','boolean'], ['cabo','Com cabo','boolean'], ['rgb','RGB','boolean'],
  ]},
  teclado: { key: 'especificacaoTeclado', title: 'Teclado', fields: [
    ['tipo','Tipo','text'], ['layout','Layout','text'], ['switch','Switch','text'], ['tamanho','Tamanho','text'], ['conexao','Conexão','text'],
    ['abnt2','ABNT2','boolean'], ['bluetooth','Bluetooth','boolean'], ['wireless','Wireless','boolean'], ['usb','USB','boolean'], ['rgb','RGB','boolean'], ['hotSwap','Hot swap','boolean'],
  ]},
  headset: { key: 'especificacaoHeadset', title: 'Headset/Fone', fields: [
    ['tipoConexao','Tipo de conexão','text'], ['driverMm','Driver (mm)','number'], ['impedancia','Impedância','number'], ['pesoGramas','Peso (g)','number'], ['bateriaHoras','Bateria (h)','number'],
    ['wireless','Wireless','boolean'], ['bluetooth','Bluetooth','boolean'], ['microfone','Microfone','boolean'], ['somSurround','Som surround','boolean'],
  ]},
}

function cleanToken(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function productSchemaFor(category) {
  const token = cleanToken([category?.slug, category?.nome, category].filter(Boolean).join(' '))
  if (token.includes('monitor')) return PRODUCT_SCHEMAS.monitor
  if (token.includes('mouse')) return PRODUCT_SCHEMAS.mouse
  if (token.includes('teclado')) return PRODUCT_SCHEMAS.teclado
  if (token.includes('headset') || token.includes('fone')) return PRODUCT_SCHEMAS.headset
  return null
}

export function hardwareSchemaFor(category) {
  return HARDWARE_SCHEMAS[String(category || '').toUpperCase()] || null
}

export function readSpec(item, schema) {
  if (!schema || !item) return {}
  return { ...(item[schema.key] || {}) }
}

function normalizeValue(type, raw) {
  if (type === 'boolean') return typeof raw === 'boolean' ? raw : undefined
  if (raw === '' || raw === null || raw === undefined) return undefined
  if (type === 'number') {
    const number = Number(raw)
    return Number.isFinite(number) ? number : undefined
  }
  if (type === 'csvNumber') return [...new Set((Array.isArray(raw) ? raw : String(raw).split(',')).map((v) => Number(String(v).trim())).filter(Number.isFinite))]
  if (type === 'csv') return [...new Set((Array.isArray(raw) ? raw : String(raw).split(',')).map((v) => String(v).trim()).filter(Boolean))]
  return String(raw).trim()
}

export function normalizeSpec(schema, values) {
  if (!schema) return null
  const output = {}
  schema.fields.forEach(([key, , type]) => {
    const value = normalizeValue(type, values?.[key])
    if (value !== undefined) output[key] = value
  })
  ;(schema.repeaters || []).forEach((repeater) => {
    const rows = values?.[repeater.key]
    if (!Array.isArray(rows)) return
    output[repeater.key] = rows.map((row) => {
      const clean = {}
      repeater.fields.forEach(([key, , type]) => {
        const value = normalizeValue(type, row?.[key])
        if (value !== undefined) clean[key] = value
      })
      return clean
    })
  })
  return output
}

function displayValue(type, value) {
  if ((type === 'csv' || type === 'csvNumber') && Array.isArray(value)) return value.join(', ')
  if (type === 'date' && value) return String(value).slice(0, 10)
  return value ?? ''
}

function FieldControl({ field, value, onChange, idPrefix }) {
  const [key, label, type, required = false, optionsOrPlaceholder] = field
  const display = displayValue(type, value)
  const id = `${idPrefix}-${key}`

  if (type === 'boolean') {
    return <div className="admin-field admin-field--boolean"><label className="admin-switch"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {label}</label></div>
  }
  if (type === 'select') {
    const options = Array.isArray(optionsOrPlaceholder) ? optionsOrPlaceholder : []
    return <div className="admin-field"><label htmlFor={id}>{label}{required ? ' *' : ''}</label><select id={id} className="admin-select" required={required} value={display} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option>{options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></div>
  }
  if (type === 'textarea') {
    return <div className="admin-field full"><label htmlFor={id}>{label}{required ? ' *' : ''}</label><textarea id={id} className="admin-textarea admin-textarea--compact" required={required} value={display} onChange={(e) => onChange(e.target.value)} placeholder={typeof optionsOrPlaceholder === 'string' ? optionsOrPlaceholder : undefined} /></div>
  }
  return <div className="admin-field"><label htmlFor={id}>{label}{required ? ' *' : ''}</label><input id={id} className="admin-input" type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined} required={required} value={display} onChange={(e) => onChange(e.target.value)} placeholder={typeof optionsOrPlaceholder === 'string' ? optionsOrPlaceholder : undefined} /></div>
}

function RepeaterEditor({ definition, rows = [], onChange }) {
  const safeRows = Array.isArray(rows) ? rows : []
  const add = () => onChange([...safeRows, { ...definition.create }])
  const remove = (index) => onChange(safeRows.filter((_, rowIndex) => rowIndex !== index))
  const change = (index, key, value) => onChange(safeRows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))

  return <section className="admin-tech-repeater">
    <div className="admin-tech-repeater-head">
      <div><h3>{definition.title}</h3>{definition.help && <p>{definition.help}</p>}</div>
      <button className="btn btn-secundario btn-pequeno" type="button" onClick={add}>+ Adicionar {definition.singular}</button>
    </div>
    {!safeRows.length ? <div className="admin-tech-repeater-empty">Nenhum {definition.singular} cadastrado.</div> : <div className="admin-tech-repeater-list">
      {safeRows.map((row, index) => <article className="admin-tech-repeater-item" key={`${definition.key}-${index}`}>
        <header><strong>{definition.singular} {index + 1}</strong><button className="admin-tech-remove" type="button" onClick={() => remove(index)}>Remover</button></header>
        <div className="admin-form-grid">
          {definition.fields.map((field) => <FieldControl key={field[0]} field={field} value={row?.[field[0]]} onChange={(value) => change(index, field[0], value)} idPrefix={`admin-tech-${definition.key}-${index}`} />)}
        </div>
      </article>)}
    </div>}
  </section>
}

export function AdminTechnicalFields({ schema, values, onChange }) {
  if (!schema) return <div className="admin-technical-empty">Esta categoria não possui ficha técnica estruturada no DTO atual do backend. Use os dados adicionais apenas para informações que realmente não possuem campo oficial.</div>

  const fieldCount = schema.fields.length + (schema.repeaters || []).reduce((sum, repeater) => sum + repeater.fields.length, 0)
  return (
    <div className="admin-technical-fields">
      <div className="admin-section-heading">
        <div><h2>Ficha técnica completa — {schema.title}</h2><p>Campos mapeados diretamente dos DTOs atuais do backend. Preencha o máximo possível para melhorar compatibilidade, filtros, IA e comparação.</p></div>
        <span className="admin-import-badge">{fieldCount} campos</span>
      </div>
      <div className="admin-form-grid">
        {schema.fields.map((field) => <FieldControl key={field[0]} field={field} value={values?.[field[0]]} onChange={(value) => onChange(field[0], value)} idPrefix="admin-tech" />)}
      </div>
      {(schema.repeaters || []).map((repeater) => <RepeaterEditor key={repeater.key} definition={repeater} rows={values?.[repeater.key]} onChange={(rows) => onChange(repeater.key, rows)} />)}
    </div>
  )
}
