import assert from 'node:assert/strict'
import { test } from 'node:test'

for (const root of ['../src/admin/utils', '../src/src/admin/utils']) {
  const { findExistingProductFromAi } = await import(`${root}/catalogMatching.js`)
  const { findExistingHardwareFromAi } = await import(`${root}/hardwareMatching.js`)
  const preview = source => ({ normalizacao: { camposNormalizados: source } })
  const gpu = { id: 42, categoria: 'PLACA_VIDEO', marca: 'Zotac', modelo: 'ZT-D40600E-10M', nome: 'Zotac Gaming GeForce RTX 4060 Twin Edge 8GB' }

  test(`${root}: título Zotac RTX 4060 oferece ficha existente para confirmar`, () => {
    const result = findExistingHardwareFromAi([gpu], preview({ categoria: 'PLACA_VIDEO', nome: 'Placa De Vídeo Zotac Rtx 4060' }))
    assert.equal(result.hardware, null)
    assert.deepEqual(result.ambiguous, [gpu])
  })
  test(`${root}: GPU preserva fabricante, Ti e memória`, () => {
    const other = [
      { ...gpu, id: 43, marca: 'Asus', nome: 'Asus RTX 4060 8GB' },
      { ...gpu, id: 44, modelo: '4060 Ti', nome: 'Zotac RTX 4060 Ti 8GB' },
      { ...gpu, id: 45, nome: 'Zotac RTX 4060 16GB' },
    ]
    const result = findExistingHardwareFromAi([gpu, ...other], preview({ categoria: 'PLACA_VIDEO', nome: 'Placa Zotac RTX 4060 8GB' }))
    assert.deepEqual(result.ambiguous, [gpu])
  })
  test(`${root}: MPN+marca confirma a variante entre duas placas do mesmo chipset`, () => {
    const result = findExistingHardwareFromAi([gpu, { ...gpu, id: 43, mpn: 'DIFERENTE', modelo: 'ZT-OUTRO' }], preview({ categoria: 'PLACA_VIDEO', nome: 'Placa Zotac RTX 4060', marca: 'Zotac', mpn: 'ZT-D40600E-10M' }))
    // O modelo comercial também pode ser o MPN, mas só o MPN informado confirma automaticamente.
    assert.equal(result.hardware, null)
    const exact = findExistingHardwareFromAi([{ ...gpu, mpn: 'ZT-D40600E-10M' }], preview({ categoria: 'PLACA_VIDEO', marca: 'Zotac', mpn: 'zt d40600e 10m' }))
    assert.equal(exact.hardware.id, 42)
  })
  test(`${root}: nomes normalizados reutilizam qualquer tipo de Produto`, () => {
    for (const tipo of ['GENERICO', 'NOTEBOOK', 'BUILD', 'HARDWARE']) {
      const item = { id: 1, tipo, nome: 'Produto Á 123', marca: null, modelo: null }
      assert.equal(findExistingProductFromAi([item], preview({ nome: 'produto a-123' })).product.id, 1)
    }
  })
  test(`${root}: busca sem IA sugere modelos de produtos gerais e equipamentos`, () => {
    for (const item of [
      { id: 1, nome: 'Mouse Logitech G502 Hero', marca: 'Logitech', modelo: 'G502' },
      { id: 2, nome: 'Notebook Lenovo IdeaPad 3 16GB 512GB', marca: 'Lenovo', modelo: 'IdeaPad 3' },
      { id: 3, nome: 'PC Gamer Ryzen 5 5600 16GB', marca: null, modelo: null },
    ]) {
      const title = item.id === 1 ? 'Mouse Gamer Logitech G502' : item.id === 2 ? 'Notebook Lenovo IdeaPad 3' : 'Computador Gamer Ryzen 5 5600'
      assert.deepEqual(findExistingProductFromAi([item], preview({ nome: title })).ambiguous, [item])
    }
  })
  test(`${root}: identificadores ou capacidades diferentes preservam variantes`, () => {
    const item = { id: 1, nome: 'Notebook Lenovo IdeaPad 16GB', marca: 'Lenovo', modelo: 'IdeaPad', mpn: 'VARIANTE16' }
    assert.equal(findExistingProductFromAi([item], preview({ ...item, nome: 'Notebook Lenovo IdeaPad 8GB', mpn: 'VARIANTE8' })).product, null)
    assert.equal(findExistingProductFromAi([item], preview({ ...item, nome: 'Notebook Lenovo IdeaPad 8GB', mpn: undefined })).product, null)
    assert.equal(findExistingProductFromAi([item], preview({ ...item, mpn: 'VARIANTE8' })).product, null)
  })
  test(`${root}: múltiplos existentes exigem escolha e nomes genéricos não confirmam`, () => {
    const items = [{ id: 1, nome: 'Mouse sem fio' }, { id: 2, nome: 'Mouse sem fio' }]
    assert.deepEqual(findExistingProductFromAi(items, preview({ nome: 'Mouse sem fio' })).ambiguous, items)
    assert.deepEqual(findExistingProductFromAi(items, preview({ nome: 'Mouse' })).ambiguous, [])
  })
  test(`${root}: todas as categorias de Hardware aceitam nome normalizado`, () => {
    for (const categoria of ['PROCESSADOR', 'PLACA_MAE', 'MEMORIA_RAM', 'ARMAZENAMENTO', 'FONTE', 'GABINETE', 'COOLER', 'VENTOINHA']) {
      const item = { id: 1, categoria, nome: 'Modelo Á 123' }
      assert.equal(findExistingHardwareFromAi([item], preview({ categoria, nome: 'modelo a-123' })).hardware.id, 1)
    }
  })
}
