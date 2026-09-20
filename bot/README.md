# Discord Store Bot (Termux Edition)

Bot Discord toko online: tambah barang dengan pilih/buat channel sendiri, order lewat menu pilihan produk + Modal, QRIS otomatis di tiap channel order, konfirmasi Berhasil/Dibatalkan di channel admin terpisah, generate nota bergaya struk thermal (+barcode) via DM, auto-delete channel order, dan panel admin dengan tombol Buka/Tutup Toko. Dibangun dengan `discord.js` v14 + `better-sqlite3` (ringan RAM, cocok untuk Termux Android).

## 1. Struktur Project

```
discord-store-bot/
├── index.js                 # Entry point bot
├── deploy-commands.js        # Registrasi slash command
├── database.js               # Semua akses DB (better-sqlite3)
├── config.json               # Kustomisasi label/emoji tombol & teks pesan
├── .env.example               # Contoh token/credential
├── commands/                 # /setup, /status, /admin_panel, /order, /katalog, /pembukuan, /transaksi, /reset, /role_rewards
├── events/                   # ready, interactionCreate
├── handlers/                 # orderManager, deliveryManager, receiptGenerator, buttons (modal/select flow)
└── data/                     # fallback lokasi DB jika Internal Storage belum di-setup
```
> Database sebenarnya (default) TIDAK disimpan di folder `data/` ini, melainkan langsung di Internal Storage HP. Lihat bagian **Lokasi Database** di bawah.

## 2. Instalasi di Termux

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git python make clang termux-api
```
`python`, `make`, `clang` dibutuhkan untuk mengompilasi `better-sqlite3` (native module).

Izinkan Termux mengakses Internal Storage HP (database akan disimpan di sini):
```bash
termux-setup-storage
```
Sebuah dialog izin penyimpanan akan muncul di Android — tekan **Allow/Izinkan**. Ini akan membuat folder `~/storage/shared` yang tersambung langsung ke Internal Storage HP kamu.

```bash
cd discord-store-bot
npm install
```

Jika `npm install` gagal karena `better-sqlite3` gagal build:
```bash
pkg install -y binutils
npm install better-sqlite3 --build-from-source
```

> **Tentang gambar nota (`@napi-rs/canvas`)**: bot ini memakai `@napi-rs/canvas`, bukan library `canvas` klasik, karena `canvas` (node-canvas) butuh kompilasi native berat (cairo/pango/dll) yang sering gagal di Termux. `@napi-rs/canvas` sudah prebuilt binary sehingga jauh lebih ringan & stabil dipasang di HP.
>
> **Tentang font nota**: nota memakai font monospace supaya tampil rapi ala struk thermal. Bot otomatis mencoba mendaftarkan font monospace dari beberapa lokasi umum Android (`/system/fonts/RobotoMono-Regular.ttf`, dst). Kalau di HP kamu teks nota terlihat berantakan/kotak-kotak, kabari saya — kita bisa sertakan file font custom secara manual.

## 3. Lokasi Database

Secara default, database SQLite disimpan di **Internal Storage HP** dengan nama:
```
/storage/emulated/0/storage-database
```
(diakses lewat symlink Termux `~/storage/shared/storage-database`, aktif setelah `termux-setup-storage`).

Backup kapan saja lewat File Manager Android (file `storage-database`, `storage-database-wal`, `storage-database-shm` — JANGAN dihapus manual saat bot berjalan).

Lokasi custom? Set `DB_PATH` di `.env`.

## 4. Konfigurasi Token

```bash
cp .env.example .env
nano .env
```
Isi `TOKEN`, `CLIENT_ID`, dan opsional `GUILD_ID`.

Undang bot dengan scope `bot applications.commands` dan permission minimal:
`Manage Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`.

## 5. Deploy & Jalankan

```bash
npm run deploy
npm start
```

## 6. Alur Pemakaian

### a. Setup awal
Jalankan `/setup` — isi channel/attachment lewat opsi command, lalu di langkah terakhir bot menampilkan **dropdown pilih Role Admin (bisa pilih lebih dari 1 role sekaligus)**:
- **Channel Log** (riwayat transaksi publik)
- **Channel Testimoni**
- **Channel Info Toko** (broadcast buka/tutup, restok, ubah harga)
- **Channel Status Pembayaran** (channel khusus admin — tombol Berhasil/Dibatalkan akan muncul di sini, BUKAN di channel order pembeli)
- **Channel Vouch** (tempat rating/testimoni pembeli diposting)
- **QRIS** (upload gambar QRIS pembayaran — otomatis tampil di tiap channel order baru)
- **Metode Pembayaran** (teks tambahan, misal rekening/e-wallet)
- **Role Admin** (dropdown terakhir, bisa multi-select)

### b. Panel Admin
Jalankan `/admin_panel` (tampil publik). Berisi:
- **TAMBAHKAN** (khusus tipe **Item**) → bot tanya "buat channel baru" atau "pilih channel yang sudah ada". Kalau buat channel baru, bot juga tanya mau diletakkan di **kategori channel (folder Discord)** yang mana (atau tanpa kategori) → isi Nama, Harga, Stok (tanpa perlu ketik tipe — selalu Item) → jeda 3 detik → bot minta foto dikirim manual di channel yang sama (kalau dikirim dalam 45 detik, otomatis terpasang ke produk) → bot publikasikan pesan barang ke channel tersebut.
- **Restok** (khusus tipe **Item**) → pilih produk via dropdown → isi jumlah stok tambahan.
- **Upload Akun** (khusus tipe **Akun**) → pilih produk Akun yang sudah ada (isi Modal **USN, EMAIL, PASSWORD, DESKRIPSI**, 1 akun per submit) **atau** pilih **"➕ Buat Produk Akun Baru"** (proses sama seperti TAMBAHKAN — pilih/buat channel dulu — lalu Modal Nama, Harga, USN, EMAIL, PASSWORD untuk akun pertamanya).
- **Ubah Info/Harga** → pilih produk via dropdown → isi modal.
- **Hapus Produk** → pilih produk via dropdown → konfirmasi Ya/Batal → produk & pesan katalognya dihapus permanen (data akun terkait ikut terhapus).
- **Buka Toko** / **Tutup Toko** → klik langsung, tidak perlu command. Status ikut ter-update di panel & broadcast ke channel info.

Setiap Restok/Upload Akun, pesan katalog produk itu **dihapus & diposting ulang sebagai chat baru** (bump ke bawah channel), dan otomatis muncul lagi kalau sebelumnya sempat hilang karena stok habis.

### c. Memasang Tombol Order (`/order place`)
Command ini adalah **wizard 3 langkah** untuk admin, dijalankan cukup **sekali** untuk memasang tombol Order (tunggal, menampilkan semua barang Item & Akun sekaligus):
1. **Pilih kategori channel** (folder Discord) — tempat channel-channel order baru akan dibuat setiap kali ada pembeli checkout lewat tombol ini.
2. **Pilih channel** — tempat pesan + tombolnya akan dipasang.
3. **Modal**: isi Judul & Isi pesan (jadi embed custom), dan **teks tombolnya sendiri** (bebas, mis. "Beli Sekarang").

Bot lalu memposting embed custom + tombol tersebut ke channel yang dipilih. Konfigurasi (kategori channel, channel post) tersimpan permanen di database, terikat ke tombol itu.

### d. Alur Order Pembeli
1. Pembeli klik tombol **Order** yang sudah dipasang admin (tidak perlu mengetik command apapun).
2. Bot memunculkan **menu pilih channel order** (StringSelectMenu, berdasarkan kategori/channel tempat barang dipublikasikan).
3. Setelah channel dipilih, bot memunculkan **menu pilih barang** yang tersedia di channel tersebut.
4. Setelah barang dipilih, barulah **Modal** muncul (USN, Jumlah).
5. Submit → bot membuat channel order baru **sekuensial** (`order-001`, `order-002`, dst — dibuat di dalam kategori channel yang sudah diatur admin di langkah 1 wizard `/order place`), dengan **ID Transaksi format `WX[nomor acak]`** (contoh: `WX583920`).
6. Di channel order: QRIS otomatis tampil + instruksi **"BERIKAN BUKTI TRANSAKSI atau akan hangus."** Pembeli tinggal upload foto bukti transfer langsung di channel (permission sudah diizinkan).
7. Bot mengirim log **"ID / USN / ORDER / STATUS: MENUNGGU KONFIRMASI"** beserta tombol **Berhasil**/**Dibatalkan** ke **Channel Status Pembayaran** (bukan ke channel order pembeli) — hanya Admin/Owner yang bisa menekannya.

### e. Konfirmasi Admin
- **Berhasil** → teks STATUS di channel admin berubah jadi `BERHASIL`, bot generate **gambar nota ASCII monospace** dan mengirim via DM ke pembeli. Channel order **dikunci** (pembeli tidak bisa chat lagi, tapi masih bisa lihat & klik tombol) dan **TIDAK dihapus otomatis** — baru terhapus setelah pembeli memberikan vouch (lihat bagian g).
- **Dibatalkan** → teks STATUS berubah jadi `DIBATALKAN`, stok dikembalikan, channel order pembeli dihapus, **tanpa** notifikasi DM apapun ke pembeli.
- Jika 60 menit tidak ada tindakan admin sama sekali, order otomatis hangus (anti-spam) & channel dihapus.

### f. Reset Order Macet
Kadang order bisa "macet" di status PENDING (misalnya channel order-nya kehapus manual tanpa lewat tombol Berhasil/Dibatalkan) — akibatnya pembeli itu dianggap masih punya "order aktif" selamanya dan tidak bisa order baru. Jalankan **`/reset`** (opsional isi `user` untuk reset hanya milik orang itu, kosongkan untuk reset SEMUA order pending sekaligus) — stok dikembalikan, channel (jika masih ada) dihapus, dan status order aktifnya hilang.

### g. Vouch (Rating & Testimoni)
Saat `/setup`, isi juga **Channel Vouch** — tempat vouch dari pembeli akan diposting. Alurnya:
1. Setelah order **Berhasil**: channel order dikunci (tidak bisa chat) lalu diposting teks **"Jangan lupa kasih rating yaa🌟"** + tombol **Berikan Vouch** di channel order itu sendiri. DM ke pembeli (setelah nota) juga dapat tombol yang sama, dengan teks berbeda: *"Pembelian dengan nominal **Rp...** telah selesai. 📌 Agar nominal belanjaanmu masuk ke leaderboard, silahkan klik tombol di bawah untuk memberikan vouch."*
2. Klik tombol (dari channel order ATAU DM, sama-sama berfungsi) → muncul Modal: **Rating (1-5)** + **Komentar Vouch**.
3. Submit → bot posting ke **Channel Vouch** dengan format:
   ```
   VOUCH Rp150.000
   Dari @user
   Rating
   ⭐⭐⭐⭐⭐
   komentar
   [isi komentar]
   ```
   (embed warna oranye). Satu transaksi hanya bisa vouch sekali.
4. Setelah vouch diberikan, **channel order langsung dihapus** (baru saat inilah channel benar-benar hilang).

### h. Role Rewards (Role Otomatis Berdasar Total Nominal Belanja)
Kelola lewat `/role_rewards` (maks **6 role** per server), berbasis **akumulasi total Rupiah** yang sudah dibelanjakan (bukan jumlah transaksi):
- `/role_rewards add role:@VIP minimal_belanja:500000` → role `@VIP` otomatis diberikan setelah total belanja pembeli mencapai **Rp500.000**.
- `/role_rewards list` → lihat semua role reward yang sudah diatur.
- `/role_rewards remove role:@VIP` → hapus dari daftar.

Role diberikan otomatis tepat setelah admin klik **Berhasil**. Kalau pembeli memenuhi beberapa ambang batas sekaligus, semua role yang relevan diberikan (role sebelumnya tidak dicopot). Pastikan role bot **Store Bot** berada **di atas** role-role reward ini di pengaturan server, kalau tidak Discord akan menolak permintaan pemberian role.

### i. Laporan
`/pembukuan` untuk omset & produk terlaris. `/transaksi` untuk export riwayat ke Excel (nomor urut tidak pernah reset) — kolom **ID** menampilkan **ID Transaksi (`WX...`)** (bukan Discord User ID), kolom **HARGA** per transaksi, plus baris **TOTAL KESELURUHAN** di paling bawah — semua dengan bar judul & aksen kolom warna hijau.

## 7. Kustomisasi

Semua label/emoji tombol & teks pesan bisa diubah di `config.json` tanpa menyentuh kode.
