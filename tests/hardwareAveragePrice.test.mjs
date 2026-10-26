import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync(new URL('../public/legacy-builder/js/api.js',import.meta.url),'utf8').replace(/^import .*;$/m,'').replace('export const api','const api').replaceAll('import.meta.url', JSON.stringify('https://criabyte.example/api.js'))
const context=vm.createContext({URL,console,window:{location:{origin:'https://criabyte.example'}}})
vm.runInContext(source+'\nglobalThis.normalize=normalizarHardwareParaBuilder;',context)
const base={id:1,nome:'RAM Kingston',categoria:'MEMORIA_RAM',mediaPrecoHardware:'199.90'}
test('preço médio serve de estimativa sem inventar oferta ou link',()=>{
 const p=context.normalize(base)
 assert.equal(p.preco,199.9);assert.equal(p.precoEstimado,true);assert.equal(p.linkCompra,'')
 assert.equal(p.precoIndisponivel,false)
})
test('oferta ativa prevalece sobre a estimativa',()=>{
 const p=context.normalize({...base,ofertas:[{preco:179.9,status:'ATIVA',parceiro:{ativo:true},urlAfiliada:'https://loja.example/oferta'}]})
 assert.equal(p.preco,179.9);assert.equal(p.precoEstimado,false);assert.equal(p.linkCompra,'https://loja.example/oferta')
})
test('ausência, zero e valores inválidos permanecem sem preço',()=>{
 for(const mediaPrecoHardware of [null,'',0,-1,'inválido']){
  const p=context.normalize({...base,mediaPrecoHardware});assert.equal(p.preco,null);assert.equal(p.precoEstimado,false)
 }
})
