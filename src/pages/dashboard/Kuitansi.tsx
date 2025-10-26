// src/pages/dashboard/Kuitansi.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'

type Term = {
  label: string
  dueDate?: string
  amount: number
  paidAmount?: number
}

type Deal = {
  id: string
  uid: string
  clientName?: string
  clientWa?: string
  address?: string
  eventType?: 'wedding' | 'lamaran' | 'prewedding' | ''
  parent?: string
  typeName?: string
  packageType?: string
  packageName?: string
  createdAt?: any
}

type Vendor = {
  name?: string
  whatsapp?: string
  address?: string
  npwp?: string
  email?: string
}

type InvoiceDoc = {
  uid: string
  dealId?: string
  clientName?: string
  clientWa?: string
  address?: string
  eventDesc?: string
  invoiceNo: string
  invoiceDate: string
  dueDate?: string
  terms: Term[]
  total: number
  createdAt?: any
  updatedAt?: any
}

type ReceiptItem = {
  label: string
  amount: number
}

type ReceiptDoc = {
  uid: string
  dealId?: string
  invoiceId?: string
  receiptNo: string
  receiptDate: string
  note?: string
  payerName?: string
  payerWa?: string
  address?: string
  items: ReceiptItem[]
  total: number
  createdAt?: any
  updatedAt?: any
}

type PayRow = { label: string; termIdx?: number; payNow: number; dueDate?: string }

type InvoiceListItem = {
  id: string
  invoiceNo: string
  clientName: string
  invoiceDate?: string
  total: number
  createdAt?: any
}

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0)

export default function Kuitansi() {
  const { dealId } = useParams()
  const uid = auth.currentUser?.uid || ''

  // Mode Manual
  const [manualMode, setManualMode] = useState<boolean>(() => !dealId || dealId === 'new')

  // Data deal & vendor (mode normal)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)

  // Header kuitansi
  const [receiptNo, setReceiptNo] = useState<string>('KW-2025/10/001')
  const [receiptDate, setReceiptDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState<string>('Pembayaran sesuai term.')

  // Data klien (manual)
  const [mClientName, setMClientName] = useState<string>('')
  const [mClientWa, setMClientWa] = useState<string>('')
  const [mAddress, setMAddress] = useState<string>('')

  // Invoice picker
  const [invoiceId, setInvoiceId] = useState<string>('')   // id dokumen di /invoices
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null)
  const [invList, setInvList] = useState<InvoiceListItem[]>([])
  const [loadingInv, setLoadingInv] = useState<boolean>(false)

  // Term yang dibayar pada kuitansi ini
  const [payItems, setPayItems] = useState<PayRow[]>([])

  /* -------- Load Deal (mode normal) -------- */
  useEffect(() => {
    if (!dealId || manualMode) return
    const unsub = onSnapshot(doc(db, 'deals', dealId), (snap) => {
      if (snap.exists()) setDeal({ id: snap.id, ...(snap.data() as any) })
      else setDeal(null)
    })
    return () => unsub()
  }, [dealId, manualMode])

  /* -------- Load Vendor dari deal.uid -------- */
  useEffect(() => {
    if (!deal?.uid) return
    const unsub = onSnapshot(doc(db, 'vendors', deal.uid), (snap) => {
      setVendor((snap.data() as any) || null)
    })
    return () => unsub()
  }, [deal?.uid])

  /* -------- Auto-load invoice {dealId} saat mode normal -------- */
  useEffect(() => {
    const tryLoad = async () => {
      if (manualMode) return
      if (!dealId) return
      const ref = doc(db, 'invoices', dealId)
      const s = await getDoc(ref)
      if (s.exists()) {
        const inv = s.data() as InvoiceDoc
        setInvoice(inv)
        setInvoiceId(dealId)
        const arr: PayRow[] = (inv.terms || []).map((t, i) => ({
          label: t.label || `Term ${i + 1}`,
          termIdx: i,
          payNow: Math.max((t.amount || 0) - (t.paidAmount || 0), 0),
          dueDate: t.dueDate,
        }))
        setPayItems(arr)
        if (!mClientName) setMClientName(inv.clientName || '')
        if (!mClientWa) setMClientWa(inv.clientWa || '')
        if (!mAddress) setMAddress(inv.address || '')
      }
    }
    tryLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, manualMode])

  /* -------- Daftar semua invoice milik user (dropdown) -------- */
  useEffect(() => {
    if (!uid) return
    setLoadingInv(true)
    const qy = query(collection(db, 'invoices'), where('uid', '==', uid))
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: InvoiceListItem[] = []
        snap.forEach((dc) => {
          const d = dc.data() as Partial<InvoiceDoc>
          rows.push({
            id: dc.id,
            invoiceNo: d.invoiceNo || '-',
            clientName: d.clientName || '-',
            invoiceDate: d.invoiceDate,
            total: Number(d.total || 0),
            createdAt: (d as any)?.createdAt || undefined,
          })
        })
        rows.sort((a, b) => {
          const ta = (a.createdAt?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0) as number
          const tb = (b.createdAt?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0) as number
          return tb - ta
        })
        setInvList(rows)
        setLoadingInv(false)
      },
      (err) => {
        console.error('load invoices error:', err)
        setInvList([])
        setLoadingInv(false)
      }
    )
    return () => unsub()
  }, [uid])

  /* -------- Loader invoice by id (dipakai oleh dropdown & tombol) -------- */
  const loadInvoiceById = async (id?: string) => {
    const targetId = (id ?? invoiceId).trim()
    if (!targetId) {
      alert('Pilih/isi Invoice terlebih dahulu.')
      return
    }
    try {
      const ref = doc(db, 'invoices', targetId)
      const s = await getDoc(ref)
      if (!s.exists()) {
        alert('Invoice tidak ditemukan.')
        return
      }
      const inv = s.data() as InvoiceDoc
      setInvoice(inv)
      setInvoiceId(targetId)
      const arr: PayRow[] = (inv.terms || []).map((t, i) => ({
        label: t.label || `Term ${i + 1}`,
        termIdx: i,
        payNow: Math.max((t.amount || 0) - (t.paidAmount || 0), 0),
        dueDate: t.dueDate,
      }))
      setPayItems(arr)
      if (!mClientName) setMClientName(inv.clientName || '')
      if (!mClientWa) setMClientWa(inv.clientWa || '')
      if (!mAddress) setMAddress(inv.address || '')
    } catch (e: any) {
      alert('Gagal memuat invoice: ' + (e?.message || 'unknown'))
    }
  }

  const sumPaidNow = useMemo(
    () => payItems.reduce((s, r) => s + (Number(r.payNow) || 0), 0),
    [payItems]
  )

  /* -------- Simpan kuitansi + update paidAmount terms invoice -------- */
  const saveReceipt = async () => {
    const _uid = auth.currentUser?.uid
    if (!_uid) {
      alert('Harus login.')
      return
    }

    const items: ReceiptItem[] = payItems
      .filter((r) => Number(r.payNow) > 0)
      .map((r) => ({ label: r.label, amount: Number(r.payNow) || 0 }))

    const payload: ReceiptDoc = {
      uid: _uid,
      dealId: manualMode ? undefined : dealId,
      invoiceId: invoiceId || undefined,
      receiptNo,
      receiptDate,
      note: note || undefined,
      payerName: manualMode ? (mClientName || undefined) : (invoice?.clientName || undefined),
      payerWa: manualMode ? (mClientWa || undefined) : (invoice?.clientWa || undefined),
      address: manualMode ? (mAddress || undefined) : (invoice?.address || undefined),
      items,
      total: sumPaidNow,
    }

    try {
      // 1) Simpan receipt ke receipts/{autoId}
      const ref = await addDoc(collection(db, 'receipts'), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // 2) Jika ada invoiceId, update paidAmount per-term di invoices/{invoiceId}
      if (invoiceId) {
        const invRef = doc(db, 'invoices', invoiceId)
        const invSnap = await getDoc(invRef)
        if (invSnap.exists()) {
          const inv = invSnap.data() as InvoiceDoc
          const nextTerms = (inv.terms || []).map((t, i) => {
            const delta = payItems.find((r) => r.termIdx === i)?.payNow || 0
            return {
              ...t,
              paidAmount: Math.max(0, (t.paidAmount || 0) + Number(delta || 0)),
            }
          })
          await setDoc(
            invRef,
            { terms: nextTerms, updatedAt: serverTimestamp() },
            { merge: true }
          )
        }
      }

      alert(`Kuitansi tersimpan (ID: ${ref.id}).`)
    } catch (e: any) {
      alert('Gagal menyimpan kuitansi: ' + (e?.message || 'unknown'))
    }
  }

  const printReceiptOnly = () => window.print()

  /* ----------------- UI ----------------- */
  if (!manualMode) {
    if (deal === null) {
      return (
        <div className="container">
          <div className="card torn">
            <div className="banner">Deal tidak ditemukan.</div>
            <div style={{ marginTop: 8 }}>
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
            <div style={{ marginTop: 8 }}>
              <Link className="btn" to="/dashboard/overview">Kembali</Link>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="container">
      {/* Toolbar */}
      <div className="card torn no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <h2 style={{ margin:0 }}>Kuitansi</h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <label style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input
              type="checkbox"
              checked={manualMode}
              onChange={(e) => setManualMode(e.target.checked)}
            />
            Mode Manual
          </label>
          <button className="btn" onClick={saveReceipt}>Simpan Kuitansi</button>
          <button className="btn" onClick={printReceiptOnly}>Print / PDF</button>
          <Link className="btn" to={`/dashboard/overview`}>Kembali</Link>
        </div>
      </div>

      {/* Header */}
      <div className="card no-print" style={{ display:'grid', gap:8 }}>
        <div className="row">
          <div className="col">
            <label>No. Kuitansi</label>
            <input className="input" value={receiptNo} onChange={(e)=>setReceiptNo(e.target.value)} />
          </div>
          <div className="col">
            <label>Tanggal</label>
            <input className="input" type="date" value={receiptDate} onChange={(e)=>setReceiptDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label>Catatan</label>
          <input className="input" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Pembayaran sesuai term." />
        </div>
      </div>

      {/* Data klien (manual) */}
      {manualMode && (
        <div className="card no-print" style={{ display:'grid', gap:8 }}>
          <h3 style={{ margin:0 }}>Data Klien (Manual)</h3>
          <div className="row">
            <div className="col">
              <label>Nama Klien</label>
              <input className="input" value={mClientName} onChange={(e)=>setMClientName(e.target.value)} />
            </div>
            <div className="col">
              <label>WA Klien</label>
              <input className="input" value={mClientWa} onChange={(e)=>setMClientWa(e.target.value)} />
            </div>
          </div>
          <div>
            <label>Alamat</label>
            <textarea className="textarea" value={mAddress} onChange={(e)=>setMAddress(e.target.value)} />
          </div>
        </div>
      )}

      {/* Ambil dari Invoice (opsional) */}
      <div className="card no-print" style={{ display:'grid', gap:8 }}>
        <h3 style={{ margin:0 }}>Ambil dari Invoice (opsional)</h3>

        <div className="row" style={{ alignItems:'flex-end' }}>
          <div className="col">
            <label>Pilih Invoice</label>
            <select
              className="input"
              value={invoiceId}
              onChange={(e) => {
                const id = e.target.value
                setInvoiceId(id)
                if (id) loadInvoiceById(id)
              }}
            >
              <option value="">{loadingInv ? 'Memuat daftar…' : '— Pilih salah satu —'}</option>
              {invList.map((iv) => (
                <option key={iv.id} value={iv.id}>
                  {iv.invoiceNo || '(Tanpa nomor)'} — {iv.clientName || '-'}
                  {iv.invoiceDate ? ` — ${iv.invoiceDate}` : ''} — {rupiah(iv.total)}
                </option>
              ))}
            </select>
            <small style={{ color:'#666' }}>
              Berisi semua invoice milik akun kamu (termasuk invoice manual).
            </small>
          </div>

          <div className="col" style={{ display:'flex', gap:8 }}>
            <button className="btn" onClick={() => loadInvoiceById()}>
              Muat Invoice
            </button>
            <Link className="btn" to="/dashboard/invoice/new">Buat Invoice Manual</Link>
          </div>
        </div>

        {invoice && (
          <div className="banner" style={{ background:'#f1f5f9', color:'#0f172a' }}>
            <div><b>{invoice.clientName || '-'}</b> • WA: {invoice.clientWa || '-'}</div>
            {invoice.address && <div style={{ whiteSpace:'pre-wrap' }}>{invoice.address}</div>}
            <div>
              No: {invoice.invoiceNo || '-'} • Tanggal: {invoice.invoiceDate || '-'}
              {invoice.dueDate ? ` • Jatuh Tempo: ${invoice.dueDate}` : ''}
            </div>
          </div>
        )}
      </div>

      {/* Terms yang dibayar sekarang */}
      <div className="card no-print" style={{ display:'grid', gap:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0 }}>Term yang Dibayar</h3>
          <button
            className="btn"
            onClick={() => setPayItems((t) => [...t, { label: `Term ${t.length + 1}`, payNow: 0 }])}
          >
            Tambah Baris
          </button>
        </div>

        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 4px' }}>Label</th>
              <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 4px' }}>Jatuh Tempo</th>
              <th style={{ textAlign:'right', borderBottom:'1px solid #e5e7eb', padding:'6px 4px', width:160 }}>Bayar Sekarang</th>
              <th style={{ width:80, borderBottom:'1px solid #e5e7eb' }} />
            </tr>
          </thead>
          <tbody>
            {payItems.map((r, i) => (
              <tr key={i}>
                <td style={{ padding:'6px 4px' }}>
                  <input
                    className="input"
                    value={r.label}
                    onChange={(e)=>setPayItems((arr)=>arr.map((x,idx)=>idx===i?{...x,label:e.target.value}:x))}
                    placeholder="Term 1 / DP / Pelunasan"
                  />
                </td>
                <td style={{ padding:'6px 4px' }}>
                  <input
                    className="input"
                    type="date"
                    value={r.dueDate || ''}
                    onChange={(e)=>setPayItems((arr)=>arr.map((x,idx)=>idx===i?{...x,dueDate:e.target.value}:x))}
                  />
                </td>
                <td style={{ padding:'6px 4px', textAlign:'right' }}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={r.payNow}
                    onChange={(e)=>setPayItems((arr)=>arr.map((x,idx)=>idx===i?{...x,payNow:Number(e.target.value)||0}:x))}
                  />
                </td>
                <td style={{ textAlign:'center' }}>
                  <button
                    className="btn"
                    onClick={()=>setPayItems((arr)=>arr.filter((_,idx)=>idx!==i))}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding:'6px 4px', textAlign:'right' }}><b>Total Kuitansi</b></td>
              <td style={{ padding:'6px 4px', textAlign:'right' }}><b>{rupiah(sumPaidNow)}</b></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Kartu cetak A6 */}
      <div id="receipt-print" className="card" style={{ maxWidth:'105mm', margin:'0 auto' }}>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #receipt-print, #receipt-print * { visibility: visible; }
            #receipt-print { position: absolute; left: 0; top: 0; width: 105mm; }
            .card { box-shadow: none !important; border: 1px solid #ddd; }
          }
        `}</style>

        <div style={{ padding:'8mm', boxSizing:'border-box' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:18 }}>{vendor?.name || 'Vendor'}</div>
              {vendor?.address && <div style={{ whiteSpace:'pre-wrap' }}>{vendor.address}</div>}
              {vendor?.whatsapp && <div>WA: {vendor.whatsapp}</div>}
              {vendor?.email && <div>Email: {vendor.email}</div>}
              {vendor?.npwp && <div>NPWP: {vendor?.npwp}</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:800, fontSize:18 }}>KUITANSI</div>
              <div>No: <b>{receiptNo || '-'}</b></div>
              <div>Tanggal: <b>{receiptDate || '-'}</b></div>
            </div>
          </div>

          <hr />

          <div style={{ marginBottom:8 }}>
            <div>Sudah terima dari:</div>
            <div style={{ fontWeight:700 }}>
              {(manualMode ? mClientName : (invoice?.clientName || '')) || '-'}
            </div>
            {(manualMode ? mAddress : (invoice?.address || '')) && (
              <div style={{ whiteSpace:'pre-wrap' }}>
                {manualMode ? mAddress : (invoice?.address as string)}
              </div>
            )}
            {(manualMode ? mClientWa : (invoice?.clientWa || '')) && (
              <div>WA: {manualMode ? mClientWa : invoice?.clientWa}</div>
            )}
          </div>

          <div style={{ margin:'8px 0', fontStyle:'italic', color:'#555' }}>
            {note || 'Pembayaran sesuai term.'}
          </div>

          {payItems.length > 0 && (
            <>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 4px' }}>Term</th>
                    <th style={{ textAlign:'left', borderBottom:'1px solid #e5e7eb', padding:'6px 4px' }}>Jatuh Tempo</th>
                    <th style={{ textAlign:'right', borderBottom:'1px solid #e5e7eb', padding:'6px 4px' }}>Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {payItems.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding:'6px 4px' }}>{r.label}</td>
                      <td style={{ padding:'6px 4px' }}>{r.dueDate || '-'}</td>
                      <td style={{ padding:'6px 4px', textAlign:'right' }}>{rupiah(r.payNow || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ padding:'6px 4px', textAlign:'right' }}><b>Total</b></td>
                    <td style={{ padding:'6px 4px', textAlign:'right' }}><b>{rupiah(sumPaidNow)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          <div style={{ marginTop:24, display:'flex', justifyContent:'space-between' }}>
            <div>Penyetor,</div>
            <div>Penerima,</div>
          </div>
        </div>
      </div>
    </div>
  )
}
