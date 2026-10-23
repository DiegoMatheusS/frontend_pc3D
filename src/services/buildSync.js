export function createBuildSync({ request, storage, changed = () => {} }) {
  let owner = null
  let pending = Promise.resolve()
  const queueKey = email => `criabyteBuildSync:${encodeURIComponent(email)}`
  const buildsKey = email => `pcBuilderBuildsSalvas:${encodeURIComponent(email)}`
  const read = (key, fallback) => { try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback } catch { return fallback } }
  function enqueue(email, previous, next) {
    if (email !== owner) return
    const queue = read(queueKey(email), {})
    const before = new Map(previous.map(build => [build.id, build]))
    const after = new Map(next.map(build => [build.id, build]))
    for (const build of next) if (JSON.stringify(build) !== JSON.stringify(before.get(build.id))) queue[build.id] = { build, version: build._revisao }
    for (const build of previous) if (!after.has(build.id)) queue[build.id] = { removed: true, version: build._revisao }
    storage.setItem(queueKey(email), JSON.stringify(queue))
    void flush(email)
  }
  function flush(email = owner) {
    if (!email || email !== owner) return Promise.resolve()
    pending = pending.catch(() => {}).then(async () => {
      const queue = read(queueKey(email), {})
      for (const [id, operation] of Object.entries(queue)) {
        if (owner !== email) return
        try {
          const result = await request(`/api/builds-pessoais/${encodeURIComponent(id)}`, operation.removed
            ? { method: 'DELETE', headers: { 'X-CriaByte-Account': email }, body: { ...(operation.version ? { revisao: operation.version } : {}) } }
            : { method: 'PUT', headers: { 'X-CriaByte-Account': email }, body: { dados: operation.build, ...(operation.version ? { revisao: operation.version } : {}) } })
          const current = read(queueKey(email), {})
          const unchanged = JSON.stringify(current[id]) === JSON.stringify(operation)
          if (unchanged) delete current[id]
          if (!operation.removed) {
            const builds = read(buildsKey(email), [])
            storage.setItem(buildsKey(email), JSON.stringify(builds.map(build => build.id === id ? { ...build, _revisao: result.revisao } : build)))
            if (current[id]) current[id].version = result.revisao
          }
          storage.setItem(queueKey(email), JSON.stringify(current))

          changed(email)
        } catch (error) {
          if (error.status === 409) {
            const current = read(queueKey(email), {})
            if (current[id]) current[id].conflict = true
            storage.setItem(queueKey(email), JSON.stringify(current))
            changed(email, error.message)
            continue
          }
          changed(email, error.message)
          break
        }
      }
    })
    return pending
  }
  async function connect(email) {
    owner = email ? String(email).trim().toLowerCase() : null
    if (!owner) return
    const target = owner
    try {
      const remote = await request('/api/builds-pessoais', { headers: { 'X-CriaByte-Account': target } })
      if (owner !== target) return
      const local = read(buildsKey(target), [])
      const dirty = read(queueKey(target), {})
      const merged = new Map(remote.map(build => [build.id, build]))
      for (const build of local) {
        if (!merged.has(build.id)) { merged.set(build.id, build); dirty[build.id] ??= { build, version: build._revisao } }
        else if (dirty[build.id]) merged.set(build.id, build)
      }
      for (const [id, operation] of Object.entries(dirty)) if (operation.removed) merged.delete(id)
      storage.setItem(buildsKey(target), JSON.stringify([...merged.values()]))
      storage.setItem(queueKey(target), JSON.stringify(dirty))
      changed(target)
      await flush(target)
    } catch (error) { if (owner === target) changed(target, error.message) }
  }
  function conflicts(email) {
    return Object.entries(read(queueKey(email), {})).filter(([, operation]) => operation.conflict)
      .map(([id, operation]) => ({ id, nome: operation.build?.nome || 'Build excluída neste aparelho', removed: Boolean(operation.removed) }))
  }
  async function resolveConflict(email, id, mode) {
    if (email !== owner) throw new Error('Entre novamente para resolver a sincronização.')
    const remote = await request('/api/builds-pessoais', { headers: { 'X-CriaByte-Account': email } })
    if (email !== owner) return
    const queue = read(queueKey(email), {})
    const operation = queue[id]
    if (!operation?.conflict) return
    const local = read(buildsKey(email), [])
    const merged = local.filter(build => build.id !== id)
    const original = remote.find(build => build.id === id)
    if (original) merged.push(original)
    if (mode === 'copy' && !operation.removed) {
      const source = local.find(build => build.id === id) || operation.build
      const copy = { ...source, id: crypto.randomUUID(), nome: `${source.nome || 'Minha build'} (cópia)`.slice(0, 200), atualizadaEm: new Date().toISOString() }
      delete copy._revisao
      merged.unshift(copy)
      queue[copy.id] = { build: copy }
    } else if (mode !== 'remote') throw new Error('Escolha como resolver esta build.')
    delete queue[id]
    storage.setItem(buildsKey(email), JSON.stringify(merged))
    storage.setItem(queueKey(email), JSON.stringify(queue))
    changed(email)
    await flush(email)
  }
  return { connect, enqueue, flush, conflicts, resolveConflict }
}
