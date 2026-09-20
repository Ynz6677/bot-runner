# 📍 Panduan Edit Teks Bot — Per Command

Dokumen ini memetakan **setiap command/fitur → di file mana & baris/key apa** teksnya
bisa diubah. Ada 2 kategori:

- 🟢 **config.json** — paling gampang, tinggal edit teks di antara tanda kutip `" "`, simpan, lalu `npm start` ulang. Tidak perlu paham JavaScript.
- 🟡 **Hardcode di file `.js`** — teks tertanam langsung di kode. Cari teks persis yang tertulis di kolom "Cari teks ini", ganti isinya, jangan hapus tanda kutip/backtick/koma di sekelilingnya.

Setelah edit file manapun, restart bot (`Ctrl+C` lalu `npm start` lagi) supaya perubahan kebaca.

---

## 🟢 `config.json` — Pusat kustomisasi (paling sering dipakai)

| Key | Dipakai di | Contoh isi saat ini |
|---|---|---|
| `buttons.tambahkan` | Tombol di `/admin_panel` | label "TAMBAHKAN" |
| `buttons.restok` | Tombol di `/admin_panel` | label "Restok" |
| `buttons.ubah_harga` | Tombol di `/admin_panel` | label "Ubah Info / Harga" |
| `buttons.hapus_produk` | Tombol di `/admin_panel` | label "Hapus Produk" |
| `buttons.buka_toko` / `buttons.tutup_toko` | Tombol di `/admin_panel` | label "Buka Toko" / "Tutup Toko" |
| `buttons.berhasil` / `buttons.dibatalkan` | Tombol konfirmasi di channel Status Pembayaran | label "Berhasil" / "Dibatalkan" |
| `buttons.buat_channel_baru` / `buttons.pilih_channel_ada` | Tombol saat alur TAMBAHKAN | label "Buat Channel Baru" / "Pilih Channel yang Ada" |
| `buttons.export_reset` / `buttons.batal_export` | Tombol konfirmasi di `/transaksi` | label "Ya, Export & Reset" / "Batal" |
| `messages.toko_open_title/desc` | Broadcast ke channel info saat toko dibuka | judul & isi pengumuman |
| `messages.toko_close_title/desc` | Broadcast ke channel info saat toko ditutup | judul & isi pengumuman |
| `messages.toko_closed_error` | Balasan saat orang order tapi toko CLOSE | teks error |
| `messages.bukti_transaksi_warning` | Pesan peringatan di channel order baru | "BERIKAN BUKTI TRANSAKSI..." |
| `messages.testimoni_edukasi` | DM ke pembeli setelah order sukses | pakai `{testimoni}` & `{server}` sbg placeholder otomatis |
| `status_labels.MENUNGGU/BERHASIL/DIBATALKAN` | Teks STATUS di channel Status Pembayaran | label status |
| `timeout_order_minutes` | Batas waktu order sebelum hangus otomatis | angka menit |
| `auto_delete_after_success_ms` | Jeda hapus channel order setelah sukses | milidetik (15000 = 15 detik) |

> ℹ️ Label & isi pesan tombol **Order**/**Jual Akun** (judul, isi embed, teks tombol) TIDAK lagi diatur lewat `config.json` — sekarang diatur langsung tiap kali admin menjalankan wizard `/order place` (lihat bagian di bawah).

📌 **Cara edit**: buka `config.json`, ubah teks di antara kutip `" "` pada key yang sesuai. Jangan hapus koma `,` atau kurung kurawal `{ }`.

---

## 🟡 Per-Command — Teks yang tertanam di kode (`.js`)

### `/setup` → `commands/setup.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 28 | `'❌ File QRIS harus berupa gambar (PNG/JPG).'` | Error validasi QRIS |
| 38 | `'Pilih 1 atau lebih role Admin toko'` | Placeholder menu pilih role (sekarang bisa pilih LEBIH DARI 1 role admin sekaligus) |
| 43 | `'👤 Terakhir, pilih role Admin toko (bisa pilih lebih dari satu):'` | Instruksi langkah pilih role |
| 68 | `'⚙️ Konfigurasi Toko Berhasil Disimpan'` | Judul embed konfirmasi |
| 70–75 | `'Role Admin'`, `'Channel Log Riwayat'`, `'Channel Testimoni'`, `'Channel Info Toko'`, `'Channel Status Pembayaran'`, `'Metode Pembayaran'` | Label field di embed konfirmasi |

> ℹ️ Role Admin sekarang dipilih lewat menu (RoleSelectMenu), bukan opsi command — jadi bisa pilih lebih dari 1 role sekaligus. Semua role tersimpan dipisah koma di database, dan `utils/permissions.js` otomatis mengecek keanggotaan salah satu dari role-role tersebut.

### `/status` → `commands/status.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 18 | `'⚠️ Jalankan \`/setup\` terlebih dahulu.'` | Error kalau belum setup |
| 26 | `` `✅ Status toko diubah menjadi **${label}**.` `` | Konfirmasi ganti status |
| Judul/isi pengumuman ke channel info diambil dari **config.json** (`toko_open_title`, dst), bukan hardcode di sini. | | |

### `/admin_panel` → `commands/admin_panel.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 24 | `'🛠️ Panel Admin Toko'` | Judul panel |
| 25 | `'Gunakan tombol di bawah untuk mengelola produk & status toko.'` | Deskripsi panel |
| 26 | `'Status Toko Saat Ini'` | Label field status |
| Label tombolnya sendiri (TAMBAHKAN, Restok, dll) diambil dari **config.json** `buttons.*`. | | |

### `/order place` → `commands/order.js`
Command ini sekarang berupa **wizard 4 langkah** yang dijalankan admin untuk memasang tombol Order/Jual Akun — judul embed, isi embed, dan teks tombolnya **diisi manual oleh admin saat wizard berjalan** (bukan teks tetap di file), jadi tidak ada yang perlu "diedit" di kode untuk mengganti isi pesannya. Yang tertanam di kode hanyalah teks instruksi wizard-nya sendiri:
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 33 | `{ label: 'Order (barang tipe Item)', value: 'item', emoji: '🛒' }` | Opsi 1 di langkah pilih tipe tombol |
| 34 | `{ label: 'Jual Akun (barang tipe Akun)', value: 'akun', emoji: '🔐' }` | Opsi 2 di langkah pilih tipe tombol |
| 38 | `'1️⃣ Pilih tipe tombol yang mau dibuat:'` | Instruksi langkah 1 |
| 55 | `'2️⃣ Pilih kategori channel (folder) tempat channel order baru akan dibuat:'` | Instruksi langkah 2 |
| 70 | `'3️⃣ Pilih channel tempat pesan & tombol ini akan dipasang:'` | Instruksi langkah 3 |
| 81–84 | `'Judul Pesan (embed)'`, `'Isi Pesan (embed)'`, `'Tulisan pada Tombol'` | Label field Modal langkah 4 |
| 122 | `` `✅ Tombol **${teksTombol}** berhasil dipasang di <#...>.` `` | Konfirmasi akhir ke admin |

### `/katalog` → `commands/katalog.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 10 | `` `💰 **${formatRupiah(product.price)}**  •  📦 Stok: **${product.stock}**  •  🏷️ ${tipeLabel}` `` | Format baris deskripsi produk (harga • stok • tipe) |
| ~38 | `` `✅ Katalog **${product.name}** berhasil ditampilkan di channel ini. Untuk order, pembeli gunakan \`/order place\`.` `` | Konfirmasi ke admin setelah repost katalog |

### `/pembukuan` → `commands/pembukuan.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 16 | `'📊 Pembukuan Toko'` | Judul embed |
| 18–21 | `'Total Omset'`, `'Transaksi Sukses'`, `'Transaksi Gagal/Batal'`, `'Produk Terlaris'` | Label field |

### `/transaksi` → `commands/transaksi.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 22 | `'ℹ️ Tidak ada data transaksi baru untuk di-export.'` | Kalau tidak ada data |
| 31 | `` `⚠️ Ditemukan **${rows.length}** transaksi belum di-export. Export ke Excel sekarang?...` `` | Konfirmasi sebelum export |
| 38 | `'⏱️ Waktu konfirmasi habis, dibatalkan.'` | Timeout konfirmasi |
| 41 | `'🚫 Export dibatalkan.'` | Saat klik Batal |
| 49–53 | `'NO'`, `'USN'`, `'ORDER'`, `'ID'`, `'TANGGAL'` | Header kolom file Excel |
| 66 | `` `✅ ${rows.length} transaksi berhasil di-export & direset...` `` | Konfirmasi sukses export |
| Label tombol (Ya Export/Batal) diambil dari **config.json** `buttons.export_reset` & `buttons.batal_export`. | | |

### Alur order pembeli (tombol Order/Jual Akun → pilih channel → pilih barang → Modal) → `handlers/orderManager.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 41 | `'⚠️ Belum ada barang yang tersedia (stok kosong) saat ini.'` | Kalau semua stok habis |
| 46 | `'Pilih channel order'` | Placeholder dropdown channel |
| 55 | `'📂 Silakan pilih channel order barang yang ingin kamu beli:'` | Teks langkah 1 |
| 66 | `'⚠️ Tidak ada barang tersedia di channel order ini.'` | Kalau channel kosong |
| 71 | `'Pilih barang yang ingin dipesan'` | Placeholder dropdown produk |
| 81 | `'🛒 Silakan pilih barang yang ingin kamu pesan:'` | Teks langkah 2 |
| 89 | `'❌ Produk tidak ditemukan / sudah dihapus.'` | Error produk hilang |
| 93–94 | `'USN / Nama Kamu'`, `'Jumlah Pembelian'` | Label field Modal |
| 104, 106 | `'❌ USN/Nama tidak boleh kosong.'`, `'❌ Jumlah pembelian wajib berupa angka bulat positif...'` | Validasi Modal |
| 121 | `'⚠️ Toko belum dikonfigurasi lengkap...'` | Error setup belum lengkap |
| 132 | `` `⚠️ Kamu masih memiliki order aktif di <#...>...` `` | Anti-spam 1 order aktif |
| 138 | `` `❌ Stok **${product.name}** tidak mencukupi...` `` | Stok kurang |
| 167 | `'❌ Gagal membuat channel order...'` | Error buat channel |
| 187 | `'💳 Pembayaran via QRIS'` + deskripsi default + footer "ID Transaksi: ... \| Batas waktu ... menit" | Embed QRIS di channel order |
| 193 | `` `<@...> Terima kasih sudah order!` `` | Sapaan pembuka di channel order |
| 204 | `'🧾 Rincian Pesanan'` + label field `ID/USN/ORDER/JUMLAH/HARGA` | Embed rincian pesanan pembeli |
| 228 | `` `✅ Order berhasil dibuat! Silakan lanjut ke <#...>` `` | Konfirmasi akhir ke pembeli |
| 245 | `'⏰ Order hangus otomatis karena bukti transaksi tidak diberikan...'` | Pesan saat order expired |
| 15–24 (fungsi `statusLogText`) | Format `ID / USN / ORDER / STATUS` | Format log di channel Status Pembayaran — status labelnya sendiri diambil dari **config.json** `status_labels` |
| ~148 | `` `order-${String(orderNumber).padStart(3, '0')}` `` | Format nama channel order (`order-001`, dst) — jangan diubah kecuali paham penomoran |
| ~141 | `generateTransactionId()` (di `utils/helpers.js`) | Format ID Transaksi `WX[nomor acak]` |

### Konfirmasi Admin (Berhasil/Dibatalkan) → `handlers/deliveryManager.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 29–36 | `` `USN    : ...` `` dst | Format log ke channel riwayat publik saat BERHASIL |
| 65 | `` `🧾 Berikut nota pembelian kamu untuk order **...** (BERHASIL):` `` | Caption DM gambar nota |
| 77 | `` `🔐 Berikut data akun untuk pesanan **...** kamu:` `` | Caption DM data akun (tipe Akun) |
| 88 | `'✅ Transaksi selesai & sudah tercatat. Channel ini akan dihapus sekarang.'` | Pesan sebelum auto-delete channel |
| 101 | `'⚠️ Order ini sudah tidak berstatus MENUNGGU KONFIRMASI...'` | Error klik Berhasil 2x |
| 106 | `` `✅ Order **...** dikonfirmasi BERHASIL...` `` | Konfirmasi ke admin |
| 113 | `'⚠️ Order ini sudah tidak bisa dibatalkan.'` | Error klik Dibatalkan 2x |
| 131 | `'❌ Order dibatalkan oleh Admin. Channel ini akan dihapus.'` | Pesan di channel order saat dibatalkan |
| 138 | `` `✅ Order **...** dibatalkan & stok telah dikembalikan.` `` | Konfirmasi ke admin |
| Pesan testimoni DM diambil dari **config.json** `messages.testimoni_edukasi`, bukan di sini. | | |

### Alur TAMBAHKAN (barang baru) → `handlers/buttons.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 51 | `'📂 Barang ini mau dipublikasikan ke channel yang mana?'` | Langkah 1 |
| 63 | `'Nama Channel Baru'` (judul Modal) | Modal buat channel baru |
| 75 | `'Tanpa Kategori'` (label tombol) | Tombol skip saat pilih kategori channel |
| 77 | `` `📁 Channel **${namaChannel}** mau diletakkan di kategori mana?` `` | Langkah pilih kategori channel (folder Discord) |
| 94 | `'❌ Gagal membuat channel baru...'` | Error buat channel |
| 98–99 | `'Pilih channel tujuan'`, `'📂 Pilih channel tujuan publikasi barang:'` | Langkah pilih channel yang sudah ada |
| 112, 114–117 | `'Detail Barang'` (judul Modal), `'Nama Produk'`, `'Harga (angka saja)'`, `'Item (ketik: item / akun)'`, `'Stok Awal (angka saja)'` | Label field Modal detail barang |
| 133–135 | `'❌ Harga harus berupa angka bulat positif.'`, `'❌ Item harus diisi "item" atau "akun".'`, `'❌ Stok harus berupa angka bulat...'` | Validasi |
| 154 | `'produk sudah di tambahkan, untuk foto kirim secara manual!'` | Pesan ephemeral setelah produk ditambahkan (muncul instan, lalu bot jeda 3 detik sebelum mulai menunggu upload foto) |
| 177 | `` `🎉 Barang **...** berhasil dipublikasikan di <#...>.` `` | Konfirmasi akhir |

> ℹ️ **Stok habis otomatis disembunyikan**: begitu stok produk jadi 0 (dari sebuah order), pesan katalognya otomatis dihapus dari channel (lihat `handlers/orderManager.js`, dekat `clearProductMessageId`). Saat direstok lewat tombol **Restok**, pesan katalognya otomatis dipublikasikan ulang (lihat blok "republish" di `handlers/buttons.js`, sebelum baris 256).

### Alur RESTOK → `handlers/buttons.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 185 | `'⚠️ Belum ada produk. Tambahkan produk dulu.'` | Kalau belum ada produk |
| 189 | `'Pilih produk yang mau di-restok'` | Placeholder dropdown |
| 230, 236 | `'❌ Data akun tidak boleh kosong.'`, `'❌ Jumlah stok harus angka bulat positif.'` | Validasi |
| 256 | `` `✅ Stok **...** berhasil ditambah ${jumlahDitambahkan}.` `` | Konfirmasi |
| 260 | `` `📦 Restok: ${product.name}` `` | Judul broadcast ke channel info |

### Alur UBAH HARGA → `handlers/buttons.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 278 | `'⚠️ Belum ada produk.'` | Kalau belum ada produk |
| 282 | `'Pilih produk yang mau diubah harganya'` | Placeholder dropdown |
| 308 | `'❌ Harga baru harus angka bulat positif.'` | Validasi |
| 312 | `` `✅ Harga **...** diubah dari ... menjadi ...` `` | Konfirmasi |
| 318 | `` `✏️ Update Harga: ${product.name}` `` | Broadcast ke channel info |

### Alur HAPUS PRODUK → `handlers/buttons.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 336 | `'⚠️ Belum ada produk.'` | Kalau belum ada produk |
| 340 | `'Pilih produk yang mau dihapus'` | Placeholder dropdown |
| 351 | `` `Ya, Hapus "${product.name}"` `` | Label tombol konfirmasi |
| 355 | `` `⚠️ Produk **...** akan dihapus PERMANEN...Yakin?` `` | Teks konfirmasi |
| 363 | `'🚫 Penghapusan produk dibatalkan.'` | Saat klik Batal |
| 379 | `` `✅ Produk **...** berhasil dihapus permanen dari database & katalog.` `` | Konfirmasi sukses |

### Alur BUKA/TUTUP TOKO → `handlers/buttons.js`
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 394 | `` `✅ Status toko diubah menjadi **${label}**.` `` | Konfirmasi ke admin yang klik |
| 399 | `'Status Toko Saat Ini'` | Label field yang di-update di panel |
| Judul/isi pengumuman ke channel info diambil dari **config.json**. | | |

### Gambar Nota (dikirim ke pembeli via DM) → `handlers/receiptGenerator.js`
⚠️ Bagian ini digambar pakai `canvas` (bukan teks biasa), tapi sekarang formatnya adalah
daftar baris ASCII polos (mirip struk), jadi cukup ubah teks di dalam array `lines`.
| Baris | Cari teks ini | Keterangan |
|---|---|---|
| 64 | `centerText('NOTA TRANSAKSI')` | Judul nota |
| 65 | `centerText(serverDisplay)` | Nama toko/server (otomatis diambil dari nama server Discord) |
| 67 | `labelRow('Status', 'BERHASIL')` | Baris Status — nilainya selalu "BERHASIL" karena nota hanya dibuat saat order sukses |
| 68 | `labelRow('ID Transaksi', orderId)` | Baris ID Transaksi (format `WX[nomor acak]`) |
| 69 | `labelRow('Waktu', tanggalWIB)` | Baris Waktu |
| 71 | `labelRow('Pelanggan', usn)` | Baris Pelanggan |
| 72 | `labelRow('Produk', produkDisplay)` | Baris Produk |
| 73 | `labelRow('Harga', formatRupiah(hargaSatuan))` | Baris Harga satuan (harga per 1 barang, di atas Jumlah) |
| 74 | `labelRow('Jumlah', String(jumlah))` | Baris Jumlah |
| 76 | `labelRow('TOTAL TAGIHAN', formatRupiah(hargaTotal))` | Baris Total Tagihan |
| 79 | `centerText('Terima Kasih Telah Bertransaksi')` | Footer nota |

📌 **Cara ubah label** (mis. "Pelanggan" → "Nama Pembeli"): cukup ganti teks di dalam
tanda kutip pertama pada `labelRow('...', ...)`, contoh `labelRow('Nama Pembeli', usn)`.
Semua kolom `:` akan tetap sejajar otomatis (lebar label diatur oleh `LABEL_WIDTH = 13`
di bagian atas file — jangan diubah kecuali label barunya lebih panjang dari 13 huruf).

---

## 🧭 Ringkasan cepat: command → file utama

| Command | File utama |
|---|---|
| `/setup` | `commands/setup.js` |
| `/status` | `commands/status.js` + `config.json` |
| `/admin_panel` | `commands/admin_panel.js` + `config.json` |
| `/order place` | `commands/order.js` → memicu `handlers/orderManager.js` (`startOrderFlow`) |
| `/katalog` | `commands/katalog.js` |
| `/pembukuan` | `commands/pembukuan.js` |
| `/transaksi` | `commands/transaksi.js` |
| Tombol TAMBAHKAN/Restok/Ubah Harga/Hapus Produk/Buka-Tutup Toko | `handlers/buttons.js` |
| Tombol Berhasil/Dibatalkan | `handlers/deliveryManager.js` |
| Gambar nota (invoice) | `handlers/receiptGenerator.js` |

**Tips**: setiap kali habis edit teks di file `.js`, jalankan `node --check nama_file.js` dulu (tanpa perlu koneksi Discord) untuk memastikan tidak ada salah ketik tanda kutip/koma sebelum restart bot.
