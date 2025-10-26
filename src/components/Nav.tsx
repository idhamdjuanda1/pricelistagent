import { Link, useNavigate, useLocation } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'

export default function Nav() {
  const [user, setUser] = useState(() => auth.currentUser)
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUser(u))
    return () => unsub()
  }, [])

  const logout = async () => {
    await signOut(auth)
    nav('/login')
  }

  const showNav = !loc.pathname.startsWith('/publish/')
  if (!showNav) return null

  return (
    <div className="nav">
      <div className="brand"><Link to="/">Pricelist Interaktif</Link></div>
      <div className="nav-actions">
        {user ? (
          <>
            <Link className="btn" to="/dashboard">Dashboard</Link>
            <button className="btn" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link className="btn" to="/login">Login</Link>
            <Link className="btn" to="/register">Daftar</Link>
          </>
        )}
      </div>
    </div>
  )
}
