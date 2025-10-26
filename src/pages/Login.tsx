import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { Link, useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      nav('/dashboard')
    } catch (e: any) {
      setError(e.message || 'Gagal login')
    }
  }

  return (
    <div className="container">
      <div className="card torn">
        <h2 style={{marginTop:0}}>Login</h2>
        <div className="banner">Mau beli token? Hubungi WhatsApp <a href="https://wa.me/6285176932228?text=Halo%20admin%2C%20saya%20ingin%20membeli%20token%20pricelist" target="_blank" rel="noreferrer">6285176932228</a>.</div>
        <form onSubmit={onSubmit}>
          <div style={{marginBottom:8}}>
            <label>Email</label>
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
          </div>
          <div style={{marginBottom:8}}>
            <label>Password</label>
            <div style={{display:'flex', gap:8}}>
              <input className="input" value={password} onChange={e=>setPassword(e.target.value)} type={show?'text':'password'} placeholder="••••••••" required />
              <button type="button" className="btn" onClick={()=>setShow(s=>!s)}>{show?'Hide':'Show'}</button>
            </div>
          </div>
          {error && <div className="banner">{error}</div>}
          <div className="row">
            <button className="btn primary" type="submit">Masuk</button>
            <Link className="btn" to="/register">Daftar</Link>
            <Link className="btn" to="/forgot-password">Lupa Password</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
