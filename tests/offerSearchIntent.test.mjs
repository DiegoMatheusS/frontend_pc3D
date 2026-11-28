import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {matchesOfferSearch,affiliateUrl} from '../src/admin/utils/offerSearchIntent.js'
const cases=JSON.parse(await readFile(new URL('./fixtures/offer-search-intent.json',import.meta.url),'utf8'))
for(const [query,title,expected] of cases)test(`${query}: ${title}`,()=>assert.equal(matchesOfferSearch(query,title),expected))
test('distingue sufixos Ryzen e números que não representam a capacidade', () => {
  assert.equal(matchesOfferSearch('Ryzen 5 5600G', 'Processador Ryzen 5 5600 G'), true)
  assert.equal(matchesOfferSearch('Ryzen 5 5600', 'Processador Ryzen 5 5600 G'), false)
  assert.equal(matchesOfferSearch('DDR4 16GB', 'Memória RAM DDR4 8GB 3200 MHz CL16'), false)
})
test('links inválidos e com credenciais não são usados como link afiliado',()=>{
 assert.equal(affiliateUrl('javascript:alert(1)'),'')
 assert.equal(affiliateUrl('https://user:pass@loja.example/item'),'')
 assert.equal(affiliateUrl('https://loja.example/item'),'https://loja.example/item')
})
