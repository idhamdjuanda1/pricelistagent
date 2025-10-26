    export function formatCurrency(n: number | undefined | null) {
      const v = typeof n === 'number' ? n : 0
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
    }

    function normalizePhoneForWa(raw: string) {
      const digits = (raw || '').replace(/\D/g, '')
      if (!digits) return ''
      if (digits.startsWith('0')) return '62' + digits.slice(1)
      if (digits.startsWith('62')) return digits
      return digits
    }

    export type WaPayload = {
      vendorName: string
      pricelistName: string
      typeName: string
      details: string[]
      price: number
      addons: { name: string; price: number }[]
      whatsapp: string
      total: number
    }

    export function waLink(p: WaPayload) {
      const details = (p.details || []).map(d => `• ${d}`).join('\n')
      const addons = (p.addons && p.addons.length)
        ? p.addons.map(a => `${a.name} (${formatCurrency(a.price)})`).join(', ')
        : '–'
      const text =
`Halo ${p.vendorName}, saya tertarik paket ${p.pricelistName} – ${p.typeName}.
Rincian singkat:
${details}
Harga paket: ${formatCurrency(p.price)}
Add-on: ${addons}
Total perkiraan: ${formatCurrency(p.total)}

Mohon info ketersediaan & detail lanjut. Terima kasih!`
      const num = normalizePhoneForWa(p.whatsapp)
      return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
    }

    export function tokenToId(token: string) { return (token || '').trim().toUpperCase() }
    export function makeToken(len = 16) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      const arr = new Uint8Array(len)
      crypto.getRandomValues(arr)
      return Array.from(arr).map(n => alphabet[n % alphabet.length]).join('')
    }
    export function cls(...xs: Array<string | false | null | undefined>) { return xs.filter(Boolean).join(' ') }
