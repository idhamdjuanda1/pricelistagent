import { useEffect, useState } from 'react'
import { auth } from '../lib/firebase'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(() => auth.currentUser)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => { setUser(u); setReady(true) })
    return () => unsub()
  }, [])

  if (!ready) return <div className="container"><div className="card">Memuat…</div></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
