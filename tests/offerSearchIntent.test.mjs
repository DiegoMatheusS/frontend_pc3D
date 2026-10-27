import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {matchesOfferSearch,affiliateUrl} from '../src/admin/utils/offerSearchIntent.js'
const cases=JSON.parse(await readFile(new URL('./fixtures/offer-search-intent.json',import.meta.url),'utf8'))
for(const [query,title,expected] of cases)test(`${query}: ${title}`,()=>assert.equal(matchesOfferSearch(query,title),expected))
test('links inválidos e com credenciais não são usados como link afiliado',()=>{
 assert.equal(affiliateUrl('javascript:alert(1)'),'')
 assert.equal(affiliateUrl('https://user:pass@loja.example/item'),'')
 assert.equal(affiliateUrl('https://loja.example/item'),'https://loja.example/item')
})
