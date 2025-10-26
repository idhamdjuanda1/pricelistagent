
// src/pages/dashboard/Mou.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

/**
 * MOU Editor (privat, harus login)
 * - Prefill dari deal + vendor + (opsional) template default UID + (opsional) dokumen MOU existing
 * - Simpan MOU ke `mous/{dealId}`
 * - Simpan default ke `mouDefaults/{uid}` (termasuk layout)
 * - Export PDF via jsPDF (static import, v3)
 * - Preview yang konsisten dengan PDF (pakai konversi pt → px)
 */
export default function Mou() {
  const { dealId } = useParams<{ dealId: string }>();
  const uid = auth.currentUser?.uid || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deal, setDeal] = useState<any>(null);
  const [tokenActive, setTokenActive] = useState<boolean | null>(null);

  // === Layout options (bisa disimpan dalam mouDefaults) ===
  const [layout, setLayout] = useState({
    marginTop: 72, // pt (1 inch)
    marginRight: 40,
    marginBottom: 60,
    marginLeft: 40,
    lineHeight: 18,
    titleSize: 16,
    bodySize: 12,
  });
  const setLayoutF = (k: keyof typeof layout, v: number) =>
    setLayout((s) => ({ ...s, [k]: v }));

  // === Form MOU ===
  const [form, setForm] = useState<any>({
    // header
    mouCity: "Bogor",
    mouDate: new Date().toISOString().slice(0, 10),

    // pihak pertama (vendor)
    vendorName: "",
    vendorRep: "", // Atas Nama (penandatangan)
    vendorJobTitle: "Pemilik / Project Manager",
    vendorAddress: "",
    vendorPhone: "",

    // pihak kedua (klien)
    clientName: "",
    clientWa: "",
    clientAddress: "",
    groomName: "",
    groomIg: "",
    brideName: "",
    brideIg: "",

    // paket
    eventType: "", // wedding | lamaran | prewedding
    pricelistName: "",
    packageType: "",
    packagePrice: 0,
    addonsSummary: "",
    total: 0,

    // wedding/lamaran/prewed
    weddingDate: "",
    akadTime: "",
    akadPlace: "",
    resepsiTime: "",
    resepsiPlace: "",

    lamaranDate: "",
    lamaranTime: "",
    lamaranPlace: "",

    prewedDate: "",
    prewedPlace: "",

    // pembayaran
    dpAmount: 0,
    dpDate: "",
    remainingAmount: 0,
    dueDate: "",

    // bank vendor
    bankName: "",
    bankAccountNumber: "",
    bankAccountHolder: "",

    // klausul standar (editable)
    clauseDeliverSocial:
      "Foto pilihan & video highlight 1 menit akan diserahkan 1–2 minggu setelah acara.",
    clauseDeliverAll:
      "Seluruh hasil akhir diserahkan 30–45 hari kerja sejak tanggal acara.",
    clauseCancellation:
      "DP/termin pertama hangus jika pembatalan sepihak oleh PIHAK KEDUA. Jika sudah pelunasan, pengembalian 60% dari termin kedua.",
    clausePortfolio:
      "PIHAK PERTAMA berhak menggunakan hasil karya untuk portfolio dengan menjaga privasi & kesopanan.",
    clauseDataLoss:
      "Jika terjadi kehilangan data karena kesalahan internal, kompensasi: 200% porsi jasa foto / 50% porsi jasa video; prewedding: sesi ulang ditanggung PIHAK PERTAMA. Tidak berlaku untuk force majeure atau kejadian di luar kendali wajar.",

    // tanda tangan
    signVendor: "",
    signClient: "",
  });

  const setF = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  // ===== Load vendor, deal, defaults, existing MOU, token =====
  useEffect(() => {
    if (!uid || !dealId) return;
    const unsubs: Array<() => void> = [];

    (async () => {
      try {
        // token (untuk lock banner)
        const unsubT = onSnapshot(doc(db, "tokens", uid), (snap) => {
          const d = snap.data() as any;
          const activeUntil = d?.expiresAt?.toMillis ? d.expiresAt.toMillis() : 0;
          setTokenActive(activeUntil > Date.now());
        });
        unsubs.push(unsubT);

        // vendor
        let v: any = {};
        try {
          const vSnap = await getDoc(doc(db, "vendors", uid));
          v = vSnap.data() || {};
        } catch (e: any) {
          console.error("ERR vendor:", e);
          throw new Error("Gagal baca vendor (izin/rules?)");
        }

        // deal
        let d: any;
        try {
          const dSnap = await getDoc(doc(db, "deals", dealId));
          if (!dSnap.exists()) throw new Error("Deal tidak ditemukan");
          d = dSnap.data();
          if (d.uid !== uid) throw new Error("Tidak berhak mengakses deal ini");
          setDeal({ id: dSnap.id, ...d });
        } catch (e: any) {
          console.error("ERR deal:", e);
          throw e;
        }

        // existing MOU (docId = dealId) — optional
        let existing: any = undefined;
        try {
          const mSnap = await getDoc(doc(db, "mous", dealId));
          existing = mSnap.data();
          if (existing?.layout) {
            setLayout({
              ...layout,
              ...pickLayout(existing.layout),
            });
          }
        } catch (e: any) {
          console.warn("WARN mous (optional):", e);
        }

        // default template per UID — optional
        let tmpl: any = undefined;
        try {
          const tSnap = await getDoc(doc(db, "mouDefaults", uid));
          tmpl = tSnap.data();
          if (tmpl?.layout) {
            setLayout((s) => ({ ...s, ...pickLayout(tmpl.layout) }));
          }
        } catch (e: any) {
          console.warn("WARN mouDefaults (optional):", e);
        }

        const addonSummary = d?.addonSummary
          ? d.addonSummary
              .map((a: any) => `${a.name} (${fmtCurrency(a.price || 0)})`)
              .join(", ")
          : "Tidak ada";

        const base = {
          mouCity: "Bogor",
          mouDate: new Date().toISOString().slice(0, 10),

          vendorName: v.name || "",
          vendorRep: v.bankAccountHolder || "",
          vendorJobTitle: "Pemilik / Project Manager",
          vendorAddress: v.address || "",
          vendorPhone: v.whatsapp || "",

          clientName: d?.clientName || "",
          clientWa: d?.clientWa || "",
          clientAddress: d?.address || "",
          groomName: d?.groomName || "",
          groomIg: d?.groomIg || "",
          brideName: d?.brideName || "",
          brideIg: d?.brideIg || "",

          eventType:
            d?.eventType ||
            (d?.isWedding
              ? "wedding"
              : d?.isLamaran
              ? "lamaran"
              : d?.isPrewed
              ? "prewedding"
              : ""),
          pricelistName: d?.parent || "",
          packageType: d?.packageType || "",
          packagePrice: d?.packagePrice || 0,
          addonsSummary: addonSummary || "Tidak ada",
          total: d?.total || 0,

          weddingDate: d?.wedding?.date || "",
          akadTime: d?.wedding?.akadTime || "",
          akadPlace: d?.wedding?.akadPlace || "",
          resepsiTime: d?.wedding?.resepsiTime || "",
          resepsiPlace: d?.wedding?.resepsiPlace || "",

          lamaranDate: d?.lamaran?.date || "",
          lamaranTime: d?.lamaran?.time || "",
          lamaranPlace: d?.lamaran?.place || "",

          prewedDate: d?.prewedding?.date || "",
          prewedPlace: d?.prewedding?.place || "",

          dpAmount: 0,
          dpDate: "",
          remainingAmount: Math.max(d?.total || 0, 0),
          dueDate: "",

          bankName: v.bankName || "",
          bankAccountNumber: v.bankAccountNumber || "",
          bankAccountHolder: v.bankAccountHolder || "",

          clauseDeliverSocial:
            "Foto pilihan & video highlight 1 menit akan diserahkan 1–2 minggu setelah acara.",
          clauseDeliverAll:
            "Seluruh hasil akhir diserahkan 30–45 hari kerja sejak tanggal acara.",
          clauseCancellation:
            "DP/termin pertama hangus jika pembatalan sepihak oleh PIHAK KEDUA. Jika sudah pelunasan, pengembalian 60% dari termin kedua.",
          clausePortfolio:
            "PIHAK PERTAMA berhak menggunakan hasil karya untuk portfolio dengan menjaga privasi & kesopanan.",
          clauseDataLoss:
            "Jika terjadi kehilangan data karena kesalahan internal, kompensasi: 200% porsi jasa foto / 50% porsi jasa video; prewedding: sesi ulang ditanggung PIHAK PERTAMA. Tidak berlaku untuk force majeure atau kejadian di luar kendali wajar.",

          signVendor: v.bankAccountHolder || "",
          signClient: d?.clientName || "",
        };

        const initial = { ...base, ...(tmpl || {}), ...(existing || {}) };
        setForm(initial);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || "Gagal memuat data MOU");
        setLoading(false);
      }
    })();

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, dealId]);

  // ===== Komposer paragraf (DIPAKAI PREVIEW & PDF) =====
  const paragraphs = useMemo(() => {
    const out: string[] = [];

    // Pembuka
    out.push(
      `Perjanjian ini dibuat dan ditandatangani di ${form.mouCity}, pada ${fmtDateIndo(
        form.mouDate
      )}, oleh dan antara:`
    );
    out.push("");

    // Pihak Pertama
    out.push("1. PIHAK PERTAMA:");
    out.push(`Nama Usaha: ${fallback(form.vendorName) } / Vendor fotografi Wedding`);
    out.push(`Nama Perwakilan: ${fallback(form.vendorRep)}`);
    out.push(`Jabatan: ${fallback(form.vendorJobTitle)}`);
    out.push(`Alamat: ${fallback(form.vendorAddress)}`);
    out.push(`Nomor Telepon: ${fallback(form.vendorPhone)}`);
    out.push("Selanjutnya disebut PIHAK PERTAMA atau Penyedia Jasa.");
    out.push("");

    // Pihak Kedua
    out.push("2. PIHAK KEDUA:");
    out.push(`Nama Lengkap Klien: ${fallback(form.clientName)}`);
    out.push(`Nomor WhatsApp: ${fallback(form.clientWa)}`);
    out.push(`Alamat Pengiriman: ${fallback(form.clientAddress)}`);
    out.push(`Nama Pria: ${fallback(form.groomName)} (Instagram: ${fallback(form.groomIg, "-")})`);
    out.push(`Nama Wanita: ${fallback(form.brideName)} (Instagram: ${fallback(form.brideIg, "-")})`);
    out.push("Selanjutnya disebut PIHAK KEDUA atau Klien.");
    out.push("");

    // Pasal 1
    out.push("Pasal 1 — RUANG LINGKUP JASA");
    out.push(`Jenis acara: ${labelEvent(form.eventType)}.`);
    out.push(`Nama Pricelist: ${fallback(form.pricelistName)}.`);
    out.push(`Jenis (type): ${fallback(form.packageType)}.`);
    out.push("");

    // Pasal 2 (HANYA untuk eventType terpilih)
    out.push("Pasal 2 — JADWAL DAN LOKASI ACARA");
    if (form.eventType === "wedding") {
      out.push(`Nama acara: Wedding`);
      out.push(`Tanggal acara: ${fmtDateIndo(form.weddingDate) || "-"}`);
      out.push(`Jam akad / pemberkatan: ${fallback(form.akadTime, "-")}`);
      out.push(`Tempat akad / pemberkatan: ${fallback(form.akadPlace, "-")}`);
      out.push(`Jam resepsi: ${fallback(form.resepsiTime, "-")}`);
      out.push(`Tempat resepsi: ${fallback(form.resepsiPlace, "-")}`);
    } else if (form.eventType === "lamaran") {
      out.push(`Nama acara: Lamaran`);
      out.push(`Tanggal acara: ${fmtDateIndo(form.lamaranDate) || "-"}`);
      out.push(`Jam lamaran: ${fallback(form.lamaranTime, "-")}`);
      out.push(`Tempat lamaran: ${fallback(form.lamaranPlace, "-")}`);
    } else if (form.eventType === "prewedding") {
      out.push(`Nama acara: Prewedding`);
      out.push(`Tanggal acara: ${fmtDateIndo(form.prewedDate) || "-"}`);
      out.push(`Tempat prewedding: ${fallback(form.prewedPlace, "-")}`);
    } else {
      out.push(`Nama acara: -`);
    }
    out.push("");

    // Pasal 3 — ADD ON
    out.push("Pasal 3 — LAYANAN TAMBAHAN (ADD-ON)");
    out.push(`Add-ons: ${fallback(form.addonsSummary, "Tidak Ada")}.`);
    out.push("");

    // Pasal 4 — Pembayaran
    out.push("Pasal 4 — BIAYA & PEMBAYARAN");
    out.push(`Harga Paket Awal: ${fmtCurrency(form.packagePrice)}.`);
    out.push(`Total Disepakati: ${fmtCurrency(form.total)}.`);
    out.push(
      `Uang Muka (DP): ${fmtCurrency(form.dpAmount)} pada ${fmtDateIndo(
        form.dpDate
      ) || "-"}.`
    );
    out.push(
      `Sisa Pelunasan: ${fmtCurrency(
        form.remainingAmount
      )} (batas ${fmtDateIndo(form.dueDate) || "-"}).`
    );
    out.push(
      `Pembayaran via: ${fallback(form.bankName)} • ${fallback(
        form.bankAccountNumber
      )} a.n. ${fallback(form.bankAccountHolder)}.`
    );
    out.push("");

    // Pasal 5, 6, 7, 8, 9
    out.push("Pasal 5 — HAK & KEWAJIBAN");
    out.push(
      "Kewajiban PIHAK PERTAMA: profesional sesuai paket; koordinasi; menyerahkan hasil sesuai jadwal; simpan raw file 3–6 bulan."
    );
    out.push(
      "Kewajiban PIHAK KEDUA: beri info akurat; patuhi jadwal pembayaran; kooperatif; biaya venue/izin ditanggung PIHAK KEDUA bila ada."
    );
    out.push("");

    out.push("Pasal 6 — JADWAL PENYERAHAN HASIL");
    out.push(form.clauseDeliverSocial || "");
    out.push(form.clauseDeliverAll || "");
    out.push("");

    out.push("Pasal 7 — PEMBATALAN / PERUBAHAN JADWAL");
    out.push(form.clauseCancellation || "");
    out.push("");

    out.push("Pasal 8 — HAK CIPTA & PORTFOLIO");
    out.push(form.clausePortfolio || "");
    out.push("");

    out.push("Pasal 9 — BATASAN TANGGUNG JAWAB (KEHILANGAN DATA)");
    out.push(form.clauseDataLoss || "");
    out.push("");

    out.push("PENUTUP");
    out.push(`Dibuat di: ${fallback(form.mouCity)} pada ${fmtDateIndo(form.mouDate)}.`);
    out.push("");

    return out;
  }, [form]);

  // ===== Actions =====
  const onSaveMou = async () => {
    if (!uid || !dealId) return;
    try {
      await setDoc(
        doc(db, "mous", dealId),
        {
          uid,
          dealId,
          ...form,
          layout,
          updatedAt: serverTimestamp(),
          createdAt: (form?.createdAt as any) || serverTimestamp(),
        },
        { merge: true }
      );
      alert("MOU disimpan.");
    } catch (e: any) {
      alert("Gagal menyimpan MOU: " + (e?.message || "unknown"));
    }
  };

  const onSaveAsDefault = async () => {
    if (!uid) return;
    try {
      const {
        clauseDeliverSocial,
        clauseDeliverAll,
        clauseCancellation,
        clausePortfolio,
        clauseDataLoss,
        vendorJobTitle,
      } = form;
      await setDoc(
        doc(db, "mouDefaults", uid),
        {
          clauseDeliverSocial,
          clauseDeliverAll,
          clauseCancellation,
          clausePortfolio,
          clauseDataLoss,
          vendorJobTitle,
          layout, // simpan layout juga
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      alert("Template default MOU disimpan untuk UID ini.");
    } catch (e: any) {
      alert("Gagal menyimpan default: " + (e?.message || "unknown"));
    }
  };

  const onExportPdf = async () => {
    try {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const {
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        lineHeight,
        titleSize,
        bodySize,
      } = layout;

      const wrapWidth = pageW - marginLeft - marginRight;

      pdf.setFont("Times", "Normal");

      // === Title (center) ===
      pdf.setFontSize(titleSize);
      const title =
        "MEMORANDUM OF UNDERSTANDING (MoU) / SURAT PERJANJIAN KERJASAMA";
      const yTitle = marginTop;
      pdf.text(title, pageW / 2, yTitle, {
        align: "center",
        maxWidth: wrapWidth,
      });

      // Spacer setelah title
      let y = yTitle + lineHeight * 1.8;

      // === Body ===
      pdf.setFontSize(bodySize);

      const addPageIfNeeded = () => {
        if (y > pageH - marginBottom) {
          pdf.addPage();
          y = marginTop;
          pdf.setFontSize(bodySize);
        }
      };

      const writePara = (text: string) => {
        const lines = pdf.splitTextToSize((text || "").replace(/\r/g, ""), wrapWidth);
        lines.forEach((ln: string) => {
          addPageIfNeeded();
          pdf.text(String(ln), marginLeft, y, { maxWidth: wrapWidth });
          y += lineHeight;
        });
        y += Math.round(lineHeight * 0.25); // extra spacing antar paragraf
      };

      // tulis semua paragraf
      paragraphs.forEach(writePara);

      // === Signature block ===
      // Tambahkan ruang terlebih dahulu
      y += lineHeight * 1.5;
      addPageIfNeeded();

      // Header labels
      pdf.text("PIHAK PERTAMA", marginLeft, y);
      pdf.text("PIHAK KEDUA", pageW - marginRight, y, { align: "right" });

      // Jarak untuk tanda tangan (kosong)
      y += lineHeight * 3.0; // lebih lega
      addPageIfNeeded();

      // Nama jelas
      pdf.text(fallback(form.signVendor, "(Tanda tangan & nama jelas)"), marginLeft, y);
      pdf.text(
        fallback(form.signClient, "(Tanda tangan & nama jelas)"),
        pageW - marginRight,
        y,
        { align: "right" }
      );

      // Footer page number
      const totalPages = pdf.getNumberOfPages();
      pdf.setFontSize(10);
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.text(`Halaman ${i}/${totalPages}`, pageW - marginRight, pageH - 18, {
          align: "right",
        });
      }

      pdf.save(`MOU_${sanitizeFile(form.clientName || "client")}.pdf`);
    } catch (e: any) {
      alert("Gagal export PDF");
      console.error(e);
    }
  };

  // ===== UI states =====
  if (!uid)
    return (
      <div className="container">
        <div className="card torn">Silakan login</div>
      </div>
    );
  if (loading)
    return (
      <div className="container">
        <div className="card">Memuat…</div>
      </div>
    );
  if (error)
    return (
      <div className="container">
        <div
          className="card"
          style={{
            background: "#fff1f2",
            borderLeft: "4px solid #ef4444",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      </div>
    );

  // Preview paragraphs reuse the same generator (consistency)
  const previewParas = paragraphs;

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="card torn">
        <h2 style={{ marginTop: 0 }}>Buat / Edit MOU</h2>
        {tokenActive === false && (
          <div
            className="banner"
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
            }}
          >
            Masa aktif akun <b>habis</b>. Simpan/Export masih bisa dipakai, tapi sebaiknya aktifkan ulang token.
          </div>
        )}
        <div style={{ color: "#666" }}>
          Draft dari deal: <b>{deal?.clientName || "(tanpa nama)"}</b>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="card">
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <div>
              <b>Klien:</b> {form.clientName || "-"}
            </div>
            <div>
              <b>WA:</b> {form.clientWa || "-"}
            </div>
            <div>
              <b>Alamat:</b> {form.clientAddress || "-"}
            </div>
            <div>
              <b>Pasangan:</b> {form.groomName || "-"} & {form.brideName || "-"}
            </div>
            <div>
              <b>IG:</b> {form.groomIg || "-"} • {form.brideIg || "-"}
            </div>
          </div>
          <div>
            <div>
              <b>Paket:</b> {form.pricelistName || "-"} •{" "}
              {form.packageType || "-"}
            </div>
            <div>
              <b>Harga Paket:</b> {fmtCurrency(form.packagePrice || 0)}
            </div>
            <div>
              <b>Add-ons:</b> {form.addonsSummary || "Tidak Ada"}
            </div>
            <div>
              <b>Total:</b> {fmtCurrency(form.total || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Detail MOU */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Detail MOU</h3>

        <div className="row">
          <div className="col">
            <label>Kota pembuatan</label>
            <input
              className="input"
              value={form.mouCity}
              onChange={(e) => setF("mouCity", e.target.value)}
            />
          </div>
          <div className="col">
            <label>Tanggal MoU</label>
            <input
              className="input"
              type="date"
              value={form.mouDate}
              onChange={(e) => setF("mouDate", e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div className="col">
            <label>Nama Usaha (Vendor)</label>
            <input
              className="input"
              value={form.vendorName}
              onChange={(e) => setF("vendorName", e.target.value)}
            />
          </div>
          <div className="col">
            <label>Nama Perwakilan (Atas Nama)</label>
            <input
              className="input"
              value={form.vendorRep}
              onChange={(e) => setF("vendorRep", e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div className="col">
            <label>Jabatan</label>
            <input
              className="input"
              value={form.vendorJobTitle}
              onChange={(e) => setF("vendorJobTitle", e.target.value)}
            />
          </div>
          <div className="col">
            <label>Alamat Vendor</label>
            <input
              className="input"
              value={form.vendorAddress}
              onChange={(e) => setF("vendorAddress", e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div className="col">
            <label>No. Telepon Vendor</label>
            <input
              className="input"
              value={form.vendorPhone}
              onChange={(e) => setF("vendorPhone", e.target.value)}
            />
          </div>
          <div className="col">
            <label>Jenis Acara</label>
            <select
              className="input"
              value={form.eventType}
              onChange={(e) => setF("eventType", e.target.value)}
            >
              <option value="">-- pilih --</option>
              <option value="wedding">Wedding</option>
              <option value="lamaran">Lamaran</option>
              <option value="prewedding">Prewedding</option>
            </select>
          </div>
        </div>

        {/* Wedding / Lamaran / Prewed */}
        <div className="row">
          <div className="col">
            <label>Tanggal Wedding</label>
            <input
              className="input"
              type="date"
              value={form.weddingDate}
              onChange={(e) => setF("weddingDate", e.target.value)}
            />
          </div>
          <div className="col">
            <label>Akad (jam & tempat)</label>
            <div className="row">
              <div className="col">
                <input
                  className="input"
                  type="time"
                  value={form.akadTime}
                  onChange={(e) => setF("akadTime", e.target.value)}
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  placeholder="Tempat akad"
                  value={form.akadPlace}
                  onChange={(e) => setF("akadPlace", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col">
            <label>Resepsi (jam & tempat)</label>
            <div className="row">
              <div className="col">
                <input
                  className="input"
                  type="time"
                  value={form.resepsiTime}
                  onChange={(e) => setF("resepsiTime", e.target.value)}
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  placeholder="Tempat resepsi"
                  value={form.resepsiPlace}
                  onChange={(e) => setF("resepsiPlace", e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col">
            <label>Lamaran (tanggal, jam, tempat)</label>
            <div className="row">
              <div className="col">
                <input
                  className="input"
                  type="date"
                  value={form.lamaranDate}
                  onChange={(e) => setF("lamaranDate", e.target.value)}
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  type="time"
                  value={form.lamaranTime}
                  onChange={(e) => setF("lamaranTime", e.target.value)}
                />
              </div>
            </div>
            <input
              className="input"
              placeholder="Lokasi lamaran"
              value={form.lamaranPlace}
              onChange={(e) => setF("lamaranPlace", e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div className="col">
            <label>Prewedding (tanggal & lokasi)</label>
            <div className="row">
              <div className="col">
                <input
                  className="input"
                  type="date"
                  value={form.prewedDate}
                  onChange={(e) => setF("prewedDate", e.target.value)}
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  placeholder="Lokasi prewedding"
                  value={form.prewedPlace}
                  onChange={(e) => setF("prewedPlace", e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col">
            <label>Bank (Nama/No/Atas Nama)</label>
            <div className="row">
              <div className="col">
                <input
                  className="input"
                  placeholder="Bank"
                  value={form.bankName}
                  onChange={(e) => setF("bankName", e.target.value)}
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  placeholder="No Rekening"
                  value={form.bankAccountNumber}
                  onChange={(e) => setF("bankAccountNumber", e.target.value)}
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  placeholder="Atas Nama"
                  value={form.bankAccountHolder}
                  onChange={(e) => setF("bankAccountHolder", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Klausul */}
        <div>
          <label>Klausul Jadwal Penyerahan (Media Sosial)</label>
          <textarea
            className="textarea"
            value={form.clauseDeliverSocial}
            onChange={(e) => setF("clauseDeliverSocial", e.target.value)}
          />
        </div>
        <div>
          <label>Klausul Jadwal Penyerahan (Hasil Akhir)</label>
          <textarea
            className="textarea"
            value={form.clauseDeliverAll}
            onChange={(e) => setF("clauseDeliverAll", e.target.value)}
          />
        </div>
        <div>
          <label>Klausul Pembatalan/Perubahan Jadwal</label>
          <textarea
            className="textarea"
            value={form.clauseCancellation}
            onChange={(e) => setF("clauseCancellation", e.target.value)}
          />
        </div>
        <div>
          <label>Klausul Hak Cipta & Portfolio</label>
          <textarea
            className="textarea"
            value={form.clausePortfolio}
            onChange={(e) => setF("clausePortfolio", e.target.value)}
          />
        </div>
        <div>
          <label>Klausul Batasan Tanggung Jawab (Kehilangan Data)</label>
          <textarea
            className="textarea"
            value={form.clauseDataLoss}
            onChange={(e) => setF("clauseDataLoss", e.target.value)}
          />
        </div>

        {/* TTD */}
        <div className="row">
          <div className="col">
            <label>TTD Vendor (Nama jelas)</label>
            <input
              className="input"
              value={form.signVendor}
              onChange={(e) => setF("signVendor", e.target.value)}
            />
          </div>
          <div className="col">
            <label>TTD Klien (Nama jelas)</label>
            <input
              className="input"
              value={form.signClient}
              onChange={(e) => setF("signClient", e.target.value)}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button className="btn primary" onClick={onSaveMou}>
            Simpan MOU
          </button>
          <button className="btn" onClick={onSaveAsDefault}>
            Simpan sebagai Default (UID)
          </button>
          <button className="btn" onClick={onExportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      {/* === Layout & Preview === */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Layout & Preview</h3>

        {/* Controls */}
        <div className="row">
          <div className="col">
            <label>Margin (Top/Right/Bottom/Left) — pt</label>
            <div className="row">
              <div className="col">
                <input
                  className="input"
                  type="number"
                  value={layout.marginTop}
                  onChange={(e) =>
                    setLayoutF("marginTop", Number(e.target.value || 0))
                  }
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  type="number"
                  value={layout.marginRight}
                  onChange={(e) =>
                    setLayoutF("marginRight", Number(e.target.value || 0))
                  }
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  type="number"
                  value={layout.marginBottom}
                  onChange={(e) =>
                    setLayoutF("marginBottom", Number(e.target.value || 0))
                  }
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  type="number"
                  value={layout.marginLeft}
                  onChange={(e) =>
                    setLayoutF("marginLeft", Number(e.target.value || 0))
                  }
                />
              </div>
            </div>
          </div>
          <div className="col">
            <label>Typography</label>
            <div className="row">
              <div className="col">
                <input
                  className="input"
                  type="number"
                  value={layout.titleSize}
                  onChange={(e) =>
                    setLayoutF("titleSize", Number(e.target.value || 0))
                  }
                  placeholder="Title size (pt)"
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  type="number"
                  value={layout.bodySize}
                  onChange={(e) =>
                    setLayoutF("bodySize", Number(e.target.value || 0))
                  }
                  placeholder="Body size (pt)"
                />
              </div>
              <div className="col">
                <input
                  className="input"
                  type="number"
                  value={layout.lineHeight}
                  onChange={(e) =>
                    setLayoutF("lineHeight", Number(e.target.value || 0))
                  }
                  placeholder="Line height (pt)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#fff",
            marginTop: 12,
            width: 794,          // A4 ~ 794x1123 px @96dpi (aproksimasi)
            height: 1123,
            maxWidth: "100%",
            overflow: "auto",
          }}
        >
          <div
            style={{
              paddingTop: ptToPx(layout.marginTop),
              paddingRight: ptToPx(layout.marginRight),
              paddingBottom: ptToPx(layout.marginBottom),
              paddingLeft: ptToPx(layout.marginLeft),
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontSize: ptToPx(layout.titleSize),
                fontWeight: 600,
                marginBottom: Math.round(ptToPx(layout.lineHeight) * 1.2),
              }}
            >
              MEMORANDUM OF UNDERSTANDING (MoU) / <br />
              SURAT PERJANJIAN KERJASAMA
            </div>

            <div
              style={{
                fontSize: ptToPx(layout.bodySize),
                lineHeight: `${ptToPx(layout.lineHeight)}px`,
                color: "#111",
              }}
            >
              {previewParas.map((p, idx) => (
                <p key={idx} style={{ margin: 0, marginBottom: Math.round(ptToPx(layout.lineHeight) * 0.25) }}>
                  {p}
                </p>
              ))}

              {/* Signature preview */}
              <div style={{ marginTop: ptToPx(layout.lineHeight) * 1.5 }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>PIHAK PERTAMA</div>
                <div>PIHAK KEDUA</div>
              </div>
              <div style={{ height: ptToPx(layout.lineHeight) * 3 }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>{fallback(form.signVendor, "(Tanda tangan & nama jelas)")}</div>
                <div>{fallback(form.signClient, "(Tanda tangan & nama jelas)")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== utils ===== */
function fmtCurrency(n: number) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `Rp ${n || 0}`;
  }
}
function labelEvent(v: string) {
  if (v === "wedding") return "Wedding";
  if (v === "lamaran") return "Lamaran";
  if (v === "prewedding") return "Prewedding";
  return "-";
}
function sanitizeFile(s: string) {
  return (s || "").replace(/[^a-z0-9_\-]+/gi, "_");
}
function fmtDateIndo(v: string) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const M = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}
function pickLayout(raw: any) {
  const out: any = {};
  if (isNum(raw?.marginTop)) out.marginTop = Number(raw.marginTop);
  if (isNum(raw?.marginRight)) out.marginRight = Number(raw.marginRight);
  if (isNum(raw?.marginBottom)) out.marginBottom = Number(raw.marginBottom);
  if (isNum(raw?.marginLeft)) out.marginLeft = Number(raw.marginLeft);
  if (isNum(raw?.lineHeight)) out.lineHeight = Number(raw.lineHeight);
  if (isNum(raw?.titleSize)) out.titleSize = Number(raw.titleSize);
  if (isNum(raw?.bodySize)) out.bodySize = Number(raw.bodySize);
  return out;
}
function isNum(v: any) { return typeof v === "number" && !Number.isNaN(v); }
function ptToPx(pt: number) { return Math.round(pt * (96 / 72)); }
function fallback(v: any, alt: string = "") {
  if (v === undefined || v === null) return alt;
  if (typeof v === "string" && v.trim() === "") return alt;
  return v;
}
