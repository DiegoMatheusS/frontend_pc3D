import test from 'node:test'
import assert from 'node:assert/strict'
import { PHONE_FIELDS, buildSpecificationPrompt, parseSpecificationReply, mergeSpecificationGaps, specificationDescription, metadataSpecifications } from '../src/admin/utils/productSpecifications.js'

const schema = { key: 'especificacaoCelular', fields: PHONE_FIELDS }

test('JSON do Chat preserva false, rejeita tipos e aceita bloco Markdown', () => {
  const reply = parseSpecificationReply('```json\n{"especificacoes":{"ramGb":8,"nfc":false,"bateriaMah":5000,"inventado":123}}\n```', schema)
  assert.deepEqual(reply.especificacoes, { ramGb: 8, nfc: false, bateriaMah: 5000 })
  assert.throws(() => parseSpecificationReply('{"especificacoes":{"nfc":"Não"}}', schema), /true ou false/)
  assert.throws(() => parseSpecificationReply('{"especificacoes":{"ramGb":"8 GB"}}', schema), /número/)
  assert.throws(() => parseSpecificationReply('[]', schema), /objeto/)
  assert.throws(() => parseSpecificationReply('{"__proto__":{}}', schema), /não permitida/)
})

test('a aplicação só preenche lacunas e conserva a ficha completa', () => {
  const specs = mergeSpecificationGaps({ ramGb: 8, nfc: false }, { ramGb: 12, nfc: true, armazenamentoGb: 256 })
  assert.deepEqual(specs, { ramGb: 8, nfc: false, armazenamentoGb: 256 })
  assert.deepEqual(metadataSpecifications({ especificacoesEncontradas: { ramGb: 8 }, especificacoes: { nfc: false } }), { ramGb: 8, nfc: false })
})

test('a descrição de celular destaca quatro campos e mantém unidades', () => {
  const description = specificationDescription({ ramGb: 8, armazenamentoGb: 256, tamanhoTelaPolegadas: 6.7, bateriaMah: 5000, nfc: true, cameraPrincipalMp: 50, processadorNome: 'Teste' }, true)
  assert.equal(description.split(' · ').length, 4)
  assert.match(description, /8 GB/)
  assert.match(description, /256 GB/)
  assert.match(description, /5\.000 mAh/)
  assert.doesNotMatch(description, /NFC|Câmera|Processador/)
})

test('a pergunta inclui a variante e pede descrição curta com fontes', () => {
  const prompt = buildSpecificationPrompt({ nome: 'Galaxy Teste', modelo: 'SM-TESTE', gtin: '1234567890123' }, schema, true)
  assert.match(prompt, /SM-TESTE/)
  assert.match(prompt, /quatro especificações/)
  assert.match(prompt, /ramGb/)
  assert.match(prompt, /fontes/)
  assert.match(prompt, /Não invente/)
})


test('a segunda raiz usa os mesmos campos, resumo e contrato JSON', async () => {
  const nested = await import('../src/src/admin/utils/productSpecifications.js')
  assert.deepEqual(nested.PHONE_FIELDS, PHONE_FIELDS)
  const specs = { ramGb: 8, armazenamentoGb: 256, tamanhoTelaPolegadas: 6.7, bateriaMah: 5000, nfc: false }
  assert.equal(nested.specificationDescription(specs, true), specificationDescription(specs, true))
  assert.deepEqual(nested.parseSpecificationReply(JSON.stringify({ especificacoes: specs }), schema).especificacoes, specs)
})
