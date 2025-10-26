import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="container">
      <div className="card torn">
        <h1 style={{marginTop:0}}>Pricelist Interaktif — Vendor Wedding</h1>
        <p>Gaya klasik-vintage dengan nuansa kertas sobekan. Kelola vendor, paket, jenis, add-on, diskon, dan publish jadi halaman interaktif yang fokus mobile.</p>
        <div className="row">
          <Link className="btn primary" to="/login">Masuk</Link>
          <Link className="btn" to="/register">Daftar</Link>
        </div>
      </div>
      <div className="card">
        <h3>Fitur Utama</h3>
        <ul>
          <li>Authentication (Login/Daftar/Lupa Password)</li>
          <li>Dashboard: CRUD Vendor, Packages, Add-ons, Diskon Pop-up</li>
          <li>Publish Page: Tabs Paket, Slide Jenis, Add-on, WhatsApp message</li>
          <li>Superadmin: generator token + daftar token + **Aktivitas Akun**</li>
          <li>Overview: simpan tautan penting</li>
        </ul>
      </div>
    </div>
  )
}
