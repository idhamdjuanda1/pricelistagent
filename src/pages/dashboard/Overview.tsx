import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { auth, db } from '../../lib/firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { formatCurrency } from '../../lib/utils'

type DealDoc = {
  id: string
  clientName?: string
  packageName?: string
  price?: number
  createdAt?: any // Firestore Timestamp | Date
}

export default function Overview() {
  const [deals, setDeals] = useState<DealDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return

    // Ganti 'deals' bila nama koleksi kamu berbeda
    const q = query(collection(db, 'deals'), where('uid', '==', user.uid))

    const unsub = onSnapshot(q, (snap) => {
      const rows: DealDoc[] = []
      snap.forEach((doc) => {
        const d = doc.data() as any
        rows.push({
          id: doc.id,
          clientName: d.clientName || d.namaKlien || d.client || '',
          packageName: d.packageName || d.paket || d.typeName || '',
          price:
            typeof d.total === 'number'
              ? d.total
              : typeof d.price === 'number'
              ? d.price
              : 0,
          createdAt: d.createdAt || null,
        })
      })
      setDeals(rows)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const sorted = useMemo(() => {
    return [...deals].sort((a, b) => {
      const ta = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : a.createdAt?.getTime?.() ?? 0
      const tb = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : b.createdAt?.getTime?.() ?? 0
      return tb - ta
    })
  }, [deals])

  return (
    <div className="container">
      <div className="card torn">
        <h2 style={{ marginTop: 0 }}>Overview — Deals</h2>
        <p style={{ marginTop: 0, color: '#666' }}>
          Riwayat deal terbaru (milik akun ini).
        </p>

        {loading && <div className="banner">Memuat data…</div>}

        {!loading && sorted.length === 0 && (
          <div className="banner">Belum ada deal.</div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {sorted.map((d) => {
            const created = d.createdAt?.toDate
              ? d.createdAt.toDate()
              : d.createdAt ?? null
            const createdStr = created ? new Date(created).toLocaleString() : '-'
            const harga = typeof d.price === 'number' ? d.price : 0

            return (
              <div key={d.id} className="card" style={{ margin: 0 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {d.clientName || '(Tanpa nama klien)'}
                    </div>
                    <div style={{ color: '#666' }}>
                      {d.packageName || '(Tanpa paket)'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="banner" style={{ display: 'inline-block' }}>
                      {formatCurrency
                        ? formatCurrency(harga)
                        : `Rp ${harga.toLocaleString('id-ID')}`}
                    </div>

                    <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
                      {createdStr}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        display: 'flex',
                        gap: 6,
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Link className="btn" to={`/dashboard/mou/${d.id}`}>
                        MOU
                      </Link>
                      <Link className="btn" to={`/dashboard/invoice/${d.id}`}>
                        Invoice
                      </Link>
                      <Link className="btn" to={`/dashboard/kuitansi/${d.id}`}>
                        Kuitansi
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
