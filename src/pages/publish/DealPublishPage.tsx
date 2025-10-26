import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { formatCurrency, waLink } from "../../lib/utils";

type Vendor = { name: string; whatsapp: string };
type Package = {
  id: string;
  uid: string;
  parent: string;
  typeName: string;
  details: string[];
  price: number;
};
type Addon = { id: string; uid: string; name: string; price: number };
type Discount = { text: string; enabled: boolean };
type EventType = "wedding" | "lamaran" | "prewedding" | "";

export default function DealPublishPage() {
  const { uid } = useParams<{ uid: string }>();

  // ====== data publik ======
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [pkgs, setPkgs] = useState<Package[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [discount, setDiscount] = useState<Discount | null>(null);

  // ====== token gating ======
  const [isActive, setIsActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!uid) return;

    const unsubV = onSnapshot(doc(db, "vendors", uid), (snap) => {
      setVendor((snap.data() as any) || null);
    });

    const unsubP = onSnapshot(
      query(collection(db, "packages"), where("uid", "==", uid)),
      (snap) => {
        const arr: Package[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        arr.sort((a, b) => {
          const pa = (a.parent || "").localeCompare(b.parent || "");
          if (pa !== 0) return pa;
          return (a.typeName || "").localeCompare(b.typeName || "");
        });
        setPkgs(arr);
      }
    );

    const unsubA = onSnapshot(
      query(collection(db, "addons"), where("uid", "==", uid)),
      (snap) => {
        const arr: Addon[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setAddons(arr);
      }
    );

    const unsubD = onSnapshot(doc(db, "discounts", uid), (snap) => {
      const d = snap.data() as any;
      if (d) setDiscount({ text: d.text || "", enabled: !!d.enabled });
    });

    const unsubT = onSnapshot(doc(db, "tokens", uid), (snap) => {
      const d = snap.data() as any;
      const activeUntil = d?.expiresAt?.toMillis ? d.expiresAt.toMillis() : 0;
      setIsActive(activeUntil > Date.now());
    });

    return () => {
      unsubV(); unsubP(); unsubA(); unsubD(); unsubT();
    };
  }, [uid]);

  // ====== pilihan (seperti Publish) ======
  const parents = useMemo(
    () => Array.from(new Set(pkgs.map((p) => p.parent))),
    [pkgs]
  );
  const [activeParent, setActiveParent] = useState<string | null>(null);
  useEffect(() => {
    if (!activeParent && parents.length) setActiveParent(parents[0]);
  }, [parents, activeParent]);

  const typesForActive = useMemo(
    () => pkgs.filter((p) => p.parent === activeParent),
    [pkgs, activeParent]
  );

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const selectedType = useMemo(
    () => pkgs.find((p) => p.id === selectedTypeId) || null,
    [pkgs, selectedTypeId]
  );

  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>(
    {}
  );
  const selectedAddonsArr = useMemo(
    () => addons.filter((a) => selectedAddons[a.id]),
    [addons, selectedAddons]
  );

  const total =
    (selectedType?.price || 0) +
    selectedAddonsArr.reduce((s, a) => s + (a.price || 0), 0);

  // ====== Data klien & pasangan ======
  const [clientName, setClientName] = useState("");
  const [clientWa, setClientWa] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  const [groomName, setGroomName] = useState(""); // Nama Pria
  const [brideName, setBrideName] = useState(""); // Nama Wanita
  const [groomIg, setGroomIg] = useState("");     // IG Pria
  const [brideIg, setBrideIg] = useState("");     // IG Wanita

  // ====== Jenis acara dropdown (pilih 1) ======
  const [eventType, setEventType] = useState<EventType>("");

  // wedding
  const [weddingDate, setWeddingDate] = useState("");
  const [akadTime, setAkadTime] = useState("");
  const [akadPlace, setAkadPlace] = useState("");
  const [resepsiTime, setResepsiTime] = useState("");
  const [resepsiPlace, setResepsiPlace] = useState("");

  // lamaran
  const [lamaranDate, setLamaranDate] = useState("");
  const [lamaranTime, setLamaranTime] = useState("");
  const [lamaranPlace, setLamaranPlace] = useState("");

  // prewedding
  const [prewedDate, setPrewedDate] = useState("");
  const [prewedPlace, setPrewedPlace] = useState("");

  const [err, setErr] = useState<string | null>(null);

  // reset saat ganti eventType
  useEffect(() => {
    setWeddingDate(""); setAkadTime(""); setAkadPlace("");
    setResepsiTime(""); setResepsiPlace("");
    setLamaranDate(""); setLamaranTime(""); setLamaranPlace("");
    setPrewedDate(""); setPrewedPlace("");
  }, [eventType]);

  const validate = () => {
    if (!uid) return "URL tidak valid.";
    if (!selectedType) return "Pilih paket/jenis dulu.";
    if (!clientName.trim()) return "Nama klien wajib diisi.";
    if (!clientWa.trim()) return "Nomor WA klien wajib diisi.";
    if (!clientAddress.trim()) return "Alamat kirim album wajib diisi.";
    if (!eventType) return "Pilih jenis acara.";

    if (eventType === "wedding") {
      if (!weddingDate) return "Tanggal acara (wedding) wajib.";
      if (!akadTime) return "Jam akad/pemberkatan wajib.";
      if (!akadPlace.trim()) return "Tempat akad/pemberkatan wajib.";
      if (!resepsiTime) return "Jam resepsi wajib.";
      if (!resepsiPlace.trim()) return "Tempat resepsi wajib.";
    }
    if (eventType === "lamaran") {
      if (!lamaranDate) return "Tanggal acara (lamaran) wajib.";
      if (!lamaranTime) return "Jam lamaran wajib.";
      if (!lamaranPlace.trim()) return "Tempat lamaran wajib.";
    }
    if (eventType === "prewedding") {
      if (!prewedDate) return "Tanggal prewedding wajib.";
      if (!prewedPlace.trim()) return "Tempat prewedding wajib.";
    }
    return null;
  };

  // WA link
  const waHref = useMemo(() => {
    if (!vendor || !selectedType) return "#";
    return waLink({
      vendorName: vendor.name || "Vendor",
      pricelistName: String(activeParent || "").toUpperCase(),
      typeName: String(selectedType.typeName || "").toUpperCase(),
      details: selectedType.details || [],
      price: selectedType.price || 0,
      addons: selectedAddonsArr.map((a) => ({ name: a.name, price: a.price || 0 })),
      whatsapp: vendor.whatsapp || "",
      total,
    });
  }, [vendor, selectedType, selectedAddonsArr, activeParent, total]);

  const onDeal = async (e: React.MouseEvent) => {
    e.preventDefault();
    const msg = validate();
    if (msg) { setErr(msg); return; }
    setErr(null);

    const isWedding = eventType === "wedding";
    const isLamaran = eventType === "lamaran";
    const isPrewed  = eventType === "prewedding";

    try {
      await addDoc(collection(db, "deals"), {
        uid,
        clientName,
        clientWa,
        address: clientAddress,
        groomName, brideName, groomIg, brideIg,
        parent: activeParent,
        packageId: selectedTypeId,
        packageType: selectedType?.typeName || "",
        packagePrice: selectedType?.price || 0,
        addonIds: selectedAddonsArr.map((a) => a.id),
        addonSummary: selectedAddonsArr.map((a) => ({ name: a.name, price: a.price || 0 })),
        total,
        eventType,
        isWedding, isLamaran, isPrewed, // kompat lama
        wedding: isWedding ? {
          date: weddingDate || null,
          akadTime: akadTime || null,
          akadPlace: akadPlace || null,
          resepsiTime: resepsiTime || null,
          resepsiPlace: resepsiPlace || null,
        } : null,
        lamaran: isLamaran ? {
          date: lamaranDate || null,
          time: lamaranTime || null,
          place: lamaranPlace || null,
        } : null,
        prewedding: isPrewed ? {
          date: prewedDate || null,
          place: prewedPlace || null,
        } : null,
        source: "deal-publish",
        createdAt: serverTimestamp(),
      });

      if (waHref && waHref !== "#") window.open(waHref, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      setErr("Gagal menyimpan deal. Coba lagi.");
    }
  };

  // ====== UI ======
  if (isActive === false) {
    return (
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="card torn">
          <h2 style={{ marginTop: 0 }}>{vendor?.name || "(Vendor)"}</h2>
          <div className="banner" style={{ background:'#fff1f2', border:'1px solid #fecdd3', color:'#991b1b' }}>
            Link ini <b>tidak aktif</b> atau masa aktif sudah habis. Silakan hubungi vendor.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 920 }}>
      <div className="card torn">
        <h2 style={{ marginTop: 0 }}>
          {vendor?.name || "(Vendor)"} — Deal Klien
        </h2>
        {discount?.enabled && !!discount.text && (
          <div className="banner">{discount.text}</div>
        )}
      </div>

      {/* Parent tabs */}
      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {parents.map((p) => (
            <button
              key={p}
              onClick={() => {
                setActiveParent(p);
                setSelectedTypeId(null);
              }}
              className="btn"
              style={{
                border: p === activeParent ? "2px solid #7a6a58" : "1px solid #ddd",
                background: p === activeParent ? "#f7f4f1" : "white",
                textTransform: "capitalize"
              }}
            >
              {p}
            </button>
          ))}
          {parents.length === 0 && <div>(Belum ada parent)</div>}
        </div>

        {/* Jenis (radio) */}
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {typesForActive.length === 0 && (
            <div>(Belum ada jenis di parent ini)</div>
          )}
          {typesForActive.map((t) => (
            <label
              key={t.id}
              className="card"
              style={{
                padding: 10,
                border: "1px dashed #e6e0da",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <input
                type="radio"
                name="pkgType"
                checked={t.id === selectedTypeId}
                onChange={() => setSelectedTypeId(t.id)}
                style={{ marginTop: 4 }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <strong style={{ textTransform: "capitalize" }}>
                    {t.typeName}
                  </strong>
                  <span className="badge">{formatCurrency(t.price)}</span>
                </div>
                {!!t.details?.length && (
                  <ul style={{ marginTop: 8 }}>
                    {t.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Add-ons */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add-ons</h3>
        {addons.length === 0 && <div>(Belum ada add-on)</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {addons.map((a) => (
            <label
              key={a.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 8,
                alignItems: "center",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!selectedAddons[a.id]}
                  onChange={(e) =>
                    setSelectedAddons((prev) => ({
                      ...prev,
                      [a.id]: e.target.checked,
                    }))
                  }
                />
                {a.name}
              </span>
              <span>{formatCurrency(a.price)}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 10, fontWeight: 700 }}>
          Total sementara: {formatCurrency(total)}
        </div>
      </div>

      {/* Data klien */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Data Klien</h3>
        <div className="row">
          <div className="col">
            <label>Nama klien</label>
            <input
              className="input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nama lengkap"
            />
          </div>
          <div className="col">
            <label>No. WA klien</label>
            <input
              className="input"
              value={clientWa}
              onChange={(e) => setClientWa(e.target.value)}
              placeholder="62xxxxxxxxxx"
            />
          </div>
        </div>
        <div>
          <label>Alamat kirim album</label>
          <textarea
            className="textarea"
            rows={3}
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder="Jalan, kecamatan, kota/kab, kode pos"
          />
        </div>

        <div className="row" style={{marginTop:12}}>
          <div className="col">
            <label>Nama Pria</label>
            <input className="input" value={groomName} onChange={(e)=>setGroomName(e.target.value)} placeholder="Nama pengantin laki-laki" />
          </div>
          <div className="col">
            <label>Nama Wanita</label>
            <input className="input" value={brideName} onChange={(e)=>setBrideName(e.target.value)} placeholder="Nama pengantin perempuan" />
          </div>
        </div>
        <div className="row">
          <div className="col">
            <label>IG Pria</label>
            <input className="input" value={groomIg} onChange={(e)=>setGroomIg(e.target.value)} placeholder="@username (contoh: @namapria)" />
          </div>
          <div className="col">
            <label>IG Wanita</label>
            <input className="input" value={brideIg} onChange={(e)=>setBrideIg(e.target.value)} placeholder="@username (contoh: @namawanita)" />
          </div>
        </div>
      </div>

      {/* Jenis acara (dropdown satu pilihan) */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Jenis Acara</h3>

        <div className="row">
          <div className="col">
            <label>Pilih jenis acara</label>
            <select
              className="input"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
            >
              <option value="">-- pilih --</option>
              <option value="wedding">Wedding</option>
              <option value="lamaran">Lamaran</option>
              <option value="prewedding">Prewedding</option>
            </select>
          </div>
        </div>

        {eventType === "wedding" && (
          <div className="card" style={{ marginTop: 10 }}>
            <strong>Detail Wedding</strong>
            <div className="row">
              <div className="col">
                <label>Tanggal acara</label>
                <input className="input" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />
              </div>
              <div className="col">
                <label>Jam akad/pemberkatan</label>
                <input className="input" type="time" value={akadTime} onChange={(e) => setAkadTime(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <label>Tempat akad/pemberkatan</label>
                <input className="input" value={akadPlace} onChange={(e) => setAkadPlace(e.target.value)} placeholder="Nama venue / alamat" />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <label>Jam resepsi</label>
                <input className="input" type="time" value={resepsiTime} onChange={(e) => setResepsiTime(e.target.value)} />
              </div>
              <div className="col">
                <label>Tempat resepsi</label>
                <input className="input" value={resepsiPlace} onChange={(e) => setResepsiPlace(e.target.value)} placeholder="Nama venue / alamat" />
              </div>
            </div>
          </div>
        )}

        {eventType === "lamaran" && (
          <div className="card" style={{ marginTop: 10 }}>
            <strong>Detail Lamaran</strong>
            <div className="row">
              <div className="col">
                <label>Tanggal acara</label>
                <input className="input" type="date" value={lamaranDate} onChange={(e) => setLamaranDate(e.target.value)} />
              </div>
              <div className="col">
                <label>Jam lamaran</label>
                <input className="input" type="time" value={lamaranTime} onChange={(e) => setLamaranTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Tempat lamaran</label>
              <input className="input" value={lamaranPlace} onChange={(e) => setLamaranPlace(e.target.value)} placeholder="Nama tempat / alamat" />
            </div>
          </div>
        )}

        {eventType === "prewedding" && (
          <div className="card" style={{ marginTop: 10 }}>
            <strong>Detail Prewedding</strong>
            <div className="row">
              <div className="col">
                <label>Tanggal acara</label>
                <input className="input" type="date" value={prewedDate} onChange={(e) => setPrewedDate(e.target.value)} />
              </div>
              <div className="col">
                <label>Tempat prewedding</label>
                <input className="input" value={prewedPlace} onChange={(e) => setPrewedPlace(e.target.value)} placeholder="Lokasi prewedding" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* error */}
      {err && (
        <div className="card" style={{ background: "#fff1f2", borderLeft: "4px solid #ef4444", color: "#991b1b" }}>
          {err}
        </div>
      )}

      {/* footer */}
      <div
        className="card"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
      >
        <div style={{ fontWeight: 700 }}>Total: {formatCurrency(total)}</div>
        <a
          className="btn primary"
          href={waHref}
          onClick={onDeal}
          target="_blank"
          rel="noreferrer"
          style={{ border: "1px solid #25D366" }}
        >
          Deal via WhatsApp
        </a>
      </div>
    </div>
  );
}
