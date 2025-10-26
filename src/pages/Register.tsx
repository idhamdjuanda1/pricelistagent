import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import { Link, useNavigate } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'vendors', cred.user.uid), {
        name: 'Vendor Baru',
        address: '',
        whatsapp: '',
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolder: ''
      }, { merge: true })
      nav('/dashboard')
    } catch (e: any) {
      setError(e.message || 'Gagal daftar')
    }
  }

  return (
    <div className="container">
      <div className="card torn">
        <h2 style={{marginTop:0}}>Daftar</h2>
        <div className="banner">Akun baru akan terkunci sampai aktivasi token. Beli token via WhatsApp <a href="https://wa.me/6285176932228?text=Halo%20admin%2C%20saya%20ingin%20membeli%20token%20pricelist" target="_blank" rel="noreferrer">6285176932228</a>.</div>
        <form onSubmit={onSubmit}>
          <div style={{marginBottom:8}}>
            <label>Email</label>
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
          </div>
          <div style={{marginBottom:8}}>
            <label>Password</label>
            <div style={{display:'flex', gap:8}}>
              <input className="input" value={password} onChange={e=>setPassword(e.target.value)} type={show?'text':'password'} placeholder="Minimal 6 karakter" required />
              <button type="button" className="btn" onClick={()=>setShow(s=>!s)}>{show?'Hide':'Show'}</button>
            </div>
          </div>
          {error && <div className="banner">{error}</div>}
          <div className="row">
            <button className="btn primary" type="submit">Buat Akun</button>
            <Link className="btn" to="/login">Sudah punya akun?</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
