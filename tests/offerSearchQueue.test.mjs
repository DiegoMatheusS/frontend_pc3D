import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createOfferSearchQueue} from '../src/admin/utils/offerSearchQueue.js'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
test('produtos diferentes pesquisam juntos e a fila avança após sucesso ou erro',async()=>{
 const queue=createOfferSearchQueue(3),started=[],finish=[]
 const jobs=[0,1,2,3,4].map(id=>queue.run(()=>new Promise((resolve,reject)=>{started.push(id);finish[id]={resolve,reject}})).then(value=>({id,value}),error=>({id,error:error.message})))
 await tick();assert.deepEqual(started,[0,1,2])
 finish[1].reject(new Error('Loja indisponível'));await tick();assert.deepEqual(started,[0,1,2,3])
 finish[0].resolve('produto 0');await tick();assert.deepEqual(started,[0,1,2,3,4])
 finish[2].resolve('produto 2');finish[3].resolve('produto 3');finish[4].resolve('produto 4')
 const results=await Promise.all(jobs)
 assert.equal(results[1].error,'Loja indisponível');assert.equal(results[4].value,'produto 4')
})
