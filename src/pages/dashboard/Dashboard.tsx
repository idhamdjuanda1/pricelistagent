import { useEffect, useState } from 'react'
import { auth, db } from '../../lib/firebase'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  query, setDoc, updateDoc, where
} from 'firebase/firestore'
import TokenActivation from '../../components/TokenActivation'
import { formatCurrency } from '../../lib/utils'

type Vendor = {
  name: string; address: string; whatsapp: string;
  bankName: string; bankAccountNumber: string; bankAccountHolder: string;
}
type Package = { id?: string; uid: string; parent: string; typeName: string; details: string[]; price: number }
type Addon = { id?: string; uid: string; name: string; price: number }
type Discount = { text: string; enabled: boolean }

export default function Dashboard() {
  const user = auth.currentUser
  const uid = user?.uid || ''

  const [vendor, setVendor] = useState<Vendor>({
    name: '', address: '', whatsapp: '',
    bankName: '', bankAccountNumber: '', bankAccountHolder: ''
  })
  const [vMsg, setVMsg] = useState<string | null>(null)

  const [pkgs, setPkgs] = useState<Package[]>([])
  const [formPkg, setFormPkg] = useState({ parent: '', typeName: '', price: '', details: '' })
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null)

  const [addons, setAddons] = useState<Addon[]>([])
  const [formAdd, setFormAdd] = useState({ name: '', price: '' })
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null)
  const [editAddonForm, setEditAddonForm] = useState({ name: '', price: '' })

  const [disc, setDisc] = useState<Discount>({ text: '', enabled: false })

  const [activeUntil, setActiveUntil] = useState<number | null>(null)
  const isActive = activeUntil != null && activeUntil > Date.now()

  // URL publik (auto-detect HashRouter vs BrowserRouter)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const useHash =
    typeof window !== 'undefined' &&
    window.location.hash.startsWith('#/')
  const base = `${origin}/${useHash ? '#/' : ''}`
  const publishUrl = `${base}publish/${uid}`
  const dealUrl = `${base}deal/${uid}`

  // ===== Subscriptions =====
  useEffect(() => {
    if (!uid) return

    // Vendor
    const unsubV = onSnapshot(doc(db, 'vendors', uid), snap => {
      const d = snap.data() as any
      if (d) setVendor({
        name: d.name || '', address: d.address || '', whatsapp: d.whatsapp || '',
        bankName: d.bankName || '', bankAccountNumber: d.bankAccountNumber || '', bankAccountHolder: d.bankAccountHolder || ''
      })
    })

    // Packages
    const unsubP = onSnapshot(
      query(collection(db, 'packages'), where('uid', '==', uid)),
      (snap) => {
        const items: Package[] = []
        snap.forEach(d => items.push({ id: d.id, ...(d.data() as any) }))
        items.sort((a,b) => {
          const pa = (a.parent||''); const pb = (b.parent||'')
          if (pa !== pb) return pa.localeCompare(pb)
          return (a.typeName||'').localeCompare(b.typeName||'')
        })
        setPkgs(items)
      }
    )

    // Add-ons
    const unsubA = onSnapshot(
      query(collection(db, 'addons'), where('uid', '==', uid)),
      (snap) => {
        const items: Addon[] = []
        snap.forEach(d => items.push({ id: d.id, ...(d.data() as any) }))
        items.sort((a,b)=> (a.name||'').localeCompare(b.name||''))
        setAddons(items)
      }
    )

    // Discount
    const unsubD = onSnapshot(doc(db, 'discounts', uid), snap => {
      const d = snap.data() as any
      if (d) setDisc({ text: d.text || '', enabled: !!d.enabled })
    })

    // Token
    const unsubT = onSnapshot(doc(db, 'tokens', uid), snap => {
      const d = snap.data() as any
      if (d?.expiresAt?.toMillis) setActiveUntil(d.expiresAt.toMillis())
      else setActiveUntil(null)
    })

    return () => { unsubV(); unsubP(); unsubA(); unsubD(); unsubT() }
  }, [uid])

  // ===== Actions: Vendor =====
  const saveVendor = async () => {
    if (!uid) return
    await setDoc(doc(db, 'vendors', uid), vendor, { merge: true })
    setVMsg('Profil vendor tersimpan.')
    setTimeout(() => setVMsg(null), 2000)
  }

  // ===== Actions: Packages =====
  const createPkg = async () => {
    if (!uid) return
    const payload: Package = {
      uid,
      parent: formPkg.parent.trim().toLowerCase(),
      typeName: formPkg.typeName.trim().toLowerCase(),
      price: Number(formPkg.price || 0),
      details: formPkg.details.split('\n').map(s => s.trim()).filter(Boolean)
    }
    await addDoc(collection(db, 'packages'), payload as any)
    setFormPkg({ parent: '', typeName: '', price: '', details: '' })
  }

  const startEditPkg = (p: Package) => {
    setEditingPkgId(p.id!)
    setFormPkg({
      parent: p.parent,
      typeName: p.typeName,
      price: String(p.price || 0),
      details: (p.details || []).join('\n')
    })
  }

  const updatePkg = async (id: string) => {
    const payload = {
      parent: formPkg.parent.trim().toLowerCase(),
      typeName: formPkg.typeName.trim().toLowerCase(),
      price: Number(formPkg.price || 0),
      details: formPkg.details.split('\n').map(s => s.trim()).filter(Boolean)
    }
    await updateDoc(doc(db, 'packages', id), payload as any)
    setEditingPkgId(null)
    setFormPkg({ parent: '', typeName: '', price: '', details: '' })
  }

  const delPkg = async (id: string) => { await deleteDoc(doc(db, 'packages', id)) }

  // ===== Actions: Addons =====
  const createAddon = async () => {
    if (!uid) return
    const name = formAdd.name.trim()
    const priceNum = Number(formAdd.price)
    if (!name) return alert('Nama add-on wajib diisi')
    if (Number.isNaN(priceNum)) return alert('Harga tidak valid')

    try {
      const payload: Addon = { uid, name, price: priceNum }
      await addDoc(collection(db, 'addons'), payload as any)
      setFormAdd({ name: '', price: '' })
    } catch (err: any) {
      console.error(err)
      alert('Gagal menambah add-on: ' + (err?.message || 'unknown'))
    }
  }

  const startEditAddon = (a: Addon) => {
    setEditingAddonId(a.id!)
    setEditAddonForm({ name: a.name, price: String(a.price || 0) })
  }

  const updateAddon = async (id: string) => {
    const name = editAddonForm.name.trim()
    const priceNum = Number(editAddonForm.price)
    if (!name) return alert('Nama add-on wajib diisi')
    if (Number.isNaN(priceNum)) return alert('Harga tidak valid')
    try {
      await updateDoc(doc(db, 'addons', id), { name, price: priceNum } as any)
      setEditingAddonId(null)
      setEditAddonForm({ name: '', price: '' })
    } catch (e:any) {
      alert('Gagal update add-on: ' + (e?.message || 'unknown'))
    }
  }

  const delAddon = async (id: string) => {
    try { await deleteDoc(doc(db, 'addons', id)) }
    catch (e: any) { alert('Gagal hapus add-on: ' + (e?.message || 'unknown')) }
  }

  // ===== Actions: Discount =====
  const saveDiscount = async () => {
    if (!uid) return
    await setDoc(doc(db, 'discounts', uid), disc, { merge: true })
  }

  // ===== Optional: seed contoh cepat =====
  const seedSample = async () => {
    if (!uid) return
    const examples: Package[] = [
      { uid, parent: 'wedding', typeName: 'wedding bronze', price: 1500000, details: ['Durasi 6 jam','2 fotografer'] },
      { uid, parent: 'wedding', typeName: 'wedding silver', price: 2500000, details: ['Durasi 8 jam','2 fotografer','1 videografer'] },
      { uid, parent: 'prewedding', typeName: 'outdoor basic', price: 1000000, details: ['2 lokasi','semua file'] },
    ]
    for (const p of examples) await addDoc(collection(db, 'packages'), p as any)
    alert('Seed 3 paket contoh selesai.')
  }

  if (!uid) {
    return (
      <div className="container">
        <div className="card torn">
          <h2 style={{marginTop:0}}>Dashboard</h2>
          <div className="banner">Sesi belum siap. Silakan login dulu.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card torn">
        <h2 style={{marginTop:0}}>Dashboard</h2>

        {/* Link Publish */}
        <div className="banner">
          <div style={{ fontWeight: 600 }}>Link Publish (public):</div>
          <a href={publishUrl} target="_blank" rel="noreferrer">{publishUrl}</a>
        </div>

        {/* Link Deal Klien */}
        <div className="banner">
          <div style={{ fontWeight: 600 }}>Link Deal Klien (public):</div>
          <a href={dealUrl} target="_blank" rel="noreferrer">{dealUrl}</a>
        </div>
      </div>

      {/* === Profil Vendor === */}
      <div className="card">
        <h3 style={{marginTop:0}}>Profil Vendor</h3>
        {!isActive && (
          <div className="lock-note">
            Akun belum aktif / masa aktif habis. Beli token via WA
            <a className="note-wa" href="https://wa.me/6285176932228?text=Halo%20admin%2C%20saya%20ingin%20membeli%20token%20pricelist" target="_blank" rel="noreferrer">6285176932228</a>.
            Form di bawah dinonaktifkan sampai aktivasi token.
          </div>
        )}

        <div className={isActive ? "row" : "row lock-area"}>
          <div className="col">
            <label>Nama Vendor</label>
            <input className="input" value={vendor.name} onChange={e=>setVendor(v=>({...v, name: e.target.value}))} />
          </div>
          <div className="col">
            <label>No WhatsApp</label>
            <input className="input" value={vendor.whatsapp} onChange={e=>setVendor(v=>({...v, whatsapp: e.target.value}))} />
          </div>
        </div>

        <div className={isActive ? "row" : "row lock-area"}>
          <div className="col">
            <label>Alamat</label>
            <input className="input" value={vendor.address} onChange={e=>setVendor(v=>({...v, address: e.target.value}))} />
          </div>
        </div>

        <div className={isActive ? "row" : "row lock-area"}>
          <div className="col">
            <label>Nama Bank</label>
            <input className="input" value={vendor.bankName} onChange={e=>setVendor(v=>({...v, bankName: e.target.value}))} />
          </div>
          <div className="col">
            <label>No Rekening</label>
            <input className="input" value={vendor.bankAccountNumber} onChange={e=>setVendor(v=>({...v, bankAccountNumber: e.target.value}))} />
          </div>
          <div className="col">
            <label>Atas Nama</label>
            <input className="input" value={vendor.bankAccountHolder} onChange={e=>setVendor(v=>({...v, bankAccountHolder: e.target.value}))} />
          </div>
        </div>

        <div className="row" style={{marginTop:8}}>
          <button className="btn primary" onClick={saveVendor} disabled={!isActive}>Simpan Profil</button>
          {vMsg && <span className="badge">{vMsg}</span>}
        </div>
      </div>

      <div className="divider" />

      {/* === Pricelist (flat) === */}
      <div className="card">
        <h3 style={{marginTop:0, display:'flex', gap:8, alignItems:'center'}}>
          Pricelist (Packages)
          <button className="btn ghost" onClick={seedSample}>Seed contoh</button>
        </h3>
        {!isActive && <div className="lock-note">Terkunci sampai aktivasi token.</div>}

        {/* Form Tambah / Update */}
        <div className={isActive ? "row" : "row lock-area"}>
          <div className="col">
            <label>Nama Pricelist (parent) — contoh: wedding</label>
            <input className="input" placeholder="mis. wedding" value={formPkg.parent} onChange={e=>setFormPkg(s=>({...s, parent: e.target.value}))} />
          </div>
          <div className="col">
            <label>Jenis (typeName) — contoh: wedding bronze</label>
            <input className="input" placeholder="wedding bronze" value={formPkg.typeName} onChange={e=>setFormPkg(s=>({...s, typeName: e.target.value}))} />
          </div>
          <div className="col">
            <label>Harga</label>
            <input className="input" type="number" placeholder="1500000" value={formPkg.price} onChange={e=>setFormPkg(s=>({...s, price: e.target.value}))} />
          </div>
        </div>

        <div className={isActive ? "" : "lock-area"}>
          <label>Detail (1 item per baris)</label>
          <textarea className="textarea" placeholder={"Durasi 8 jam\n2 fotografer\n..."} value={formPkg.details} onChange={e=>setFormPkg(s=>({...s, details: e.target.value}))} />
        </div>

        <div className="row" style={{marginTop:8}}>
          {editingPkgId ? (
            <>
              <button className="btn primary" onClick={()=>updatePkg(editingPkgId!)} disabled={!isActive}>Simpan</button>
              <button className="btn" onClick={()=>{ setEditingPkgId(null); setFormPkg({ parent:'', typeName:'', price:'', details:''})}}>Batal</button>
            </>
          ) : (
            <button className="btn primary" onClick={createPkg} disabled={!isActive}>Tambah</button>
          )}
        </div>

        <div className="divider" />

        {/* List Flat */}
        <div>
          <h4>Daftar Pricelist</h4>
          {pkgs.length === 0 && <div>(belum ada)</div>}

          {pkgs.length > 0 && (
            <div className="row" style={{fontWeight:700, borderBottom:'2px dashed #7a6a58', paddingBottom:6}}>
              <div className="col">Parent</div>
              <div className="col">Jenis</div>
              <div className="col">Harga</div>
              <div className="col">Detail singkat</div>
              <div style={{flex:'0 0 180px'}}>Aksi</div>
            </div>
          )}

          {pkgs.map(p => {
            const isRowEditing = editingPkgId === p.id
            return (
              <div key={p.id} className="row" style={{alignItems:'flex-start', padding:'8px 0', borderBottom:'1px dashed #eee'}}>
                <div className="col" style={{textTransform:'capitalize'}}>
                  {isRowEditing ? (
                    <input className="input" value={formPkg.parent} onChange={e=>setFormPkg(s=>({...s, parent: e.target.value}))} />
                  ) : p.parent}
                </div>
                <div className="col" style={{textTransform:'capitalize', fontWeight:600}}>
                  {isRowEditing ? (
                    <input className="input" value={formPkg.typeName} onChange={e=>setFormPkg(s=>({...s, typeName: e.target.value}))} />
                  ) : p.typeName}
                </div>
                <div className="col">
                  {isRowEditing ? (
                    <input className="input" type="number" value={formPkg.price} onChange={e=>setFormPkg(s=>({...s, price: e.target.value}))} />
                  ) : <span className="badge">{formatCurrency(p.price)}</span>}
                </div>
                <div className="col">
                  {isRowEditing ? (
                    <textarea className="textarea" value={formPkg.details} onChange={e=>setFormPkg(s=>({...s, details: e.target.value}))} placeholder="1 item per baris" />
                  ) : (
                    <ul style={{margin:'6px 0'}}>
                      {p.details?.slice(0,4).map((d,i)=>(<li key={i}>{d}</li>))}
                      {p.details && p.details.length > 4 && <li>…</li>}
                    </ul>
                  )}
                </div>
                <div style={{flex:'0 0 180px', display:'flex', gap:8, flexWrap:'wrap'}}>
                  {isRowEditing ? (
                    <>
                      <button className="btn primary" onClick={()=>updatePkg(p.id!)} disabled={!isActive}>Simpan</button>
                      <button className="btn" onClick={()=>{
                        setEditingPkgId(null)
                        setFormPkg({ parent:'', typeName:'', price:'', details:''})
                      }}>Batal</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={()=>startEditPkg(p)} disabled={!isActive}>Edit</button>
                      <button className="btn danger" onClick={()=>p.id && delPkg(p.id)} disabled={!isActive}>Hapus</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* === Add-ons === */}
      <div className="card">
        <h3 style={{marginTop:0}}>Add-ons</h3>
        {!isActive && <div className="lock-note">Terkunci sampai aktivasi token.</div>}

        <div className={isActive ? "row" : "row lock-area"}>
          <div className="col">
            <label>Nama Add-on</label>
            <input className="input" value={formAdd.name} onChange={e=>setFormAdd(s=>({...s, name: e.target.value}))} />
          </div>
          <div className="col">
            <label>Harga</label>
            <input className="input" type="number" value={formAdd.price} onChange={e=>setFormAdd(s=>({...s, price: e.target.value}))} />
          </div>
          <div style={{alignSelf:'end'}}>
            <button className="btn primary" onClick={createAddon} disabled={!isActive}>Tambah</button>
          </div>
        </div>

        <div className="row">
          {addons.map(a => {
            const isEdit = editingAddonId === a.id
            return (
              <div key={a.id} className="col">
                <div className="card">
                  {isEdit ? (
                    <>
                      <div className="row">
                        <div className="col">
                          <label>Nama</label>
                          <input className="input" value={editAddonForm.name} onChange={e=>setEditAddonForm(s=>({...s, name: e.target.value}))} />
                        </div>
                        <div className="col">
                          <label>Harga</label>
                          <input className="input" type="number" value={editAddonForm.price} onChange={e=>setEditAddonForm(s=>({...s, price: e.target.value}))} />
                        </div>
                      </div>
                      <div className="row" style={{marginTop:8}}>
                        <button className="btn primary" onClick={()=>updateAddon(a.id!)} disabled={!isActive}>Simpan</button>
                        <button className="btn" onClick={()=>{ setEditingAddonId(null); setEditAddonForm({ name:'', price:'' })}}>Batal</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div>{a.name}</div>
                        <div className="badge">{formatCurrency(a.price)}</div>
                      </div>
                      <div className="row" style={{marginTop:8}}>
                        <button className="btn" onClick={()=>{ setEditingAddonId(a.id!); setEditAddonForm({ name: a.name, price: String(a.price || 0) }) }} disabled={!isActive}>Edit</button>
                        <button className="btn danger" onClick={()=>a.id && delAddon(a.id)} disabled={!isActive}>Hapus</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {addons.length === 0 && <div style={{padding:'8px'}}> (belum ada) </div>}
        </div>
      </div>

      {/* === Diskon === */}
      <div className="card">
        <h3 style={{marginTop:0}}>Pop-up Diskon</h3>
        {!isActive && <div className="lock-note">Terkunci sampai aktivasi token.</div>}

        <div className={isActive ? "" : "lock-area"}>
          <label>Teks</label>
          <textarea className="textarea" value={disc.text} onChange={e=>setDisc(s=>({...s, text: e.target.value}))} />
          <div className="row">
            <label style={{display:'flex', alignItems:'center', gap:8}}>
              <input className="checkbox" type="checkbox" checked={disc.enabled} onChange={e=>setDisc(s=>({...s, enabled: e.target.checked}))} />
              Tampilkan saat publish dibuka
            </label>
          </div>
          <button className="btn primary" onClick={saveDiscount} disabled={!isActive}>Simpan Diskon</button>
        </div>
      </div>

      {/* === Token Activation === */}
      <TokenActivation />

      {/* === Overview Links shortcut === */}
      <div className="card">
        <h3 style={{marginTop:0}}>Overview Links</h3>
        <a className="btn" href={`${base}dashboard/overview`}>Buka</a>
      </div>
    </div>
  )
}


