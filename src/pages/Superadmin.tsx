import { useEffect, useState } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { makeToken } from '../lib/utils'

type TokenRow = {
  token: string
  status: 'idle' | 'used' | 'expired'
  duration: 'daily' | 'weekly' | 'monthly'
  uid?: string
  usedAt?: any
  createdAt?: any
}

const env = import.meta.env as any
function getSuperPass(): string {
  return env.VITE_SUPERADMIN_PASSWORD || env.NEXT_PUBLIC_SUPERADMIN_PASSWORD || env.SUPERADMIN_PASSWORD || ''
}

export default function Superadmin() {
  const [ok, setOk] = useState(false)
  const [pw, setPw] = useState('')
  const [duration, setDuration] = useState<'daily'|'weekly'|'monthly'>('daily')
  const [count, setCount] = useState(1)
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [accounts, setAccounts] = useState<Array<{ uid: string; vendorName: string; expiresAt?: number }>>([])

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'tokenStore'), orderBy('createdAt', 'desc'), limit(200)), snap => {
      const arr: TokenRow[] = []
      snap.forEach(d => arr.push(d.data() as any))
      setTokens(arr)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!ok) return
    // Anonymous sign-in to satisfy tokenStore rules without asking email/password
    if (!auth.currentUser) { signInAnonymously(auth).catch(()=>{}) }

    // Subscribe tokens and map to vendor names
    const unsubTokens = onSnapshot(collection(db, 'tokens'), snap => {
      const next: Array<{ uid: string; vendorName: string; expiresAt?: number }> = []
      snap.forEach(d => {
        const data = d.data() as any
        next.push({ uid: d.id, vendorName: '', expiresAt: data?.expiresAt?.toMillis?.() })
      })
      next.forEach((row, idx) => {
        onSnapshot(doc(db, 'vendors', row.uid), vsnap => {
          const vd = vsnap.data() as any
          next[idx].vendorName = vd?.name || '(Tanpa Nama)'
          setAccounts([...next])
        })
      })
      setAccounts(next)
    })
    return () => { unsubTokens() }
  }, [ok])

  const doAuth = () => {
    const expected = getSuperPass()
    if (!expected) { alert('ENV VITE_SUPERADMIN_PASSWORD kosong.'); return }
    setOk(pw === expected)
    if (pw !== expected) alert('Password salah.')
  }

  const createTokens = async () => {
    // anonymous auth is handled automatically; no email/password login required.
    for (let i=0;i<count;i++) {
      const token = makeToken(16)
      const ref = doc(db, 'tokenStore', token)
      await setDoc(ref, { token, status: 'idle', duration, createdAt: serverTimestamp() } as any, { merge: true })
    }
    alert('Token dibuat.')
  }

  if (!ok) {
    return (
      <div className="container">
        <div className="card torn">
          <h2 style={{marginTop:0}}>Superadmin</h2>
          <p>Halaman ini tidak ada di navbar. Masukkan password lokal.</p>
          <div className="row">
            <div className="col">
              <input className="input" type="password" placeholder="Password Superadmin" value={pw} onChange={e=>setPw(e.target.value)} />
            </div>
            <div><button className="btn primary" onClick={doAuth}>Masuk</button></div>
          </div>
        </div>
      </div>
    )
  }

  const activeCount = accounts.filter(a => !!a.expiresAt && a.expiresAt > Date.now()).length
  const inactiveCount = accounts.length - activeCount

  return (
    <div className="container">
      <div className="card torn">
        <h2 style={{marginTop:0}}>Superadmin — Token Store</h2>
        <div className="row">
          <div className="col">
            <label>Durasi</label>
            <select className="select" value={duration} onChange={e=>setDuration(e.target.value as any)}>
              <option value="daily">harian (1 hari)</option>
              <option value="weekly">mingguan (7 hari)</option>
              <option value="monthly">bulanan (30 hari)</option>
            </select>
          </div>
          <div className="col">
            <label>Jumlah token</label>
            <input className="input" type="number" min={1} max={50} value={count} onChange={e=>setCount(Math.max(1, Math.min(50, Number(e.target.value||1))))} />
          </div>
          <div style={{alignSelf:'end'}}>
            <button className="btn primary" onClick={createTokens}>Generate</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Daftar Token</h3>
        <div className="row" style={{fontWeight:700}}>
          <div className="col">Token</div>
          <div className="col">Duration</div>
          <div className="col">Status</div>
          <div className="col">UID</div>
          <div className="col">Used At</div>
        </div>
        {tokens.map((t, idx) => (
          <div key={idx} className="row" style={{alignItems:'center', borderTop: '1px dashed var(--muted)', paddingTop:6, marginTop:6}}>
            <div className="col" style={{fontFamily:'monospace'}}>{t.token}</div>
            <div className="col">{t.duration}</div>
            <div className="col"><span className="badge">{t.status}</span></div>
            <div className="col">{t.uid || '—'}</div>
            <div className="col">{t.usedAt?.toDate?.().toLocaleString?.('id-ID') || '—'}</div>
          </div>
        ))}
        {tokens.length === 0 && <div>(belum ada)</div>}
      </div>

      <div className="card">
        <h3>Aktivitas Akun</h3>
        <div className="banner">Aktif: <b>{activeCount}</b> | Tidak aktif: <b>{inactiveCount}</b></div>
        <div className="row" style={{fontWeight:700}}>
          <div className="col">UID</div>
          <div className="col">Nama Vendor</div>
          <div className="col">Status</div>
          <div className="col">Expires At</div>
        </div>
        {accounts.map((a, idx) => {
          const active = !!a.expiresAt && a.expiresAt > Date.now()
          return (
            <div key={idx} className="row" style={{alignItems:'center', borderTop:'1px dashed var(--muted)', paddingTop:6, marginTop:6}}>
              <div className="col" style={{fontFamily:'monospace'}}>{a.uid}</div>
              <div className="col">{a.vendorName}</div>
              <div className="col"><span className="badge">{active ? 'aktif' : 'tidak aktif'}</span></div>
              <div className="col">{a.expiresAt ? new Date(a.expiresAt).toLocaleString('id-ID') : '—'}</div>
            </div>
          )
        })}
        {accounts.length === 0 && <div>(belum ada token user)</div>}
      </div>
    </div>
  )
}
