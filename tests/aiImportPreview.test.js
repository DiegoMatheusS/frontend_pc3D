import test from 'node:test'
import assert from 'node:assert/strict'
import * as rootContract from '../src/admin/utils/aiImportContract.js'
import * as nestedContract from '../src/src/admin/utils/aiImportContract.js'
import { aiImportOfferRow as rootOfferRow } from '../src/admin/components/AdminMultiOfferEditor.utils.js'
import { aiImportOfferRow as nestedOfferRow } from '../src/src/admin/components/AdminMultiOfferEditor.utils.js'

const listingPayload = {
  nome: 'Computador Gamer Ryzen 5 5600G 16GB RAM SSD 512GB',
  descricao: 'Computador completo, acompanha teclado e mouse.',
  imagemUrl: 'https://loja.example/pc.jpg',
}
const listingOffer = {
  preco: 2399.90, precoAnterior: 2699.90,
  urlOriginal: 'https://shopee.com.br/product/456/123',
  urlAfiliada: 'https://s.shopee.com.br/afiliado',
  parceiroNome: 'Shopee', vendedorNome: 'Loja de computadores', vendedorIdentificador: '456',
}
const fallback = {
  destinoSugerido: 'PC_MONTADO', categoriaDetectada: 'PC_MONTADO',
  urlOrigem: listingOffer.urlOriginal,
  normalizacao: { camposNormalizados: listingPayload },
  ofertaColetada: listingOffer,
}

for (const [name, contract, offerRow] of [
  ['raiz', rootContract, rootOfferRow],
  ['segunda raiz', nestedContract, nestedOfferRow],
]) {
  test(`${name}: cadastrar computador preserva a busca quando a IA retorna campos vazios`, () => {
    const incomplete = contract.normalizeAiResponse({
      destinoSugerido: 'PC_MONTADO', categoriaDetectada: 'PC_MONTADO',
      cadastroSugerido: { payload: { nome: '', descricao: null, imagemUrl: '   ' } },
      ofertaColetada: { preco: null, urlOriginal: '', urlAfiliada: '', vendedorNome: null },
    })
    const transferred = JSON.parse(JSON.stringify(contract.mergeAiImportPreview(fallback, incomplete)))
    const payload = contract.getAiPayload(transferred)
    for (const [key, value] of Object.entries(listingPayload)) assert.equal(payload[key], value)
    assert.equal(transferred.cadastroSugerido.payload.nome, listingPayload.nome)
    assert.equal(transferred.normalizacao.camposNormalizados.nome, listingPayload.nome)
    for (const [key, value] of Object.entries(listingOffer)) assert.equal(contract.getAiOffer(transferred)[key], value)
    const row = offerRow(contract.getAiOffer(transferred), [{ id: 8, nome: 'Shopee', ativo: true }])
    assert.equal(row.parceiroId, '8')
    assert.equal(row.preco, 2399.90)
    assert.equal(row.urlAfiliada, listingOffer.urlAfiliada)
    assert.equal(row.vendedorNome, listingOffer.vendedorNome)
    assert.equal(row.vendedorIdentificador, '456')
  })

  test(`${name}: dados preenchidos da IA continuam tendo prioridade e preservam false/zero`, () => {
    const response = {
      categoriaDetectada: 'PC_MONTADO',
      cadastroSugerido: { payload: { nome: 'Nome detalhado', marca: 'Marca confirmada', publicado: false, portasLivres: 0 } },
      ofertaColetada: { preco: 2299.90, disponivel: false, vendedorNome: 'Loja confirmada' },
    }
    const merged = contract.mergeAiImportPreview(fallback, response)
    const payload = contract.getAiPayload(merged)
    assert.equal(payload.nome, 'Nome detalhado')
    assert.equal(payload.marca, 'Marca confirmada')
    assert.equal(payload.descricao, listingPayload.descricao)
    assert.equal(payload.publicado, false)
    assert.equal(payload.portasLivres, 0)
    assert.equal(contract.getAiOffer(merged).preco, 2299.90)
    assert.equal(contract.getAiOffer(merged).disponivel, false)
  })

  test(`${name}: enriquecimento da página não é apagado por payload parcial ou análise vazia`, () => {
    const response = {
      normalizacao: { camposNormalizados: listingPayload },
      cadastroSugerido: { payload: { nome: null, descricao: '', imagemUrl: '' } },
      resultadoProdutoIa: { payloadParcialBackend: { nome: '', descricao: '' } },
      analise: { produto: { dadosDetectados: { nome: '', descricao: '   ' } } },
    }
    assert.equal(contract.getAiPayload(response).nome, listingPayload.nome)
    assert.equal(contract.getAiPayload(response).descricao, listingPayload.descricao)
    assert.equal(contract.getAiPayload(response).imagemUrl, listingPayload.imagemUrl)
  })

  test(`${name}: oferta preserva URL afiliada existente sem gerar uma URL nova`, () => {
    const offer = contract.getAiOffer({
      ofertaSugerida: listingOffer,
      ofertaColetada: { preco: '', urlAfiliada: '   ', vendedorNome: '', disponivel: false },
    })
    assert.equal(offer.urlAfiliada, listingOffer.urlAfiliada)
    assert.equal(offer.preco, listingOffer.preco)
    assert.equal(offer.vendedorNome, listingOffer.vendedorNome)
    assert.equal(offer.disponivel, false)
    assert.equal(contract.getAiOffer({ ofertaColetada: { urlOriginal: listingOffer.urlOriginal } }).urlAfiliada, '')
  })

  test(`${name}: parceiro é localizado por nome, domínio ou ID e não por substring de domínio`, () => {
    const partners = [{ id: 3, nome: 'Shopee', dominio: 'shopee.com.br', ativo: false }, { id: 8, nome: 'Shopee Brasil', dominio: 'shopee.com.br', ativo: true }]
    assert.equal(offerRow(listingOffer, partners).parceiroId, '8')
    assert.equal(offerRow({ parceiroNome: 'Shopee Brasil' }, partners).parceiroId, '8')
    assert.equal(offerRow({ parceiroId: 19, urlOriginal: listingOffer.urlOriginal }, partners).parceiroId, '19')
    assert.equal(offerRow({ urlOriginal: 'https://shopee.com.br.example/product' }, partners).parceiroId, '')
  })
}
