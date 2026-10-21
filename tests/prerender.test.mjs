import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderProduct } from '../scripts/prerender-public.mjs'
test('página do produto já contém conteúdo, canonical e metadados antes do JavaScript', () => {
  const html=renderProduct('<html><head><title>Home</title><link rel="canonical" href="https://criabyte.com.br"></head><body><div id="root"></div></body></html>',{slug:'pc-gamer',nome:'PC Gamer',descricao:'Configuração 16GB',especificacoes:{ram:'16 GB'}})
  assert.match(html, /<h1>PC Gamer<\/h1>/); assert.match(html,/og:title/); assert.match(html,/canonical/); assert.match(html,/16 GB/)
  assert.match(html, /<title>PC Gamer \| CriaByte<\/title>/)
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1)
})
test('conteúdo do catálogo não injeta HTML, script ou URLs perigosas', () => {
  const html=renderProduct('<head></head><div id="root"></div>',{slug:'pc',nome:'PC " teste',descricao:'</script><script>alert(1)</script>',imagemUrl:'javascript:alert(1)'})
  assert.doesNotMatch(html,/<script>alert|javascript:/)
  assert.throws(()=>renderProduct('',{slug:'../index'}),/Slug inválido/)
})
