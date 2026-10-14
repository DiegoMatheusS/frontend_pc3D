import test from 'node:test'
import assert from 'node:assert/strict'
import * as root from '../src/admin/utils/aiImportContract.js'
import * as nested from '../src/src/admin/utils/aiImportContract.js'

for (const [name, contract] of [['raiz', root], ['segunda raiz', nested]]) {
  for (const [category, key, specs] of [
    ['CELULAR', 'especificacaoCelular', { nfc: false, bateriaMah: 5000 }],
    ['MONITOR', 'especificacaoMonitor', { hdr: false, tamanhoPolegadas: 27 }],
    ['MOUSE', 'especificacaoMouse', { wireless: false, dpiMaximo: 16000 }],
    ['TECLADO', 'especificacaoTeclado', { abnt2: false, layout: 'ANSI' }],
    ['HEADSET', 'especificacaoHeadset', { wireless: false, driverMm: 50 }],
  ]) {
    test(`${name}: ${category} transfere a ficha coletada para Produtos`, () => {
      const result = contract.normalizeAiResponse({
        categoriaDetectada: category,
        cadastroSugerido: { payload: { nome: 'Produto Teste', categoriaId: 4 } },
        resultadoProdutoIa: { especificacoesEncontradas: specs },
      })
      assert.equal(result.destinoSugerido, 'PRODUTO')
      assert.deepEqual(contract.getAiPayload(result)[key], specs)
    })
  }

  test(`${name}: produto sem tabela técnica preserva especificações em metadados`, () => {
    const result = contract.normalizeAiResponse({
      categoriaDetectada: 'FONE',
      cadastroSugerido: { payload: { nome: 'Fone Teste', metadados: { asin: 'B0TEST0000' } } },
      especificacoesEncontradas: { bluetooth: true, microfone: false },
    })
    const payload = contract.getAiPayload(result)
    assert.equal(result.destinoSugerido, 'PRODUTO')
    assert.equal(payload.metadados.asin, 'B0TEST0000')
    assert.deepEqual(payload.metadados.especificacoesEncontradas, { bluetooth: true, microfone: false })
    assert.equal(payload.especificacaoHeadset, undefined)
  })

  test(`${name}: hardware continua sendo transferido para Hardware`, () => {
    const result = contract.normalizeAiResponse({ categoriaDetectada: 'PROCESSADOR',
      especificacoesEncontradas: { socket: 'AM5' } })
    assert.equal(result.destinoSugerido, 'HARDWARE')
    assert.equal(result.cadastroSugerido.payload.especificacaoProcessador.socket, 'AM5')
  })
}
