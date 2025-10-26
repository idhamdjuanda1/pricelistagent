import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../lib/firebase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      await sendPasswordResetEmail(auth, email)
      setMsg('Cek email untuk tautan reset password.')
    } catch (e: any) {
      setMsg(e.message || 'Gagal kirim email.')
    }
  }

  return (
    <div className="container">
      <div className="card torn">
        <h2 style={{marginTop:0}}>Lupa Password</h2>
        <form onSubmit={onSubmit}>
          <div style={{marginBottom:8}}>
            <label>Email</label>
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
          </div>
          <button className="btn primary" type="submit">Kirim</button>
        </form>
        {msg && <div className="banner" style={{marginTop:8}}>{msg}</div>}
      </div>
    </div>
  )
}
