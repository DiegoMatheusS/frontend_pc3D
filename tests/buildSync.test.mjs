import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBuildSync } from '../src/services/buildSync.js'
function storage() { const data = new Map(); return { getItem: key => data.get(key), setItem: (key,value) => data.set(key,value) } }
test('build da conta aparece em outro aparelho e rascunho local é migrado', async () => {
  const disk = storage(); const requests = []
  disk.setItem('pcBuilderBuildsSalvas:a%40test', JSON.stringify([{ id: 'local', nome: 'Local' }]))
  const sync = createBuildSync({ storage: disk, request: async (path, options) => { requests.push({path,options}); return options?.method ? { revisao: 1 } : [{ id:'remote', nome:'Outro aparelho', _revisao:1 }] } })
  await sync.connect('a@test')
  const builds = JSON.parse(disk.getItem('pcBuilderBuildsSalvas:a%40test'))
  assert.equal(builds.length, 2)
  assert.equal(requests[1].options.method, 'PUT')
  assert.deepEqual(JSON.parse(disk.getItem('criabyteBuildSync:a%40test')), {})
})
test('falha de rede preserva a fila e exclusão offline não ressuscita a build', async () => {
  const disk = storage(); let offline = false
  const sync = createBuildSync({ storage:disk, request: async (_, options) => { if (offline) throw new Error('offline'); return options?.method ? {} : [{id:'abc', _revisao:1}] } })
  await sync.connect('a@test'); offline = true
  disk.setItem('pcBuilderBuildsSalvas:a%40test','[]')
  sync.enqueue('a@test', [{id:'abc',_revisao:1}], [])
  await sync.flush()
  assert.equal(JSON.parse(disk.getItem('criabyteBuildSync:a%40test')).abc.removed, true)
  offline = false; await sync.connect('a@test')
  assert.deepEqual(JSON.parse(disk.getItem('pcBuilderBuildsSalvas:a%40test')), [])
})
test('trocar de conta não envia a fila antiga com a sessão nova', async () => {
  const disk=storage(); const calls=[]
  const sync=createBuildSync({storage:disk,request:async(path,options)=>{calls.push({path,options});return options?.method?{}:[]}})
  await sync.connect('b@test'); sync.enqueue('a@test',[],[{id:'segredo'}]); await sync.flush()
  assert.equal(calls.filter(row=>row.options?.method).length,0)
})

test('conflito preserva as duas versões e permite guardar a local como outra build', async () => {
  const disk = storage(), key = 'pcBuilderBuildsSalvas:a%40test'
  const original = { id: 'abc', nome: 'Original', configuracao: {}, _revisao: 1 }
  let remote = [original]
  const sync = createBuildSync({ storage: disk, request: async (_, options) => {
    if (!options?.method) return remote
    if (options.body.dados.id === 'abc') { const error = new Error('Alterada em outro aparelho'); error.status = 409; throw error }
    remote = [...remote, { ...options.body.dados, _revisao: 1 }]
    return { revisao: 1 }
  } })
  await sync.connect('a@test')
  remote = [{ ...original, nome: 'Edição de outro aparelho', _revisao: 2 }]
  const local = { ...original, nome: 'Minha edição', configuracao: { processador: { id: 7 } } }
  disk.setItem(key, JSON.stringify([local]))
  sync.enqueue('a@test', [original], [local]); await sync.flush()
  assert.equal(sync.conflicts('a@test').length, 1)
  assert.equal(JSON.parse(disk.getItem(key))[0].nome, 'Minha edição')
  await sync.resolveConflict('a@test', 'abc', 'copy')
  const builds = JSON.parse(disk.getItem(key))
  assert.equal(builds.length, 2)
  assert.equal(builds.find(build => build.id === 'abc').nome, 'Edição de outro aparelho')
  const copy = builds.find(build => build.id !== 'abc')
  assert.equal(copy.nome, 'Minha edição (cópia)')
  assert.equal(copy.configuracao.processador.id, 7)
  assert.equal(sync.conflicts('a@test').length, 0)
  assert.deepEqual(JSON.parse(disk.getItem('criabyteBuildSync:a%40test')), {})
})

test('uma edição feita durante o envio usa a revisão confirmada sem perder alterações', async () => {
  const disk = storage(), key = 'pcBuilderBuildsSalvas:a%40test'
  const original = { id: 'abc', nome: 'Original', _revisao: 1 }
  let acknowledge, started
  const inflight = new Promise(resolve => { started = resolve }), versions = [], names = []
  const sync = createBuildSync({ storage: disk, request: async (_, options) => {
    if (!options?.method) return [original]
    versions.push(options.body.revisao); names.push(options.body.dados.nome)
    if (versions.length === 1) { started(); return new Promise(resolve => { acknowledge = resolve }) }
    return { revisao: 3 }
  } })
  await sync.connect('a@test')
  const first = { ...original, nome: 'Primeira edição' }
  disk.setItem(key, JSON.stringify([first])); sync.enqueue('a@test', [original], [first])
  await inflight
  const latest = { ...first, nome: 'Edição durante o envio' }
  disk.setItem(key, JSON.stringify([latest])); sync.enqueue('a@test', [first], [latest])
  acknowledge({ revisao: 2 }); await sync.flush()
  assert.deepEqual(versions, [1, 2])
  assert.deepEqual(names, ['Primeira edição', 'Edição durante o envio'])
  assert.equal(JSON.parse(disk.getItem(key))[0].nome, latest.nome)
  assert.equal(JSON.parse(disk.getItem(key))[0]._revisao, 3)
})
