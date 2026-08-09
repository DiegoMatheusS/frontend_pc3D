/* eslint-disable react-refresh/only-export-components */
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
      ['tiposMemoriaSuportados', 'Memórias suportadas', 'csv', true, 'Ex.: DDR4, DDR5'],
      ['frequenciasMemoriaJedecMhz', 'Frequências JEDEC (MHz)', 'csvNumber', true, 'Ex.: 3200, 4800'],
      ['frequenciasMemoriaOverclockMhz', 'Frequências OC (MHz)', 'csvNumber', true, 'Ex.: 3600, 6000'],
      ['slotsMemoria', 'Slots de memória', 'number', true], ['capacidadeMaximaMemoriaGb', 'Capacidade máxima (GB)', 'number'],
      ['capacidadeMaximaPorSlotGb', 'Máximo por slot (GB)', 'number'], ['saidasVideo', 'Saídas de vídeo', 'csv', true, 'Ex.: HDMI, DisplayPort'],
      ['portasSata', 'Portas SATA', 'number'], ['versaoPcie', 'Versão PCIe', 'text'], ['ethernet', 'Ethernet', 'text'],
      ['suportaXmp', 'Suporta XMP', 'boolean'], ['suportaExpo', 'Suporta EXPO', 'boolean'], ['suportaEcc', 'Suporta ECC', 'boolean'],
      ['wifi', 'Wi-Fi', 'boolean'], ['bluetooth', 'Bluetooth', 'boolean'], ['biosFlashback', 'BIOS Flashback', 'boolean'],
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
      ['leituraSequencialMbps', 'Leitura (MB/s)', 'number'], ['escritaSequencialMbps', 'Escrita (MB/s)', 'number'], ['alturaMm', 'Altura (mm)', 'number'], ['larguraMm', 'Largura (mm)', 'number'], ['profundidadeMm', 'Profundidade (mm)', 'number'],
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

export function normalizeSpec(schema, values) {
  if (!schema) return null
  const output = {}
  schema.fields.forEach(([key, , type]) => {
    const raw = values?.[key]
    if (type === 'boolean') {
      if (typeof raw === 'boolean') output[key] = raw
      return
    }
    if (raw === '' || raw === null || raw === undefined) return
    if (type === 'number') {
      const number = Number(raw)
      if (Number.isFinite(number)) output[key] = number
      return
    }
    if (type === 'csvNumber') {
      const list = String(raw).split(',').map((v) => Number(v.trim())).filter(Number.isFinite)
      output[key] = [...new Set(list)]
      return
    }
    if (type === 'csv') {
      output[key] = [...new Set(String(raw).split(',').map((v) => v.trim()).filter(Boolean))]
      return
    }
    output[key] = String(raw).trim()
  })
  return output
}

function displayValue(type, value) {
  if ((type === 'csv' || type === 'csvNumber') && Array.isArray(value)) return value.join(', ')
  return value ?? ''
}

export function AdminTechnicalFields({ schema, values, onChange }) {
  if (!schema) return <div className="admin-technical-empty">Esta categoria ainda não possui ficha estruturada no backend. Use os metadados/especificações adicionais para dados extras.</div>

  return (
    <div className="admin-technical-fields">
      <div className="admin-section-heading">
        <div><h2>Ficha técnica — {schema.title}</h2><p>Campos alinhados ao DTO atual do backend.</p></div>
        <span className="admin-import-badge">Estruturado</span>
      </div>
      <div className="admin-form-grid">
        {schema.fields.map(([key, label, type, required = false, optionsOrPlaceholder]) => {
          const value = displayValue(type, values?.[key])
          if (type === 'boolean') {
            return <div className="admin-field admin-field--boolean" key={key}><label className="admin-switch"><input type="checkbox" checked={Boolean(values?.[key])} onChange={(e) => onChange(key, e.target.checked)} /> {label}</label></div>
          }
          if (type === 'select') {
            const options = Array.isArray(optionsOrPlaceholder) ? optionsOrPlaceholder : []
            return <div className="admin-field" key={key}><label htmlFor={`admin-tech-${key}`}>{label}{required ? ' *' : ''}</label><select id={`admin-tech-${key}`} className="admin-select" required={required} value={value} onChange={(e) => onChange(key, e.target.value)}><option value="">Selecione</option>{options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></div>
          }
          return <div className="admin-field" key={key}><label htmlFor={`admin-tech-${key}`}>{label}{required ? ' *' : ''}</label><input id={`admin-tech-${key}`} className="admin-input" type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined} required={required} value={value} onChange={(e) => onChange(key, e.target.value)} placeholder={typeof optionsOrPlaceholder === 'string' ? optionsOrPlaceholder : undefined} /></div>
        })}
      </div>
    </div>
  )
}
