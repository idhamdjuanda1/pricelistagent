import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { formatCurrency, waLink } from '../../lib/utils'

type Vendor = { name: string; whatsapp: string }
type Package = { id: string; uid: string; parent: string; typeName: string; details: string[]; price: number }
type Addon = { id: string; uid: string; name: string; price: number }
type Discount = { text: string; enabled: boolean }

export default function PublishPage() {
  const { uid } = useParams<{ uid: string }>()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [pkgs, setPkgs] = useState<Package[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [discount, setDiscount] = useState<Discount | null>(null)
  const [showDisc, setShowDisc] = useState(false)

  const [activeParent, setActiveParent] = useState<string | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({})

  const [activeUntil, setActiveUntil] = useState<number | null>(null)
  const isActive = activeUntil != null && activeUntil > Date.now()

  // ===== Carousel mouse-friendly (drag + wheel to horizontal) =====
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const scrollByCard = (dir: number) => {
    const el = carouselRef.current
    if (!el) return
    const card = el.querySelector('.item') as HTMLElement | null
    const gap = 14 // sesuai CSS .carousel gap
    const w = card ? card.offsetWidth + gap : el.clientWidth * 0.8
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    let isDown = false, startX = 0, scrollLeft = 0
    const onDown = (e: MouseEvent) => { isDown = true; el.classList.add('dragging'); startX = e.pageX - el.getBoundingClientRect().left; scrollLeft = el.scrollLeft }
    const onLeave = () => { isDown = false; el.classList.remove('dragging') }
    const onUp = () => { isDown = false; el.classList.remove('dragging') }
    const onMove = (e: MouseEvent) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - el.getBoundingClientRect().left; el.scrollLeft = scrollLeft - (x - startX) }
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY } }
    el.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mouseup', onUp); el.removeEventListener('mouseleave', onLeave); el.removeEventListener('mousemove', onMove); el.removeEventListener('wheel', onWheel as any) }
  }, [])

  // ===== Firestore subscriptions (read-only) =====
  useEffect(() => {
    if (!uid) return
    const unsubV = onSnapshot(doc(db, 'vendors', uid), snap => setVendor((snap.data() as any) || null))
    const unsubP = onSnapshot(query(collection(db, 'packages'), where('uid', '==', uid)), snap => {
      const arr: Package[] = []; snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }))
      setPkgs(arr); if (!activeParent && arr.length) setActiveParent(arr[0].parent)
    })
    const unsubA = onSnapshot(query(collection(db, 'addons'), where('uid', '==', uid)), snap => {
      const arr: Addon[] = []; snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }))
      arr.sort((a,b)=>(a.name||'').localeCompare(b.name||'')); setAddons(arr)
    })
    const unsubD = onSnapshot(doc(db, 'discounts', uid), snap => {
      const d = snap.data() as any
      if (d) { const nd = { text: d.text || '', enabled: !!d.enabled }; setDiscount(nd); setShowDisc(!!nd.enabled) }
    })
    const unsubT = onSnapshot(doc(db, 'tokens', uid), snap => {
      const d = snap.data() as any; if (d?.expiresAt?.toMillis) setActiveUntil(d.expiresAt.toMillis()); else setActiveUntil(null)
    })
    return () => { unsubV(); unsubP(); unsubA(); unsubD(); unsubT() }
  }, [uid, activeParent])

  const parents = useMemo(() => Array.from(new Set(pkgs.map(p => p.parent))), [pkgs])
  const typesForActive = useMemo(() => pkgs.filter(p => p.parent === activeParent), [pkgs, activeParent])
  const selectedType = useMemo(() => pkgs.find(p => p.id === selectedTypeId) || null, [pkgs, selectedTypeId])
  const selectedAddonsArr = useMemo(() => addons.filter(a => selectedAddons[a.id]), [addons, selectedAddons])
  const total = (selectedType?.price || 0) + selectedAddonsArr.reduce((s, a) => s + (a.price || 0), 0)

  const makeWa = () => {
    if (!vendor || !selectedType) return '#'
    return waLink({
      vendorName: vendor.name || 'Vendor',
      pricelistName: String(activeParent || '').toUpperCase(),
      typeName: String(selectedType.typeName || '').toUpperCase(),
      details: selectedType.details || [],
      price: selectedType.price || 0,
      addons: selectedAddonsArr.map(a => ({ name: a.name, price: a.price || 0 })),
      whatsapp: vendor.whatsapp || '',
      total
    })
  }

  return (
    <div className="container">

      {/* Lock view when not active */}
      {!isActive && (
        <div className="card torn">
          <h2 style={{marginTop:0}}>Akun belum aktif</h2>
          <p>Halaman publish terkunci. Harap hubungi admin untuk membeli/aktivasi token.</p>
          <a className="btn primary" href="https://wa.me/6285176932228?text=Halo%20admin%2C%20saya%20ingin%20membeli%20token%20pricelist" target="_blank" rel="noreferrer">
            Hubungi Admin (WhatsApp)
          </a>
        </div>
      )}

      {!isActive ? null : (
      <>
      {/* Discount modal (read-only) */}
      {discount?.enabled && showDisc && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 style={{marginTop:0}}>Promo / Diskon</h3>
            <div style={{whiteSpace:'pre-wrap'}}>{discount?.text}</div>
            <div style={{textAlign:'right', marginTop:10}}>
              <button className="btn primary" onClick={()=>setShowDisc(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      <div className="card torn">
        <h2 style={{marginTop:0}}>Pricelist Interaktif — {vendor?.name || '(Nama Vendor)'}</h2>
        <div className="tabs">
          {parents.map(p => (
            <div key={p} className={['tab', p===activeParent?'active':''].join(' ')} onClick={()=>{ setActiveParent(p); setSelectedTypeId(null) }}>
              {p.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* === JENIS / SLIDE (responsive, snap center, mouse-friendly) === */}
      <div className="card">
        <h3 style={{marginTop:0}}>Jenis</h3>

        <div className="carousel-wrap">
          <button className="carousel-btn left" aria-label="Sebelumnya" onClick={()=>scrollByCard(-1)}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <div className="carousel" ref={carouselRef}>
            {typesForActive.map(t => (
              <div
                key={t.id}
                className={['item', t.id===selectedTypeId ? 'active' : ''].join(' ')}
                tabIndex={0}
                onClick={()=>setSelectedTypeId(t.id)}
                onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') setSelectedTypeId(t.id) }}
              >
                <div className="item__head">
                  <div className="item__title">{t.typeName}</div>
                  <div className="badge item__price">{formatCurrency(t.price)}</div>
                </div>

                <ul className="item__details">
                  {t.details?.map((d,i)=>(<li key={i}>{d}</li>))}
                </ul>
              </div>
            ))}

            {typesForActive.length === 0 && (
              <div className="item">
                <div className="item__title">Belum ada jenis</div>
                <p style={{opacity:.7}}>Tambahkan jenis di Dashboard &gt; Packages</p>
              </div>
            )}
          </div>

          <button className="carousel-btn right" aria-label="Berikutnya" onClick={()=>scrollByCard(1)}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* === ADD-ONS (read-only) === */}
      <div className="card">
        <h3 style={{marginTop:0}}>Add-ons</h3>
        <div className="addons__list">
          {addons.length === 0 && <div>(belum ada add-on)</div>}
          {addons.map(a => (
            <div key={a.id} style={{display:'flex', alignItems:'center', gap:8}}>
              <label style={{display:'flex', alignItems:'center', gap:8, flex:1}}>
                <input className="checkbox" type="checkbox"
                  checked={!!selectedAddons[a.id]}
                  onChange={(e)=>setSelectedAddons(s=>({ ...s, [a.id]: e.target.checked }))} />
                <span>{a.name} — <span className="badge">{formatCurrency(a.price)}</span></span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* === TOTAL & WA === */}
      <div className="card">
        <div className="row" style={{alignItems:'center'}}>
          <div className="col">
            <div style={{fontWeight:700}}>Total Perkiraan</div>
            <div style={{fontSize:24}}>{formatCurrency(total)}</div>
          </div>
          <div className="col" style={{textAlign:'right'}}>
            <a className="btn primary" href={makeWa()} target="_blank" rel="noreferrer"
               onClick={(e)=>{ if(!selectedType) e.preventDefault() }}>
              WhatsApp
            </a>
            {!selectedType && <div className="badge" style={{marginTop:6}}>Pilih **Jenis** dulu</div>}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}
