// src/pages/dashboard/Overview.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth, db } from '../../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { formatCurrency } from '../../lib/utils'

type DealDoc = {
  id: string
  clientName?: string
  clientWa?: string
  packageName?: string
  price?: number
  createdAt?: any // Firestore Timestamp | Date
  eventDateText?: string
}

function pickPackageName(d: any): string {
  if (d?.parent && d?.typeName) return `${String(d.parent).toUpperCase()} — ${d.typeName}`
  const name =
    d.packageName ||
    d.packageTitle ||
    d.paket ||
    d.typeName ||
    d.package?.name ||
    d.package?.typeName ||
    d.selectedPackage?.name ||
    d.selectedPackage?.title ||
    d.dealPackage?.name ||
    d.details?.[0]?.name ||
    ''
  if (!name && d?.parent) return String(d.parent).toUpperCase()
  return name
}

function pickTotalPrice(d: any): number {
  const n =
    (typeof d.total === 'number' && d.total) ||
    (typeof d.price === 'number' && d.price) ||
    (typeof d.packagePrice === 'number' && d.packagePrice) ||
    (typeof d.package?.price === 'number' && d.package.price) ||
    0
  return Number(n) || 0
}

function pickEventDateText(d: any): string {
  const t = d.eventType
  if (t === 'wedding' && d.wedding) return d.wedding.date || ''
  if (t === 'lamaran' && d.lamaran) return d.lamaran.date || ''
  if (t === 'prewedding' && d.prewedding) return d.prewedding.date || ''
  return d.eventDate || d.date || d.tanggal || d.scheduleDate || d.dateEvent || ''
}

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0)

export default function Overview() {
  const [deals, setDeals] = useState<DealDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) setUid(u.uid)
      else {
        setUid(null)
        setDeals([])
        setLoading(false)
      }
    })
    return () => unsubAuth()
  }, [])

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    setError(null)

    const qy = query(collection(db, 'deals'), where('uid', '==', uid))
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: DealDoc[] = []
        snap.forEach((dc) => {
          const d = dc.data() as any
          rows.push({
            id: dc.id,
            clientName: d.clientName || d.namaKlien || d.client || '',
            clientWa: d.clientWa || d.wa || d.whatsapp || '',
            packageName: pickPackageName(d),
            price: pickTotalPrice(d),
            createdAt: d.createdAt || null,
            eventDateText: pickEventDateText(d),
          })
        })
        setDeals(rows)
        setLoading(false)
      },
      (err) => {
        console.error('Overview onSnapshot error:', err)
        setError(err?.message || 'Gagal memuat data. Periksa koneksi & Firestore Rules.')
        setLoading(false)
      }
    )

    return () => unsub()
  }, [uid])

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
          Ringkasan klien, tanggal acara, dan paket yang diambil.
        </p>

        {!uid && !loading && (
          <div className="banner" style={{ marginBottom: 8 }}>
            Kamu belum login.
          </div>
        )}

        {error && (
          <div
            className="banner"
            style={{ marginBottom: 8, background: '#fef2f2', color: '#991b1b' }}
          >
            {error}
          </div>
        )}

        {loading && <div className="banner">Memuat data…</div>}

        {!loading && !error && sorted.length === 0 && (
          <div className="banner">Belum ada deal.</div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {sorted.map((d) => (
            <DealRow key={d.id} row={d} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ===== Row dengan Menu Invoice ===== */
function DealRow({ row }: { row: DealDoc }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const created = row.createdAt?.toDate ? row.createdAt.toDate() : row.createdAt ?? null
  const createdStr = created ? new Date(created).toLocaleString('id-ID') : '-'
  const harga = typeof row.price === 'number' ? row.price : 0
  const hasPackage = !!(row.packageName && String(row.packageName).trim())
  const hasDate = !!(row.eventDateText && String(row.eventDateText).trim())

  return (
    <div className="card" style={{ margin: 0 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {/* LEFT */}
        <div>
          <div style={{ fontWeight: 700 }}>
            {row.clientName || '(Tanpa nama klien)'}
          </div>

          {row.clientWa && <div style={{ color: '#444' }}>WA: {row.clientWa}</div>}
          {hasDate && <div style={{ color: '#111' }}>Tanggal: {row.eventDateText}</div>}
          {hasPackage && <div style={{ color: '#666' }}>{row.packageName}</div>}
        </div>

        {/* RIGHT */}
        <div style={{ textAlign: 'right' }}>
          <div className="banner" style={{ display: 'inline-block' }}>
            {typeof formatCurrency === 'function' ? formatCurrency(harga) : rupiah(harga)}
          </div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
            Dibuat: {createdStr}
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
            <Link className="btn" to={`/dashboard/mou/${row.id}`}>MOU</Link>

            {/* Split button Invoice + menu */}
            <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button className="btn" onClick={() => navigate(`/dashboard/invoice/${row.id}`)}>
                Invoice
              </button>
              <button
                className="btn"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                title="Menu Invoice"
                style={{ padding: '0 10px' }}
              >
                ▼
              </button>

              {open && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    minWidth: 220,
                    boxShadow:
                      '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
                    zIndex: 20,
                  }}
                >
                  <button
                    className="btn"
                    style={menuItemStyle}
                    onClick={() => {
                      setOpen(false)
                      navigate(`/dashboard/invoice/${row.id}`)
                    }}
                  >
                    Buka Invoice (deal ini)
                  </button>
                  <button
                    className="btn"
                    style={menuItemStyle}
                    onClick={() => {
                      setOpen(false)
                      navigate(`/dashboard/invoice/new`)
                    }}
                  >
                    Invoice Manual (baru)
                  </button>
                </div>
              )}
            </div>

            <Link className="btn" to={`/dashboard/kuitansi/${row.id}`}>Kuitansi</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  padding: '8px 12px',
  cursor: 'pointer',
}
