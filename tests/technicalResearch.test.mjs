import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeResearchGaps, researchEvidenceRows, openHardwareResearchDraft } from '../src/admin/utils/technicalResearch.js'

test('pesquisa preserva campos manuais, false e zero enquanto preenche lacunas', () => {
  assert.deepEqual(mergeResearchGaps({ socket: 'AM4', suportaEcc: false, portas: 0, tipos: [] },
    { socket: 'AM5', suportaEcc: true, portas: 4, tipos: ['DDR4'], threads: 12 }),
  { socket: 'AM4', suportaEcc: false, portas: 0, tipos: ['DDR4'], threads: 12 })
})

test('somente evidências confirmadas e links seguros são apresentados', () => {
  const rows = researchEvidenceRows({ origemPorCampo: {
    nucleos: { url: 'https://amd.com/cpu', trecho: 'CPU Cores: 6', evidenciaCampoConfirmada: true, valor: 6 },
    threads: { url: 'https://amd.com/cpu', trecho: 'Threads: 12' },
    socket: { url: 'javascript:alert(1)', trecho: 'AM4', evidenciaCampoConfirmada: true },
  } })
  assert.deepEqual(rows.map((r) => r.field), ['nucleos'])
})

test('a peça abre preenchida em outra aba sem publicar ou mexer no formulário do PC', () => {
  const data = new Map()
  let route
  const popup = { opener: {}, sessionStorage: { setItem: (key, value) => data.set(key, value) }, location: { replace: (value) => { route = value } } }
  const component = { categoria: 'PROCESSADOR', cadastroHardwareSugerido: { nome: 'Ryzen 5 5600G', especificacaoProcessador: { nucleos: 6 } }, pesquisaTecnica: { origemPorCampo: {} } }
  assert.equal(openHardwareResearchDraft(component, () => popup), true)
  assert.equal(popup.opener, null)
  assert.equal(route, '/admin/hardwares/novo?origem=ia-importacao')
  const preview = JSON.parse(data.get('criabyteAdminIaImportPreview'))
  assert.equal(preview.cadastroSugerido.payload.especificacaoProcessador.nucleos, 6)
  assert.equal(preview.destinoSugerido, 'HARDWARE')
  assert.equal(openHardwareResearchDraft(component, () => null), false)
})
