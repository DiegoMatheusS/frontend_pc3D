const CONFIGURED_API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

// Em desenvolvimento, URL vazia mantém o proxy /api do Vite.
// Em produção, o CriaByte sempre usa o backend oficial mesmo quando
// VITE_API_BASE_URL não foi configurada no build do frontend.
const API_BASE_URL = CONFIGURED_API_BASE_URL || (import.meta.env.PROD ? 'https://api.criabyte.com.br' : '')

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, url = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.url = url
    this.code = typeof data?.codigo === 'string' ? data.codigo : ''
    this.details = data?.detalhes ?? null
  }
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  const base = API_BASE_URL.replace(/\/api$/i, '')
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  return url.replace(/^http:\/\/(api\.criabyte\.com\.br)(?=\/|$)/i, 'https://$1')
}

async function readResponse(response) {
  const type = response.headers.get('content-type') || ''
  if (response.status === 204) return null
  if (type.includes('application/json')) return response.json()
  return response.text()
}

function getErrorMessage(data, status) {
  if (status === 404 && /Cannot (GET|POST)/i.test(String(data?.mensagem || data?.message || ''))) {
    return 'A rota solicitada não foi encontrada no servidor. Confira a versão publicada do backend e o redirecionamento da API.'
  }
  if (Array.isArray(data?.message)) return data.message.join(' ')
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  if (typeof data?.mensagem === 'string' && data.mensagem.trim()) return data.mensagem
  if (typeof data?.erro?.mensagem === 'string' && data.erro.mensagem.trim()) return data.erro.mensagem
  if (typeof data === 'string' && data.trim()) return data

  if (status === 401) return 'E-mail ou senha incorretos, ou sua sessão expirou.'
  if (status === 403) return 'Você não tem permissão para realizar esta ação.'
  if (status === 409) return 'Já existe um cadastro com estes dados.'
  if (status === 413) return 'Os dados enviados são maiores do que o servidor permite.'
  if (status === 429) return 'Muitas solicitações em pouco tempo. Aguarde um momento e tente novamente.'
  if (status === 503) return 'O serviço está temporariamente indisponível. Tente novamente em instantes.'
  if (status >= 500) return 'O servidor encontrou um problema. Tente novamente.'
  return 'Não foi possível concluir a solicitação.'
}

export async function apiRequest(path, options = {}) {
  const url = buildUrl(path)
  const hasBody = options.body !== undefined && options.body !== null
  const method = String(options.method || 'GET').toUpperCase()

  let response
  try {
    response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      ...options,
      method,
      // Dados do Admin mudam com frequência (arquivar, publicar, descontinuar etc.).
      // Evita que uma navegação de volta reaproveite uma resposta GET antiga.
      cache: options.cache ?? (method === 'GET' ? 'no-store' : undefined),
      body: hasBody && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('Solicitação cancelada.', {
        data: { codigo: 'REQUEST_ABORTED' },
        url,
      })
    }
    throw new ApiError('Não foi possível conectar ao backend.', {
      data: error,
      url,
    })
  }

  let data
  try {
    data = await readResponse(response)
  } catch {
    throw new ApiError('O servidor retornou uma resposta inválida.', { status: response.status, url })
  }
  // Reenvia apenas POST de enriquecimento convertido em GET por redirecionamento,
  // no mesmo endpoint e origem. Não repete erros de processamento nem cadastros.
  const isEnrichment = /\/(?:ia-tecnica|meta-ai-whatsapp)\/enriquecer\/?$/.test(new URL(url, window.location.origin).pathname)
  if (options.redirect !== 'error' && method === 'POST' && isEnrichment && response.redirected && response.status === 404
      && /Cannot GET/i.test(String(data?.mensagem || data?.message || data || ''))) {
    const original = new URL(url, window.location.origin)
    const destination = new URL(response.url)
    if (destination.origin === original.origin && destination.pathname.replace(/\/$/, '') === original.pathname.replace(/\/$/, '')) {
      return apiRequest(destination.href, { ...options, method, redirect: 'error' })
    }
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), {
      status: response.status,
      data,
      url,
    })
  }

  return data
}
