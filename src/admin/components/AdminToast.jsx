/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AdminToastContext = createContext(null)

export function AdminToastProvider({ children }) {
  const [items, setItems] = useState([])

  const show = useCallback((message, type = 'sucesso') => {
    const id = `${Date.now()}-${Math.random()}`
    setItems((current) => [...current, { id, message, type }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 3800)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      <div className="admin-toast-region" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`admin-toast ${item.type}`}>{item.message}</div>
        ))}
      </div>
    </AdminToastContext.Provider>
  )
}

export function useAdminToast() {
  return useContext(AdminToastContext) || { show: () => {} }
}
