// db.js
// Panel ini TIDAK punya database sendiri — ia membuka langsung file SQLite
// milik bot (yang sama persis dipakai bot Discord kamu) lewat DB_PATH di .env.
//
// Prinsip: read-only untuk hampir semua data (produk, order, pembukuan, vouch,
// role reward). Satu-satunya tulisan ke tabel INTI bot adalah:
//   - guild_config.store_status   (tombol Buka/Tutup Toko)
//   - products.stock              (tombol Restock)
//   - product_accounts            (restock produk tipe akun, insert baris baru)
// Ketiganya memakai kolom/tabel yang SUDAH ADA di bot — tidak ada ALTER TABLE,
// tidak ada tabel baru untuk data toko. Tidak ada logika order/produk/vouch
// yang diduplikasi di sini.
//
// Untuk fitur "Kirim Pengumuman", panel menitipkan pesan ke satu tabel kecil
// tambahan (web_broadcast_queue) yang dibaca bot lewat handlers/webPanel.js.
// Ini murni tambahan (additive) — tidak menyentuh satu pun kode/alur bot yang
// sudah ada. Kalau kamu belum menambahkan patch itu ke bot, tombol lain tetap
// berfungsi normal; hanya pengumuman yang akan tertunda sampai bot dipatch.

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function resolveDbPath() {
  if (process.env.DB_PATH && process.env.DB_PATH.trim() !== '') return process.env.DB_PATH.trim();
  // Path bawaan bot di Termux
  const dugaan = path.join(require('os').homedir(), 'storage', 'shared', 'storage-database');
  if (fs.existsSync(dugaan)) return dugaan;
  return path.join(__dirname, '..', 'data', 'storage-database');
}

const dbPath = resolveDbPath();
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[DB] Membuka database bot: ${dbPath}`);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Inisialisasi skema tabel jika belum ada
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    admin_role_id TEXT,
    log_channel_id TEXT,
    testimoni_channel_id TEXT,
    owner_channel_id TEXT,
    info_channel_id TEXT,
    payment_info TEXT,
    store_status TEXT NOT NULL DEFAULT 'OPEN',
    order_channel_id TEXT,
    admin_status_channel_id TEXT,
    qris_image_url TEXT,
    order_counter INTEGER DEFAULT 0,
    vouch_channel_id TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL CHECK(type IN ('item','akun')),
    category TEXT,
    image_url TEXT,
    channel_id TEXT,
    message_id TEXT,
    UNIQUE(guild_id, name),
    UNIQUE(guild_id, slug)
  );
  CREATE TABLE IF NOT EXISTS product_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    order_code TEXT NOT NULL,
    channel_id TEXT,
    buyer_id TEXT NOT NULL,
    buyer_username TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at INTEGER NOT NULL,
    usn TEXT,
    status_message_id TEXT
  );
  CREATE TABLE IF NOT EXISTS transaksi_ledger (
    no INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    usn TEXT NOT NULL,
    order_name TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    exported INTEGER NOT NULL DEFAULT 0,
    order_code TEXT,
    total_price INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS order_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    type TEXT,
    category_id TEXT,
    channel_id TEXT,
    message_id TEXT,
    button_label TEXT NOT NULL,
    embed_title TEXT,
    embed_description TEXT
  );
  CREATE TABLE IF NOT EXISTS vouches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    order_id INTEGER NOT NULL UNIQUE,
    buyer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS role_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    min_spending INTEGER NOT NULL,
    UNIQUE(guild_id, role_id)
  );
  CREATE TABLE IF NOT EXISTS web_broadcast_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    error TEXT,
    created_at INTEGER NOT NULL,
    processed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS web_panel_status (
    guild_id TEXT PRIMARY KEY,
    bot_tag TEXT,
    guild_name TEXT,
    last_seen INTEGER
  );
`);

// Server Discord yang dipantau.
function resolveGuildId() {
  const dariEnv = (process.env.GUILD_ID || '').trim();
  if (dariEnv) {
    const ada = db.prepare('SELECT guild_id FROM guild_config WHERE guild_id = ?').get(dariEnv);
    if (!ada) {
      db.prepare(`INSERT INTO guild_config (guild_id, store_status, payment_info) VALUES (?, 'OPEN', 'QRIS / Transfer Bank')`).run(dariEnv);
    }
    return dariEnv;
  }
  let baris = db.prepare('SELECT guild_id FROM guild_config LIMIT 1').get();
  if (!baris) {
    const defaultGid = '1001583300722';
    db.prepare(`INSERT INTO guild_config (guild_id, store_status, payment_info) VALUES (?, 'OPEN', 'QRIS / Transfer Bank')`).run(defaultGid);
    baris = { guild_id: defaultGid };
  }
  return baris.guild_id;
}

const GUILD_ID = resolveGuildId();
console.log(`[DB] Memantau server Discord: ${GUILD_ID}`);

// Seed produk awal jika kosong agar panel langsung siap digunakan
try {
  const countProd = db.prepare('SELECT COUNT(*) AS c FROM products WHERE guild_id = ?').get(GUILD_ID).c;
  if (countProd === 0) {
    db.prepare(`
      INSERT INTO products (guild_id, name, slug, price, stock, type, category)
      VALUES (?, 'Nitro Boost 1 Bulan', 'nitro-boost-1b', 35000, 15, 'item', 'Discord')
    `).run(GUILD_ID);
    db.prepare(`
      INSERT INTO products (guild_id, name, slug, price, stock, type, category)
      VALUES (?, 'Netflix Premium 1 Bulan', 'netflix-prem-1b', 45000, 5, 'akun', 'Streaming')
    `).run(GUILD_ID);
    const pAkun = db.prepare('SELECT id FROM products WHERE slug = ?').get('netflix-prem-1b');
    if (pAkun) {
      for (let i = 1; i <= 5; i++) {
        db.prepare('INSERT INTO product_accounts (product_id, content) VALUES (?, ?)').run(pAkun.id, `akun${i}@premium.com:pass${i}123`);
      }
    }
  }
} catch (e) {
  console.warn('[DB] Gagal seed produk:', e.message);
}

// ---------- KONFIGURASI TOKO (baca dari bot, tulis hanya store_status) ----------
const getConfig = () => db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(GUILD_ID);

function toggleStoreStatus() {
  const cfg = getConfig();
  const baru = cfg.store_status === 'OPEN' ? 'CLOSE' : 'OPEN';
  db.prepare('UPDATE guild_config SET store_status = ? WHERE guild_id = ?').run(baru, GUILD_ID);
  return baru;
}

// ---------- PRODUK (baca dari bot; tulis hanya stock & product_accounts) ----------
const listProducts = () => db.prepare('SELECT * FROM products WHERE guild_id = ? ORDER BY category, name').all(GUILD_ID);
const getProductById = (id) => db.prepare('SELECT * FROM products WHERE id = ? AND guild_id = ?').get(id, GUILD_ID);
const countAccountLines = (productId) =>
  db.prepare('SELECT COUNT(*) AS c FROM product_accounts WHERE product_id = ?').get(productId).c;

// Sama seperti fungsi addStockCount milik bot: cuma menambah angka stok.
function restockItem(productId, tambah) {
  const info = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND guild_id = ?').run(tambah, productId, GUILD_ID);
  if (info.changes === 0) throw new Error('Produk tidak ditemukan.');
}

// Sama seperti fungsi addAccountLines milik bot: insert baris akun + tambah stok.
function restockAkun(productId, lines) {
  const p = getProductById(productId);
  if (!p) throw new Error('Produk tidak ditemukan.');
  if (p.type !== 'akun') throw new Error('Produk ini bukan tipe akun.');
  const tx = db.transaction((arr) => {
    const ins = db.prepare('INSERT INTO product_accounts (product_id, content) VALUES (?, ?)');
    for (const isi of arr) ins.run(productId, isi);
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(arr.length, productId);
  });
  tx(lines);
}

// ---------- ORDER (murni baca, sama seperti query bot) ----------
const listOrders = (status) => (status
  ? db.prepare('SELECT * FROM orders WHERE guild_id = ? AND status = ? ORDER BY created_at DESC LIMIT 200').all(GUILD_ID, status)
  : db.prepare('SELECT * FROM orders WHERE guild_id = ? ORDER BY created_at DESC LIMIT 200').all(GUILD_ID));

const getPendingOrders = () => db.prepare(`SELECT * FROM orders WHERE guild_id = ? AND status = 'PENDING' ORDER BY created_at ASC`).all(GUILD_ID);

// ---------- PEMBUKUAN (query sama persis dengan command /pembukuan bot) ----------
function getPembukuan() {
  const omset = db.prepare(`SELECT COALESCE(SUM(total_price), 0) AS total FROM orders WHERE guild_id = ? AND status = 'SUCCESS'`).get(GUILD_ID).total;
  const sukses = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE guild_id = ? AND status = 'SUCCESS'`).get(GUILD_ID).c;
  const gagal = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE guild_id = ? AND status IN ('BATAL','EXPIRED')`).get(GUILD_ID).c;
  const pending = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE guild_id = ? AND status = 'PENDING'`).get(GUILD_ID).c;
  const terlaris = db.prepare(`
    SELECT product_name, SUM(quantity) AS total_qty, SUM(total_price) AS total_omset
    FROM orders WHERE guild_id = ? AND status = 'SUCCESS'
    GROUP BY product_name ORDER BY total_qty DESC LIMIT 5
  `).all(GUILD_ID);
  const harian = db.prepare(`
    SELECT strftime('%d-%m', created_at / 1000, 'unixepoch', '+7 hours') AS hari,
           COALESCE(SUM(total_price), 0) AS total
    FROM orders WHERE guild_id = ? AND status = 'SUCCESS'
    GROUP BY hari ORDER BY created_at DESC LIMIT 7
  `).all(GUILD_ID);
  return { omset, sukses, gagal, pending, terlaris, harian: harian.reverse() };
}

// ---------- VOUCH & ROLE REWARD (murni baca) ----------
const listVouches = (limit = 50) => db.prepare(`
  SELECT v.*, o.order_code, o.product_name, o.total_price, o.buyer_username
  FROM vouches v LEFT JOIN orders o ON o.id = v.order_id
  WHERE v.guild_id = ? ORDER BY v.created_at DESC LIMIT ?
`).all(GUILD_ID, limit);

const getVouchStats = () => {
  const r = db.prepare('SELECT COUNT(*) AS jumlah, COALESCE(AVG(rating), 0) AS rata FROM vouches WHERE guild_id = ?').get(GUILD_ID);
  return { jumlah: r.jumlah, rata: Math.round(r.rata * 10) / 10 };
};

const listRoleRewards = () => db.prepare('SELECT * FROM role_rewards WHERE guild_id = ? ORDER BY min_spending ASC').all(GUILD_ID);

// ---------- PENGUMUMAN (tabel tambahan, bukan bagian sistem inti bot) ----------
function queueBroadcast(title, message) {
  db.prepare(`INSERT INTO web_broadcast_queue (guild_id, title, message, status, created_at) VALUES (?, ?, ?, 'PENDING', ?)`)
    .run(GUILD_ID, title || null, message, Date.now());
}

const listBroadcasts = (limit = 15) =>
  db.prepare('SELECT * FROM web_broadcast_queue WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(GUILD_ID, limit);

// ---------- STATUS BOT (online/offline) ----------
function getBotStatus() {
  const row = db.prepare('SELECT * FROM web_panel_status WHERE guild_id = ?').get(GUILD_ID);
  if (!row) return { terhubung: false };
  return { terhubung: Date.now() - row.last_seen < 60000, ...row };
}

module.exports = {
  GUILD_ID,
  getConfig, toggleStoreStatus,
  listProducts, getProductById, countAccountLines, restockItem, restockAkun,
  listOrders, getPendingOrders,
  getPembukuan,
  listVouches, getVouchStats, listRoleRewards,
  queueBroadcast, listBroadcasts,
  getBotStatus,
};
