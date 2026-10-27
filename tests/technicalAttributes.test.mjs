import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isPublicSpec} from '../src/utils/productSpecPresentation.js'
import {normalizeProduct} from '../src/services/normalizers.js'

test('ficha antiga oculta dados de loja e código, mantendo dados técnicos',()=>{
 const rows=[{name:'Material',value_name:'Plástico'},{name:'Cor',value_name:'Preto'},{name:'Compatibilidade',value_name:'HP DeskJet 2136, 2676, 3776'}, {name:'Avaliações de clientes',value_name:'4,7 de 5 estrelas'}, {name:'Ranking dos mais vendidos',value_name:'#1'},{name:'Prazo',value_name:'Amanhã'},{name:'Parcelas',value_name:'12x'}, {name:'Detalhe',value_name:"var dpAcrHasRegisteredArcLinkClickAction; P.when('A').execute(function(A) {});"}]
 const item=normalizeProduct({id:1,nome:'HP 664',categoria:'ACESSORIO',metadados:{informacoesProdutoEncontradas:rows}})
 assert.equal(item.specs.Material,'Plástico')
 assert.equal(item.specs.Compatibilidade,'HP DeskJet 2136, 2676, 3776')
 for(const row of rows.slice(3)) assert.equal(Object.hasOwn(item.specs,row.name),false)
})
test('filtro público mantém false/zero e rejeita avaliação e parcelas mesmo numéricas',()=>{
 for (const [key, value] of [['Rank','Dual Rank'],['IP rating','IP67'],['Power rating','650 W'],['OPERATING_SYSTEM','Linux']]) assert.equal(isPublicSpec(key,value),true)
 assert.equal(isPublicSpec('Duplex',false),true)
 assert.equal(isPublicSpec('Consumo',0),true)
 for(const key of ['Preço','Avaliações de clientes','Customer Reviews','Best Sellers Rank','Parcelas','shippingCost']) assert.equal(isPublicSpec(key,4.7),false)
 assert.equal(isPublicSpec('Material','window.ue.count("click")'),false)
})
