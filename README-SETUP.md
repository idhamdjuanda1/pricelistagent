# Invoice & Kuitansi (Cuan Shutter)

Paket ini menambahkan:
- Halaman **Invoice**: penagihan + termin pembayaran (PDF A4).
- Halaman **Kuitansi**: bukti pembayaran kecil (PDF A6).
- Link cepat di **Dashboard > Overview**.
- Contoh **firestore.rules** untuk koleksi `invoices`, `receipts`, dan `deals`.

## Instalasi
1. Salin file-file ke project Anda (Vite + React + TS).
2. Tambah dependencies:
   ```bash
   npm i jspdf html2canvas
   ```
3. Pastikan route di `src/App.tsx` tidak bertabrakan dengan milik Anda.
4. Update `Overview.tsx` agar mengambil data asli dari Firestore:
   - Koleksi `deals` berisi data klien & pilihan paket.
   - Tampilkan tombol **Buka Invoice** & **Buka Kuitansi** per-deal.
5. Sesuaikan **firestore.rules** di root project Firebase Anda.
6. Deploy rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Catatan
- Komponen menggunakan contoh data; hubungkan ke Firestore sesuai skema Anda.
- Kuitansi dibuat pada format A6 (105x148mm) agar kecil seperti kuitansi toko.
- Invoice default A4 dan menangani konten multi-halaman.
- Jika Anda ingin nomor invoice otomatis, buat field `counter` di koleksi khusus dan gunakan Cloud Functions / transaksi untuk increment.