import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AuthProvider from './contexts/AuthProvider'
import './styles/tokens.css'
import './index.css'
import './styles/disable-public-ai-assistant.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx'
import { installAutoScrollOfferEditor } from './admin/utils/autoScrollOfferEditor'

const temaSalvo = localStorage.getItem('pcBuilderTema')
if (temaSalvo === 'dark' || temaSalvo === 'light') {
  document.documentElement.dataset.theme = temaSalvo
}

// A marca deve ser o único texto exibido na aba do navegador, inclusive no admin.
// Metadados de SEO/compartilhamento continuam podendo ter títulos descritivos.
const enforceBrowserTitle = () => {
  if (document.title !== 'CriaByte') document.title = 'CriaByte'
}
enforceBrowserTitle()
new MutationObserver(enforceBrowserTitle).observe(document.head, {
  childList: true,
  subtree: true,
  characterData: true,
})

installAutoScrollOfferEditor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
