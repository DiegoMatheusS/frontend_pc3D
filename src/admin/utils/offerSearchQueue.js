// Limita trabalho simultâneo sem bloquear os outros produtos da lista.
export function createOfferSearchQueue(limit = 3) {
  let active = 0
  const waiting = []
  function pump() {
    while (active < limit && waiting.length) {
      const { work, resolve, reject } = waiting.shift()
      active++
      Promise.resolve().then(work).then(resolve, reject).finally(() => { active--; pump() })
    }
  }
  return { run(work) { return new Promise((resolve, reject) => { waiting.push({ work, resolve, reject }); pump() }) } }
}
