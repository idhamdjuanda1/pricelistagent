# Pricelist Interaktif - Vendor Wedding
Stack: React + Vite + Firebase (Auth, Firestore)

## Fitur Utama
- Dashboard (protected): CRUD vendor profile, packages (pricelist), add-ons, diskon, token activation
- Publish (public): `/publish/:uid` – tabs parent, slide jenis, add-on checklist, tombol WhatsApp
- Superadmin (standalone password): generate tokens, pantau status
- Firestore rules aman (read publik yang dibutuhkan, write by owner)

## Setup Cepat
```bash
# clone
git clone https://github.com/<you>/pricelist-interaktif.git
cd pricelist-interaktif

# install
npm i

# env lokal
copy .env.local.example .env.local
# isi sesuai kredensial Firebase kamu

# dev
npm run dev
