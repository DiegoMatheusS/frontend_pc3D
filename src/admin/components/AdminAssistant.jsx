import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { adminService } from '../services/adminService'

function responseText(data) {
  if (typeof data === 'string') return data
  return data?.resposta || data?.mensagem || data?.texto || data?.conteudo || data?.answer || 'Resposta recebida do backend.'
}

export default function AdminAssistant({ open, onClose }) {
  const location = useLocation()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistente', text: 'Posso ajudar a revisar cadastros, organizar dados e explicar o estado do painel.' }])
  const context = useMemo(() => ({ rota: location.pathname, area: 'admin' }), [location.pathname])

  async function send(event) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    const next = [...messages, { role: 'usuario', text }]
    setMessages(next)
    setDraft('')
    setSending(true)
    try {
      const historico = next.slice(-8).map((item) => ({ papel: item.role === 'usuario' ? 'usuario' : 'assistente', conteudo: item.text }))
      const result = await adminService.ai.chat({ mensagem: text, historico, contexto: context })
      setMessages((current) => [...current, { role: 'assistente', text: responseText(result) }])
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistente', text: error?.message || 'A IA administrativa não respondeu.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <aside className="admin-ia-painel" data-aberto={open ? 'true' : 'false'} aria-hidden={!open}>
      <header className="admin-ia-cabecalho"><div className="admin-ia-cabecalho-info"><span className="admin-ia-cabecalho-icone">✦</span><div><strong>Assistente Admin</strong><small>Backend / catálogo</small></div></div><button className="admin-ia-fechar" type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="admin-ia-msgs" aria-live="polite">{messages.map((message,index)=><div key={`${message.role}-${index}`} className={`admin-ia-chat-msg admin-ia-chat-msg--${message.role}`}>{message.text}</div>)}{sending&&<div className="admin-ia-chat-digitando"><span/><span/><span/></div>}</div>
      <form className="admin-ia-entrada" onSubmit={send}><textarea className="admin-ia-textarea" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Pergunte sobre o catálogo..." maxLength={1000}/><button className="admin-ia-enviar" type="submit" disabled={!draft.trim()||sending}>➤</button></form>
    </aside>
  )
}
