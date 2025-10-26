import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

type Addon = { name: string; price: number }
type Term = { label: string; dueDate?: string; amount: number; paidAmount?: number }
type Deal = {
  id: string
  uid: string
  clientName?: string
  clientWa?: string
  address?: string
  parent?: string
  typeName?: string
  packageType?: string
  packageName?: string
  packagePrice?: number
  addonSummary?: Addon[]
  total?: number
  eventType?: 'wedding' | 'lamaran' | 'prewedding' | ''
  wedding?: { date?: string; akadTime?: string; akadPlace?: string; resepsiTime?: string; resepsiPlace?: string } | null
  lamaran?: { date?: string; time?: string; place?: string } | null
  prewedding?: { date?: string; place?: string } | null
  package?: { name?: string; price?: number; typeName?: string } | null
  selectedPackage?: { name?: string; title?: string; price?: number } | null
  dealPackage?: { name?: string; price?: number } | null
  createdAt?: any
}

type Vendor = { name?: string; whatsapp?: string; address?: string; npwp?: string; email?: string }
type InvoiceDoc = { dealId: string; invoiceNo: string; invoiceDate: string; dueDate?: string; terms: Term[]; total: number }

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const pickPkgName = (d: Deal) =>
  (d.parent && d.typeName && `${String(d.parent).toUpperCase()} — ${d.typeName}`) ||
  d.packageType || d.packageName || d.package?.name || d.package?.typeName ||
  d.selectedPackage?.name || d.selectedPackage?.title || d.dealPackage?.name || ''

const pickPkgPrice = (d: Deal) =>
  (typeof d.packagePrice === 'number' && d.packagePrice) ||
  (typeof d.package?.price === 'number' && d.package?.price) ||
  (typeof d.selectedPackage?.price === 'number' && d.selectedPackage?.price) ||
  (typeof d.dealPackage?.price === 'number' && d.dealPackage?.price) ||
  0

export default function Invoice() {
  const { dealId } = useParams()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)

  // Header invoice
  const [invoiceNo, setInvoiceNo] = useState('INV-2025/10/001')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')

  // Terms (cicilan)
  const [terms, setTerms] = useState<Term[]>([])

  // ---- Ambil data Deal & Vendor
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

  // ---- Ambil/isi Invoice {dealId} (supaya term muncul)
  useEffect(() => {
    if (!dealId) return
    const unsub = onSnapshot(doc(db, 'invoices', dealId), (snap) => {
      if (snap.exists()) {
        const inv = snap.data() as InvoiceDoc
        setInvoiceNo(inv.invoiceNo || '')
        setInvoiceDate(inv.invoiceDate || new Date().toISOString().slice(0,10))
        setDueDate(inv.dueDate || '')
        setTerms(Array.isArray(inv.terms) ? inv.terms : [])
      } else {
        // default 2 term (bisa diedit user)
        const total = calcTotal()
        const t1 = Math.round(total * 0.5)
        setTerms([
          { label: 'Term 1', dueDate: '', amount: t1, paidAmount: 0 },
          { label: 'Term 2', dueDate: '', amount: total - t1, paidAmount: 0 },
        ])
      }
    })
    return () => unsub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  const addons = deal?.addonSummary || []
  const subTotal = (deal ? pickPkgPrice(deal) : 0) + addons.reduce((s, a) => s + (a.price || 0), 0)
  const calcTotal = () => (typeof deal?.total === 'number' ? deal!.total! : subTotal) || 0
  const total = calcTotal()

  const eventLine = useMemo(() => {
    if (!deal) return ''
    const t = deal.eventType
    if (t === 'wedding' && deal.wedding) {
      const w = deal.wedding
      return `Wedding — ${w.date || '-'} | Akad ${w.akadTime || '-'} @ ${w.akadPlace || '-'} | Resepsi ${w.resepsiTime || '-'} @ ${w.resepsiPlace || '-'}`
    }
    if (t === 'lamaran' && deal.lamaran) {
      const l = deal.lamaran
      return `Lamaran — ${l.date || '-'} ${l.time ? `(${l.time})` : ''} @ ${l.place || '-'}`
    }
    if (t === 'prewedding' && deal.prewedding) {
      const p = deal.prewedding
      return `Prewedding — ${p.date || '-'} @ ${p.place || '-'}`
    }
    return (deal.parent || pickPkgName(deal) || '').toString().toUpperCase()
  }, [deal])

  // ====== HANDLERS ======
  const addTerm = () => setTerms((t) => [...t, { label: `Term ${t.length + 1}`, amount: 0, paidAmount: 0 }])
  const updateTerm = (i: number, p: Partial<Term>) => setTerms((t) => t.map((row, idx) => (idx === i ? { ...row, ...p } : row)))
  const removeTerm = (i: number) => setTerms((t) => t.filter((_, idx) => idx !== i))

  const sumTerms = terms.reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const sumPaid = terms.reduce((s, t) => s + (Number(t.paidAmount) || 0), 0)
  const diff = total - sumTerms

  const saveInvoice = async () => {
    if (!dealId) return
    const payload: InvoiceDoc = {
      dealId,
      invoiceNo,
      invoiceDate,
      dueDate: dueDate || undefined,
      terms: terms.map((t) => ({
        label: t.label || 'Term',
        dueDate: t.dueDate || undefined,
        amount: Number(t.amount) || 0,
        paidAmount: Number(t.paidAmount) || 0,
      })),
      total,
    }
    await setDoc(doc(db, 'invoices', dealId), { ...payload, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true })
    alert('Invoice (termasuk terms) tersimpan.')
  }

  const printInvoiceOnly = () => window.print()

  if (deal === null) {
    return (
      <div className="container">
        <div className="card torn">
          <div className="banner">Deal tidak ditemukan.</div>
          <div style={{ marginTop: 8 }}><Link className="btn" to="/dashboard/overview">Kembali</Link></div>
        </div>
      </div>
    )
  }
  if (!deal) {
    return (
      <div className="container">
        <div className="card torn">
          <div className="banner">Memuat invoice…</div>
          <div style={{ marginTop: 8 }}><Link className="btn" to="/dashboard/overview">Kembali</Link></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      {/* ---- Toolbar ---- */}
      <div className="card torn no-print" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <h2 style={{margin:0}}>Invoice</h2>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn" onClick={saveInvoice}>Simpan</button>
          <button className="btn" onClick={printInvoiceOnly}>Print / PDF</button>
          <Link className="btn" to={`/dashboard/overview`}>Kembali ke Overview</Link>
        </div>
      </div>

      {/* ---- Header fields ---- */}
      <div className="card no-print" style={{display:'grid',gap:8}}>
        <div className="row">
          <div className="col">
            <label>No. Invoice</label>
            <input className="input" value={invoiceNo} onChange={(e)=>setInvoiceNo(e.target.value)} />
          </div>
          <div className="col">
            <label>Tanggal Invoice</label>
            <input className="input" type="date" value={invoiceDate} onChange={(e)=>setInvoiceDate(e.target.value)} />
          </div>
          <div className="col">
            <label>Jatuh Tempo (opsional)</label>
            <input className="input" type="date" value={dueDate} onChange={(e)=>setDueDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ---- TERMS (ini yang sebelumnya belum muncul) ---- */}
      <div className="card no-print" style={{display:'grid',gap:8}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Invoice Terms</h3>
          <button className="btn" onClick={addTerm}>Tambah Term</button>
        </div>

        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 4px'}}>Label</th>
              <th style={{textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 4px'}}>Jatuh Tempo</th>
              <th style={{textAlign:'right', borderBottom:'1px solid #e5e7eb', padding:'6px 4px', width:160}}>Nominal</th>
              <th style={{textAlign:'right', borderBottom:'1px solid #e5e7eb', padding:'6px 4px', width:160}}>Sudah Dibayar</th>
              <th style={{ borderBottom:'1px solid #e5e7eb', width:80 }}></th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t, i) => (
              <tr key={i}>
                <td style={{padding:'6px 4px'}}>
                  <input className="input" value={t.label} onChange={(e)=>updateTerm(i,{label:e.target.value})} />
                </td>
                <td style={{padding:'6px 4px'}}>
                  <input className="input" type="date" value={t.dueDate || ''} onChange={(e)=>updateTerm(i,{dueDate:e.target.value})} />
                </td>
                <td style={{padding:'6px 4px', textAlign:'right'}}>
                  <input className="input" type="number" min={0} value={t.amount} onChange={(e)=>updateTerm(i,{amount:Number(e.target.value)||0})} />
                </td>
                <td style={{padding:'6px 4px', textAlign:'right'}}>
                  <input className="input" type="number" min={0} value={t.paidAmount || 0} onChange={(e)=>updateTerm(i,{paidAmount:Number(e.target.value)||0})} />
                </td>
                <td style={{textAlign:'center'}}>
                  <button className="btn" onClick={()=>removeTerm(i)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{padding:'6px 4px', textAlign:'right'}}><b>Jumlah Term</b></td>
              <td style={{padding:'6px 4px', textAlign:'right'}}><b>{rupiah(sumTerms)}</b></td>
              <td style={{padding:'6px 4px', textAlign:'right'}}>{rupiah(sumPaid)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={2} style={{padding:'6px 4px', textAlign:'right'}}>Total Kesepakatan</td>
              <td style={{padding:'6px 4px', textAlign:'right'}}>{rupiah(total)}</td>
              <td colSpan={2}></td>
            </tr>
            {Math.abs(diff) > 0 && (
              <tr>
                <td colSpan={2} style={{padding:'6px 4px', textAlign:'right', color:'#b45309'}}>Selisih (Term vs Total)</td>
                <td style={{padding:'6px 4px', textAlign:'right', color:'#b45309'}}>{rupiah(diff)}</td>
                <td colSpan={2}></td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* ---- KARTU INVOICE A6 (PRINT-ONLY AREA) ---- */}
      <div id="invoice-print" className="card" style={{ maxWidth: '105mm', margin: '0 auto' }}>
        <style>{`
          /* PRINT HANYA KARTU INVOICE INI */
          @media print {
            body * { visibility: hidden; }
            #invoice-print, #invoice-print * { visibility: visible; }
            #invoice-print { position: absolute; left: 0; top: 0; width: 105mm; }
            .card { box-shadow: none !important; border: 1px solid #ddd; }
          }
        `}</style>

        <div style={{ padding: '8mm', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{vendor?.name || 'Vendor'}</div>
              {vendor?.address && <div style={{ whiteSpace: 'pre-wrap' }}>{vendor.address}</div>}
              {vendor?.whatsapp && <div>WA: {vendor.whatsapp}</div>}
              {vendor?.email && <div>Email: {vendor.email}</div>}
              {vendor?.npwp && <div>NPWP: {vendor.npwp}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>INVOICE</div>
              <div>No: <b>{invoiceNo || '-'}</b></div>
              <div>Tanggal: <b>{invoiceDate || '-'}</b></div>
              {dueDate && <div>Jatuh Tempo: <b>{dueDate}</b></div>}
            </div>
          </div>

          <hr />

          <div style={{ marginBottom: 8 }}>
            <div>Kepada Yth:</div>
            <div style={{ fontWeight: 700 }}>{deal.clientName || '-'}</div>
            {deal.address && <div style={{ whiteSpace: 'pre-wrap' }}>{deal.address}</div>}
            {deal.clientWa && <div>WA: {deal.clientWa}</div>}
          </div>

          <div style={{ margin: '8px 0', fontStyle: 'italic', color: '#555' }}>
            {eventLine || pickPkgName(deal)}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '6px 4px' }}>Deskripsi</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '6px 4px', width: 120 }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '6px 4px' }}>Paket: <b>{pickPkgName(deal) || '-'}</b></td>
                <td style={{ padding: '6px 4px', textAlign: 'right' }}>{rupiah(pickPkgPrice(deal))}</td>
              </tr>
              {(addons || []).map((a, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 4px' }}>Add-on: {a.name}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{rupiah(a.price || 0)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '6px 4px', borderTop: '1px dashed #e5e7eb' }}><b>Sub-total</b></td>
                <td style={{ padding: '6px 4px', textAlign: 'right', borderTop: '1px dashed #e5e7eb' }}><b>{rupiah(subTotal)}</b></td>
              </tr>
              {total !== subTotal && (
                <tr>
                  <td style={{ padding: '6px 4px' }}>Penyesuaian</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{rupiah(total - subTotal)}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '6px 4px' }}><b>Total</b></td>
                <td style={{ padding: '6px 4px', textAlign: 'right' }}><b>{rupiah(total)}</b></td>
              </tr>
            </tbody>
          </table>

          {/* RINGKASAN TERMS DI CETAKAN */}
          {terms.length > 0 && (
            <>
              <div style={{ marginTop: 8, fontWeight: 700 }}>Terms</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '6px 4px' }}>Term</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '6px 4px' }}>Jatuh Tempo</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '6px 4px' }}>Nominal</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '6px 4px' }}>Dibayar</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 4px' }}>{t.label}</td>
                      <td style={{ padding: '6px 4px' }}>{t.dueDate || '-'}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right' }}>{rupiah(t.amount || 0)}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right' }}>{rupiah(t.paidAmount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: '#555' }}>
            Pembayaran dapat dilakukan via transfer ke rekening yang diinformasikan oleh vendor.
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <div>Penerima,</div>
            <div>Hormat kami,</div>
          </div>
        </div>
      </div>
    </div>
  )
}
