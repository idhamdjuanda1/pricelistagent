import { useState } from 'react'
import { db, auth } from '../lib/firebase'
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { tokenToId } from '../lib/utils'

function daysFor(duration: string): number {
  if (duration === 'daily') return 1
  if (duration === 'weekly') return 7
  if (duration === 'monthly') return 30
  throw new Error('Unknown duration: ' + duration)
}

export default function TokenActivation() {
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const activate = async () => {
    setMsg(null)
    const user = auth.currentUser
    if (!user) { setMsg('Harus login dulu.'); return }
    const tokenId = tokenToId(token)
    if (!tokenId) { setMsg('Masukkan token.'); return }
    setLoading(true)
    try {
      const tokenRef = doc(db, 'tokenStore', tokenId)
      const snap = await getDoc(tokenRef)
      if (!snap.exists()) { setMsg('Token tidak ditemukan.'); return }
      const data = snap.data() as any
      if (data.status !== 'idle') { setMsg('Token sudah digunakan / tidak idle.'); return }
      const duration = data.duration as 'daily'|'weekly'|'monthly'
      const addDays = daysFor(duration)

      const now = Timestamp.now()
      const userTokenRef = doc(db, 'tokens', user.uid)
      const userSnap = await getDoc(userTokenRef)
      let base = now
      if (userSnap.exists()) {
        const cur = userSnap.data() as any
        if (cur.expiresAt && cur.expiresAt.toMillis && cur.expiresAt.toMillis() > now.toMillis()) {
          base = cur.expiresAt
        }
      }
      const newExp = Timestamp.fromMillis(base.toMillis() + addDays * 24 * 60 * 60 * 1000)

      await setDoc(tokenRef, { status: 'used', uid: user.uid, usedAt: serverTimestamp() }, { merge: true })
      await setDoc(userTokenRef, { uid: user.uid, expiresAt: newExp, lastExtendedAt: serverTimestamp() }, { merge: true })
      setMsg(`Aktivasi sukses. Berlaku hingga: ${new Date(newExp.toMillis()).toLocaleString('id-ID')}`)
      setToken('')
    } catch (e: any) {
      console.error(e)
      setMsg(e.message || 'Gagal aktivasi token.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card torn">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Token Activation (opsional)</h3>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="col">
          <input className="input" placeholder="Masukkan token" value={token} onChange={e => setToken(e.target.value)} />
        </div>
        <div><button className="btn primary" onClick={activate} disabled={loading}>Aktifkan</button></div>
      </div>
      {msg && <div className="banner" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
