# Deploy ke Railway — Bot + Panel dalam satu service

## Kenapa strukturnya begini

Railway mengizinkan **satu Volume per service**, dan Volume tidak bisa dipasang ke dua service sekaligus. Karena kamu memilih panel yang membaca database bot secara **langsung** (bukan lewat API), bot dan panel harus berada di service Railway yang **sama** — satu container, dua proses Node.js, berbagi satu Volume berisi file `storage-database`.

`start.js` di root folder ini yang menyalakan keduanya sekaligus. Kalau salah satu proses mati, semuanya berhenti dan Railway otomatis me-restart service (sesuai `railway.json`).

Kalau nanti kamu ingin bot dan panel benar-benar terpisah di dua service Railway, itu bisa, tapi panel tidak lagi bisa baca file secara langsung — harus lewat Postgres atau API kecil di bot. Kabari saya kalau butuh versi itu.

## Langkah deploy

### 1. Push folder ini ke GitHub

Struktur yang diperlukan:
```
toko-railway/
├── package.json      (root, dengan workspaces)
├── start.js
├── nixpacks.toml
├── railway.json
├── bot/               (bot Discord)
└── panel/             (panel web)
```

### 2. Buat project baru di Railway

Railway → New Project → Deploy from GitHub repo → pilih repo ini.

### 3. Tambahkan Volume

Di service yang baru dibuat: klik kanan pada canvas project (atau tekan `⌘K` / `Ctrl+K`) → **Create Volume** → hubungkan ke service ini → isi **mount path**: `/data`.

### 4. Isi Environment Variables

Buka tab **Variables** di service, isi:

| Nama | Isi |
|---|---|
| `TOKEN` | token bot Discord kamu (yang **baru**, setelah reset) |
| `CLIENT_ID` | Application ID bot di Discord Developer Portal |
| `DB_PATH` | `/data/storage-database` |
| `ADMIN_USERNAME` | username buat masuk panel |
| `ADMIN_PASSWORD` | password panel — jangan dibiarkan bawaan |
| `SESSION_SECRET` | string acak panjang |
| `GUILD_ID` | (opsional) isi kalau bot dipasang di lebih dari satu server |

Jangan buat file `.env` di repo — Railway membaca dari tab Variables ini, bukan file.

### 5. Deploy

Railway build otomatis lewat `nixpacks.toml` (menginstal dependency root + `bot/` + `panel/` sekaligus lewat npm workspaces, termasuk kompilasi `better-sqlite3` dan `@napi-rs/canvas`). Setelah deploy sukses:

- Log akan menampilkan `[BOT] Login sebagai ...` dan `[PANEL] Berjalan di http://localhost:...` berurutan.
- Railway kasih kamu satu URL publik (Settings → Networking → Generate Domain) — itu otomatis mengarah ke Panel Web, karena panel yang mendengarkan `PORT` yang disediakan Railway. Bot tidak butuh port publik, dia konek ke Discord lewat gateway.

### 6. Jalankan `/setup` di Discord seperti biasa

Kalau ini deploy pertama (database masih kosong), jalankan `/setup` di server Discord kamu dulu supaya `guild_config` terisi sebelum membuka panel.

## Backup database

Volume Railway bisa di-backup lewat CLI:

```bash
railway volume files download /storage-database ./backup-storage-database
```

Lakukan ini berkala — file itu satu-satunya sumber data toko kamu (produk, order, transaksi, vouch).

## Catatan tentang fitur Pengumuman

Paket `bot/` di sini **sudah termasuk** `handlers/webPanel.js` dan patch kecil di `database.js` + `events/ready.js` yang membuat tombol "Kirim Pengumuman" di panel berfungsi. Diffnya tetap minimal seperti yang sudah dijelaskan sebelumnya — tidak ada satu pun logika order/produk/vouch yang diubah, cuma dua tabel tambahan (`web_broadcast_queue`, `web_panel_status`) dan satu file baru.
