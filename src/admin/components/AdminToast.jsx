/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const AdminToastContext = createContext(null)

const TOAST_META = {
  sucesso: { icon: '✓', title: 'Concluído' },
  erro: { icon: '!', title: 'Não foi possível concluir' },
  alerta: { icon: '!', title: 'Atenção' },
  info: { icon: 'i', title: 'Informação' },
}

export function AdminToastProvider({ children }) {
  const [items, setItems] = useState([])
  const nextToastId = useRef(0)

  const show = useCallback((message, type = 'sucesso') => {
    nextToastId.current += 1
    const id = `admin-toast-${nextToastId.current}`
    const normalizedType = TOAST_META[type] ? type : 'info'
    setItems((current) => [...current, { id, message, type: normalizedType }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4200)
  }, [])

  const dismiss = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div className="admin-toast-region" aria-live="polite" aria-atomic="false">
        {items.map((item) => {
          const meta = TOAST_META[item.type]
          return <div key={item.id} className={`admin-toast ${item.type}`} role={item.type === 'erro' ? 'alert' : 'status'}>
            <span className="admin-toast-icon" aria-hidden="true">{meta.icon}</span>
            <span className="admin-toast-copy"><strong>{meta.title}</strong><span>{item.message}</span></span>
            <button className="admin-toast-close" type="button" onClick={() => dismiss(item.id)} aria-label="Fechar mensagem">×</button>
          </div>
        })}
      </div>
    </AdminToastContext.Provider>
  )
}

export function useAdminToast() {
  return useContext(AdminToastContext) || { show: () => {} }
}
