/*
 * O formulário de Produtos renderiza novos editores de ofertas após um setState.
 * Capturar o clique ANTES do onClick do React garante a contagem correta dos
 * editores anteriores e permite rolar exatamente até a nova oferta.
 */
export function installAutoScrollOfferEditor() {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('.admin-offer-heading-actions button')
    if (!button || button.disabled || button.textContent?.trim() !== '+ Oferta') return

    const form = button.closest('.admin-form-card')
    if (!form) return
    const editorContainer = form.querySelector('.admin-offer-editors')
    const previousCount = editorContainer?.querySelectorAll('.admin-offer-editor').length || 0
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let observer
    let stopTimer
    let finished = false
    const tryScroll = () => {
      if (finished) return
      const editors = form.querySelectorAll('.admin-offer-editor')
      if (editors.length <= previousCount) return
      const newest = editors[editors.length - 1]
      finished = true
      observer?.disconnect()
      window.clearTimeout(stopTimer)
      newest.style.scrollMarginTop = '110px'
      newest.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      const firstField = newest.querySelector('select, input, textarea')
      if (firstField) {
        window.setTimeout(() => {
          if (document.contains(firstField) && (document.activeElement === button || document.activeElement === document.body)) {
            firstField.focus({ preventScroll: true })
          }
        }, reduceMotion ? 0 : 220)
      }
    }

    observer = new MutationObserver(tryScroll)
    observer.observe(form, { childList: true, subtree: true })
    window.requestAnimationFrame(tryScroll)
    stopTimer = window.setTimeout(() => observer.disconnect(), 1200)
  }, { capture: true })
}
