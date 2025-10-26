import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { formatCurrency } from '../../lib/utils'

type Deal = {
  id: string
  uid: string
  clientName?: string
  clientWa?: string
  address?: string
  packageType?: string
  packageName?: string
  packagePrice?: number
  addonSummary?: { name: string; price: number }[]
  total?: number
  createdAt?: any
  package?: { name?: string; price?: number } | null
  selectedPackage?: { name?: string; price?: number } | null
  dealPackage?: { name?: string; price?: number } | null
}

type Vendor = {
  name?: string
  whatsapp?: string
  address?: string
}

const fmt = (n: number) =>
  typeof formatCurrency === 'function'
    ? formatCurrency(n)
    : `Rp ${Number(n || 0).toLocaleString('id-ID')}`

const pickPkgName = (d: Deal) =>
  d.packageType ||
  d.packageName ||
  d.package?.name ||
  d.selectedPackage?.name ||
  d.dealPackage?.name ||
  ''

const pickPkgPrice = (d: Deal) =>
  (typeof d.packagePrice === 'number' && d.packagePrice) ||
  (typeof d.package?.price === 'number' && d.package?.price) ||
  0

const pickTotal = (d: Deal) => {
  const addons = d.addonSummary || []
  const sub = pickPkgPrice(d) + addons.reduce((s, a) => s + (a.price || 0), 0)
  return typeof d.total === 'number' ? d.total : sub
}

export default function Kuitansi() {
  const { dealId } = useParams()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)

  const [receiptNo, setReceiptNo] = useState('')
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0,10))
  const [amountReceived, setAmountReceived] = useState<number>(0)
  const [note, setNote] = useState('Pembayaran jasa foto sesuai kesepakatan.')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dealId) return
    const unsub = onSnapshot(doc(db, 'deals', dealId), (snap) => {
      if (snap.exists()) setDeal({ id: snap.id, ...(snap.data() as any) })
      else setDeal(null)
    })
    return () => unsub()
  }, [dealId])

  useEffect(() => {
    if (!deal?.uid) return
    const unsub = onSnapshot(doc(db, 'vendors', deal.uid), (snap) => {
      setVendor((snap.data() as any) || null)
    })
    return () => unsub()
  }, [deal?.uid])

  if (deal === null) {
    return (
      <div className="container">
        <div className="card torn">
          <div className="banner">Deal tidak ditemukan.</div>
          <div style={{marginTop:8}}>
            <Link className="btn" to="/dashboard/overview">Kembali</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="container">
        <div className="card torn">
          <div className="banner">Memuat kuitansi…</div>
          <div style={{marginTop:8}}>
            <Link className="btn" to="/dashboard/overview">Kembali</Link>
          </div>
        </div>
      </div>
    )
  }

  const addons = deal.addonSummary || []
  const total = pickTotal(deal)

  const handlePrint = () => window.print()

  return (
    <div className="container">
      <div className="card torn" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <h2 style={{margin:0}}>Kuitansi</h2>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn" onClick={handlePrint}>Print / PDF</button>
          <Link className="btn" to={`/dashboard/overview`}>Kembali ke Overview</Link>
        </div>
      </div>

      {/* Panel pengaturan nomor & nilai diterima */}
      <div className="card" style={{display:'grid',gap:8}}>
        <div className="row">
          <div className="col">
            <label>No. Kuitansi</label>
            <input className="input" value={receiptNo} onChange={e=>setReceiptNo(e.target.value)} placeholder="KW-2025/10/001" />
          </div>
          <div className="col">
            <label>Tanggal</label>
            <input className="input" type="date" value={receiptDate} onChange={e=>setReceiptDate(e.target.value)} />
          </div>
          <div className="col">
            <label>Jumlah diterima</label>
            <input className="input" type="number" min={0} value={amountReceived} onChange={e=>setAmountReceived(Number(e.target.value)||0)} placeholder="500000" />
          </div>
        </div>
        <div>
          <label>Catatan</label>
          <input className="input" value={note} onChange={e=>setNote(e.target.value)} />
        </div>
      </div>

      {/* Kanvas cetak A6 */}
      <div className="card" style={{maxWidth: '105mm', margin:'0 auto'}}>
        <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display:none !important; }
            .a6 { width: 105mm; height: 148mm; padding: 8mm; box-sizing: border-box; }
            .card { box-shadow: none !important; border: 1px solid #ddd; }
          }
        `}</style>

        <div className="a6">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
            <div>
              <div style={{fontWeight:800, fontSize:18}}>{vendor?.name || 'Vendor'}</div>
              {vendor?.address && <div style={{whiteSpace:'pre-wrap'}}>{vendor.address}</div>}
              {vendor?.whatsapp && <div>WA: {vendor.whatsapp}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:800, fontSize:18}}>KUITANSI</div>
              <div>No: <b>{receiptNo || '-'}</b></div>
              <div>Tanggal: <b>{receiptDate || '-'}</b></div>
            </div>
          </div>

          <hr />

          <div style={{marginBottom:8}}>
            <div>Sudah terima dari:</div>
            <div style={{fontWeight:700}}>{deal.clientName || '-'}</div>
            {deal.clientWa && <div>WA: {deal.clientWa}</div>}
          </div>

          <div style={{margin:'8px 0', color:'#111'}}>
            Uang sejumlah: <b>{fmt(amountReceived || 0)}</b>
          </div>
          <div style={{margin:'4px 0', fontSize:13}}>
            Untuk pembayaran: {note || '-'}
          </div>

          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13, marginTop:8}}>
            <tbody>
              <tr>
                <td style={{padding:'6px 4px'}}>Paket</td>
                <td style={{padding:'6px 4px', textAlign:'right'}}>{pickPkgName(deal) || '-'}</td>
              </tr>
              <tr>
                <td style={{padding:'6px 4px'}}>Total Kesepakatan</td>
                <td style={{padding:'6px 4px', textAlign:'right'}}>{fmt(total)}</td>
              </tr>
              <tr>
                <td style={{padding:'6px 4px'}}>Diterima Sekarang</td>
                <td style={{padding:'6px 4px', textAlign:'right'}}>{fmt(amountReceived || 0)}</td>
              </tr>
              <tr>
                <td style={{padding:'6px 4px', borderTop:'1px dashed #e5e7eb'}}><b>Sisa</b></td>
                <td style={{padding:'6px 4px', textAlign:'right', borderTop:'1px dashed #e5e7eb'}}>
                  <b>{fmt(Math.max(0, total - (amountReceived || 0)))}</b>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{marginTop:24, display:'flex', justifyContent:'space-between'}}>
            <div>Penyetor,</div>
            <div>Penerima,</div>
          </div>
        </div>
      </div>
    </div>
  )
}
