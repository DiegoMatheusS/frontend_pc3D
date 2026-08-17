import { useEffect, useRef, useState } from 'react'
import './GoogleAuthButton.css'

const GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client'
let googleScriptPromise = null

function loadGoogleIdentityServices() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Auth indisponível neste ambiente.'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_GSI_SRC}"]`)
    const script = existing || document.createElement('script')

    const finish = () => {
      if (window.google?.accounts?.id) resolve(window.google)
      else reject(new Error('Não foi possível carregar o Google Identity Services.'))
    }

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o Google Identity Services.')), { once: true })
      if (window.google?.accounts?.id) finish()
      return
    }

    script.src = GOOGLE_GSI_SRC
    script.async = true
    script.defer = true
    script.dataset.googleIdentityServices = 'true'
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => reject(new Error('Não foi possível carregar o Google Identity Services.')), { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    googleScriptPromise = null
    throw error
  })

  return googleScriptPromise
}

export default function GoogleAuthButton({ mode = 'login', onCredential, onError }) {
  const buttonRef = useRef(null)
  const credentialHandlerRef = useRef(onCredential)
  const errorHandlerRef = useRef(onError)
  const [status, setStatus] = useState('loading')

  useEffect(() => { credentialHandlerRef.current = onCredential }, [onCredential])
  useEffect(() => { errorHandlerRef.current = onError }, [onError])

  useEffect(() => {
    let cancelled = false
    const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()

    if (!clientId) {
      setStatus('missing')
      return undefined
    }

    setStatus('loading')

    loadGoogleIdentityServices()
      .then((google) => {
        if (cancelled || !buttonRef.current) return

        google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          context: mode === 'register' ? 'signup' : 'signin',
          callback: async (response) => {
            const credential = String(response?.credential || '').trim()
            if (!credential) {
              errorHandlerRef.current?.(new Error('O Google não retornou uma credencial válida.'))
              return
            }

            try {
              await credentialHandlerRef.current?.(credential)
            } catch (error) {
              errorHandlerRef.current?.(error)
            }
          },
        })

        buttonRef.current.replaceChildren()
        const width = Math.min(400, Math.max(240, Math.floor(buttonRef.current.clientWidth || 320)))
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          logo_alignment: 'left',
          width,
          locale: 'pt-BR',
        })
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setStatus('error')
        errorHandlerRef.current?.(error)
      })

    return () => {
      cancelled = true
    }
  }, [mode])

  return (
    <div className="google-auth-control">
      <div className="google-auth-control__button" ref={buttonRef} aria-busy={status === 'loading'} />
      {status === 'loading' ? <small>Carregando Google…</small> : null}
      {status === 'missing' ? <small>Configure VITE_GOOGLE_CLIENT_ID para habilitar o Google.</small> : null}
      {status === 'error' ? <small>Google indisponível no momento.</small> : null}
    </div>
  )
}
