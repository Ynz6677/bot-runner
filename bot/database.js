// database.js
// Semua akses database terpusat di file ini menggunakan better-sqlite3.
// better-sqlite3 dipilih karena sinkron (tidak perlu async/await/promise queue)
// dan sangat hemat RAM dibanding driver DB lain -> cocok untuk Termux Android.

require('dotenv').config(); // pastikan .env terbaca walau file ini di-require lebih dulu

const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

// Database disimpan di INTERNAL STORAGE HP dengan nama "storage-database"
// (bukan di dalam folder project) supaya data tetap aman walau folder bot
// dihapus/reinstall, dan bisa langsung dibackup lewat File Manager Android.
//
// Bisa dioverride lewat .env -> DB_PATH=/path/custom/kamu
function resolveDbPath() {
  if (process.env.DB_PATH && process.env.DB_PATH.trim() !== '') {
    return process.env.DB_PATH.trim();
  }

  // Path standar Termux menuju Internal Storage (aktif setelah `termux-setup-storage`)
  const sharedStoragePath = path.join(os.homedir(), 'storage', 'shared');
  if (fs.existsSync(sharedStoragePath)) {
    return path.join(sharedStoragePath, 'storage-database');
  }

  console.warn(
    '[DB] ⚠️  Folder ~/storage/shared belum ditemukan. Jalankan `termux-setup-storage` di Termux ' +
    'lalu izinkan akses penyimpanan agar database bisa disimpan di Internal Storage. ' +
    'Untuk sementara, database disimpan lokal di dalam folder project (./data/storage-database).'
  );
  return path.join(__dirname, 'data', 'storage-database');
}

const dbPath = resolveDbPath();
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

console.log(`[DB] Menggunakan database: ${dbPath}`);
const db = new Database(dbPath);

// PRAGMA untuk performa & keamanan data yang seimbang di perangkat mobile
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      admin_role_id TEXT,
      log_channel_id TEXT,
      testimoni_channel_id TEXT,
      owner_channel_id TEXT,
      info_channel_id TEXT,
      payment_info TEXT,
      store_status TEXT NOT NULL DEFAULT 'OPEN'
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
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaksi_ledger (
      no INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      usn TEXT NOT NULL,
      order_name TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      exported INTEGER NOT NULL DEFAULT 0
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
  `);

  // ---- Migrasi ringan untuk instalasi lama (aman dijalankan berkali-kali) ----
  ensureColumn('products', 'image_url', 'TEXT');
  ensureColumn('products', 'channel_id', 'TEXT');
  ensureColumn('products', 'message_id', 'TEXT');
  ensureColumn('guild_config', 'order_channel_id', 'TEXT'); // legacy, tidak dipakai lagi
  ensureColumn('guild_config', 'admin_status_channel_id', 'TEXT');
  ensureColumn('guild_config', 'qris_image_url', 'TEXT');
  ensureColumn('orders', 'usn', 'TEXT');
  ensureColumn('orders', 'status_message_id', 'TEXT');
  ensureColumn('guild_config', 'order_counter', 'INTEGER DEFAULT 0');
  ensureColumn('transaksi_ledger', 'order_code', 'TEXT');
  ensureColumn('guild_config', 'vouch_channel_id', 'TEXT');
  ensureColumn('transaksi_ledger', 'total_price', 'INTEGER DEFAULT 0');
  migrateOrderPanelsIfNeeded();
  migrateRoleRewardsColumnIfNeeded();

  console.log('[DB] Database siap digunakan.');
}

// Role reward dulunya berbasis JUMLAH transaksi (min_purchases), sekarang berbasis NOMINAL
// total belanja (min_spending). Kolom di-rename otomatis kalau masih pakai skema lama.
function migrateRoleRewardsColumnIfNeeded() {
  const cols = db.prepare(`PRAGMA table_info(role_rewards)`).all();
  const hasOldColumn = cols.some((c) => c.name === 'min_purchases');
  const hasNewColumn = cols.some((c) => c.name === 'min_spending');
  if (hasOldColumn && !hasNewColumn) {
    try {
      db.exec(`ALTER TABLE role_rewards RENAME COLUMN min_purchases TO min_spending`);
      console.log('[DB] Migrasi: kolom role_rewards.min_purchases di-rename jadi min_spending.');
    } catch (err) {
      console.error('[DB] Gagal migrasi kolom role_rewards:', err.message);
    }
  }
}

// Instalasi lama membuat order_panels dengan CHECK(type IN ('item','akun')) NOT NULL.
// Sekarang tombol Order cuma 1 (tanpa pembagian tipe), jadi kolom type harus bebas/opsional.
// SQLite tidak bisa ALTER CHECK constraint langsung, jadi tabel di-rebuild kalau masih skema lama.
function migrateOrderPanelsIfNeeded() {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'order_panels'`).get();
  if (row && row.sql && row.sql.includes("CHECK(type IN")) {
    db.exec(`
      ALTER TABLE order_panels RENAME TO order_panels_old;
      CREATE TABLE order_panels (
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
      INSERT INTO order_panels (id, guild_id, type, category_id, channel_id, message_id, button_label, embed_title, embed_description)
        SELECT id, guild_id, type, category_id, channel_id, message_id, button_label, embed_title, embed_description FROM order_panels_old;
      DROP TABLE order_panels_old;
    `);
    console.log('[DB] Migrasi: tabel order_panels di-rebuild (kolom type kini opsional).');
  }
}

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[DB] Migrasi: kolom "${column}" ditambahkan ke tabel "${table}".`);
  }
}

// ---------- GUILD CONFIG ----------
function getGuildConfig(guildId) {
  return db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
}

function upsertGuildConfig(cfg) {
  const exists = getGuildConfig(cfg.guild_id);
  if (exists) {
    db.prepare(`
      UPDATE guild_config SET
        admin_role_id = ?, log_channel_id = ?, testimoni_channel_id = ?,
        info_channel_id = ?, admin_status_channel_id = ?, qris_image_url = ?, payment_info = ?, vouch_channel_id = ?
      WHERE guild_id = ?
    `).run(
      cfg.admin_role_id, cfg.log_channel_id, cfg.testimoni_channel_id,
      cfg.info_channel_id, cfg.admin_status_channel_id, cfg.qris_image_url, cfg.payment_info, cfg.vouch_channel_id, cfg.guild_id
    );
  } else {
    db.prepare(`
      INSERT INTO guild_config
        (guild_id, admin_role_id, log_channel_id, testimoni_channel_id, info_channel_id, admin_status_channel_id, qris_image_url, payment_info, vouch_channel_id, store_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
    `).run(
      cfg.guild_id, cfg.admin_role_id, cfg.log_channel_id, cfg.testimoni_channel_id,
      cfg.info_channel_id, cfg.admin_status_channel_id, cfg.qris_image_url, cfg.payment_info, cfg.vouch_channel_id
    );
  }
}

function setStoreStatus(guildId, status) {
  db.prepare('UPDATE guild_config SET store_status = ? WHERE guild_id = ?').run(status, guildId);
}

// ---------- PRODUCTS ----------
function makeSlug(guildId, name) {
  let base = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!base) base = 'produk';
  let slug = base;
  let i = 1;
  while (db.prepare('SELECT 1 FROM products WHERE guild_id = ? AND slug = ?').get(guildId, slug)) {
    i += 1;
    slug = `${base}_${i}`;
  }
  return slug;
}

function addProduct({ guildId, name, price, stock, type, category, imageUrl, channelId }) {
  const existing = db.prepare('SELECT 1 FROM products WHERE guild_id = ? AND name = ?').get(guildId, name);
  if (existing) throw new Error('Produk dengan nama tersebut sudah ada.');
  const slug = makeSlug(guildId, name);
  const info = db.prepare(`
    INSERT INTO products (guild_id, name, slug, price, stock, type, category, image_url, channel_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, name, slug, price, stock, type, category || '-', imageUrl || null, channelId || null);
  return getProductById(info.lastInsertRowid);
}

function setProductImage(productId, imageUrl) {
  db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(imageUrl, productId);
}

// Menyimpan referensi pesan katalog produk (dipakai supaya bisa dihapus otomatis saat produk dihapus)
function setProductMessage(productId, channelId, messageId) {
  db.prepare('UPDATE products SET channel_id = ?, message_id = ? WHERE id = ?').run(channelId, messageId, productId);
}

// Menghapus HANYA referensi message_id (dipakai saat stok habis & pesan katalognya disembunyikan/dihapus).
// channel_id tetap disimpan supaya tahu ke mana harus republish saat direstok nanti.
function clearProductMessageId(productId) {
  db.prepare('UPDATE products SET message_id = NULL WHERE id = ?').run(productId);
}

// Menghapus produk secara permanen dari database (product_accounts ikut terhapus via ON DELETE CASCADE)
function deleteProduct(productId) {
  db.prepare('DELETE FROM products WHERE id = ?').run(productId);
}

function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

function getProductBySlug(guildId, slug) {
  return db.prepare('SELECT * FROM products WHERE guild_id = ? AND slug = ?').get(guildId, slug);
}

// Pencarian produk berdasarkan nama, tidak peduli huruf besar/kecil
// (dipakai saat pembeli mengetik manual nama barang di Modal Order)
function getProductByNameCI(guildId, name) {
  return db.prepare('SELECT * FROM products WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, name.trim());
}

function listProducts(guildId) {
  return db.prepare('SELECT * FROM products WHERE guild_id = ? ORDER BY category, name').all(guildId);
}

// Filter produk berdasarkan tipe - dipakai supaya Restok hanya menampilkan Item,
// dan Upload Akun hanya menampilkan Akun.
function listProductsByType(guildId, type) {
  return db.prepare('SELECT * FROM products WHERE guild_id = ? AND type = ? ORDER BY name').all(guildId, type);
}

// Daftar channel/kategori unik yang punya minimal 1 produk dengan stok > 0.
// type opsional: 'item' | 'akun' -> untuk membatasi hanya kategori yang punya produk tipe tsb
// (dipakai supaya tombol "Order" hanya menampilkan Item, dan tombol "Jual Akun" hanya Akun).
function getAvailableCategories(guildId, type) {
  if (type) {
    return db.prepare(`
      SELECT DISTINCT channel_id, category
      FROM products
      WHERE guild_id = ? AND stock > 0 AND channel_id IS NOT NULL AND type = ?
      ORDER BY category
    `).all(guildId, type);
  }
  return db.prepare(`
    SELECT DISTINCT channel_id, category
    FROM products
    WHERE guild_id = ? AND stock > 0 AND channel_id IS NOT NULL
    ORDER BY category
  `).all(guildId);
}

// Produk yang tersedia (stok > 0) di sebuah channel/kategori tertentu, opsional difilter tipe
function listProductsInChannel(guildId, channelId, type) {
  if (type) {
    return db.prepare(`
      SELECT * FROM products WHERE guild_id = ? AND channel_id = ? AND stock > 0 AND type = ? ORDER BY name
    `).all(guildId, channelId, type);
  }
  return db.prepare(`
    SELECT * FROM products WHERE guild_id = ? AND channel_id = ? AND stock > 0 ORDER BY name
  `).all(guildId, channelId);
}

function updateProductPrice(productId, newPrice) {
  db.prepare('UPDATE products SET price = ? WHERE id = ?').run(newPrice, productId);
}

function addStockCount(productId, addQty) {
  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(addQty, productId);
}

function decrementStock(productId, qty) {
  const tx = db.transaction((pid, q) => {
    const p = getProductById(pid);
    if (!p) throw new Error('Produk tidak ditemukan.');
    if (p.stock < q) throw new Error('Stok tidak mencukupi.');
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(q, pid);
  });
  tx(productId, qty);
}

function restoreStock(productId, qty) {
  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(qty, productId);
}

// ---------- PRODUCT ACCOUNTS (stok tipe "Akun") ----------
function addAccountLines(productId, lines) {
  const insert = db.prepare('INSERT INTO product_accounts (product_id, content) VALUES (?, ?)');
  const tx = db.transaction((pid, arr) => {
    for (const line of arr) insert.run(pid, line);
  });
  tx(productId, lines);
}

// Ambil & hapus sekaligus (transaksi) supaya tidak dobel-jual saat akun dikirim
function popAccountLines(productId, qty) {
  const tx = db.transaction((pid, q) => {
    const rows = db.prepare('SELECT * FROM product_accounts WHERE product_id = ? LIMIT ?').all(pid, q);
    if (rows.length < q) throw new Error('Data akun di database tidak mencukupi.');
    const del = db.prepare('DELETE FROM product_accounts WHERE id = ?');
    for (const r of rows) del.run(r.id);
    return rows.map(r => r.content);
  });
  return tx(productId, qty);
}

// ---------- ORDERS ----------
function createOrder(order) {
  const info = db.prepare(`
    INSERT INTO orders
      (guild_id, order_code, channel_id, buyer_id, buyer_username, usn, product_id, product_name, product_type, quantity, total_price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(
    order.guildId, order.orderCode, order.channelId, order.buyerId, order.buyerUsername, order.usn,
    order.productId, order.productName, order.productType, order.quantity, order.totalPrice, Date.now()
  );
  return info.lastInsertRowid;
}

function getOrderById(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

function updateOrderStatus(id, status) {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
}

function updateOrderChannel(id, channelId) {
  db.prepare('UPDATE orders SET channel_id = ? WHERE id = ?').run(channelId, id);
}

// Menyimpan referensi pesan "ID/USN/ORDER/STATUS" di channel admin, supaya nanti bisa di-edit
// (update teks STATUS & hapus tombol) saat admin menekan Berhasil/Dibatalkan.
function setOrderStatusMessage(orderId, messageId) {
  db.prepare('UPDATE orders SET status_message_id = ? WHERE id = ?').run(messageId, orderId);
}

// Anti-spam: pembeli hanya boleh punya 1 order yang masih PENDING (menunggu konfirmasi)
function getActiveOrderByBuyer(guildId, buyerId) {
  return db.prepare(`
    SELECT * FROM orders
    WHERE guild_id = ? AND buyer_id = ? AND status = 'PENDING'
    LIMIT 1
  `).get(guildId, buyerId);
}

function getExpiredPendingOrders(thresholdMs) {
  const cutoff = Date.now() - thresholdMs;
  return db.prepare(`
    SELECT * FROM orders WHERE status = 'PENDING' AND created_at < ?
  `).all(cutoff);
}

// Semua order yang masih PENDING (dipakai fitur /reset untuk menghilangkan order aktif yang macet).
// buyerId opsional: kalau diisi, hanya ambil punya user itu saja.
function getPendingOrders(guildId, buyerId) {
  if (buyerId) {
    return db.prepare(`SELECT * FROM orders WHERE guild_id = ? AND buyer_id = ? AND status = 'PENDING'`).all(guildId, buyerId);
  }
  return db.prepare(`SELECT * FROM orders WHERE guild_id = ? AND status = 'PENDING'`).all(guildId);
}

// Nomor urut order (untuk penamaan channel order-001, order-002, dst) - kontinu per server,
// tidak pernah reset/mundur.
function getNextOrderNumber(guildId) {
  const tx = db.transaction((gid) => {
    db.prepare('UPDATE guild_config SET order_counter = order_counter + 1 WHERE guild_id = ?').run(gid);
    return db.prepare('SELECT order_counter FROM guild_config WHERE guild_id = ?').get(gid).order_counter;
  });
  return tx(guildId);
}

// ---------- PEMBUKUAN ----------
function getPembukuan(guildId) {
  const omset = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) AS total FROM orders WHERE guild_id = ? AND status = 'SUCCESS'
  `).get(guildId).total;

  const sukses = db.prepare(`
    SELECT COUNT(*) AS c FROM orders WHERE guild_id = ? AND status = 'SUCCESS'
  `).get(guildId).c;

  const gagal = db.prepare(`
    SELECT COUNT(*) AS c FROM orders WHERE guild_id = ? AND status IN ('BATAL', 'EXPIRED')
  `).get(guildId).c;

  const terlaris = db.prepare(`
    SELECT product_name, SUM(quantity) AS total_qty
    FROM orders WHERE guild_id = ? AND status = 'SUCCESS'
    GROUP BY product_name ORDER BY total_qty DESC LIMIT 1
  `).get(guildId);

  return { omset, sukses, gagal, terlaris };
}

// ---------- TRANSAKSI LEDGER (export xlsx, NO tetap kontinu) ----------
function insertLedger({ guildId, usn, orderName, buyerId, tanggal, orderCode, totalPrice }) {
  db.prepare(`
    INSERT INTO transaksi_ledger (guild_id, usn, order_name, buyer_id, tanggal, order_code, total_price, exported)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(guildId, usn, orderName, buyerId, tanggal, orderCode || null, totalPrice || 0);
}

function getUnexportedLedger(guildId) {
  return db.prepare(`
    SELECT * FROM transaksi_ledger WHERE guild_id = ? AND exported = 0 ORDER BY no ASC
  `).all(guildId);
}

// "Reset" hanya menandai baris sudah diekspor (soft-reset).
// Kolom NO (AUTOINCREMENT) TIDAK PERNAH di-reset -> penomoran tetap kontinu selamanya.
function markLedgerExported(guildId, ids) {
  const stmt = db.prepare('UPDATE transaksi_ledger SET exported = 1 WHERE no = ? AND guild_id = ?');
  const tx = db.transaction((arr) => {
    for (const id of arr) stmt.run(id, guildId);
  });
  tx(ids);
}

// ---------- ORDER PANELS (konfigurasi tombol Order / Jual Akun) ----------
function createOrderPanel({ guildId, type, categoryId, channelId, buttonLabel, embedTitle, embedDescription }) {
  const info = db.prepare(`
    INSERT INTO order_panels (guild_id, type, category_id, channel_id, button_label, embed_title, embed_description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, type, categoryId || null, channelId || null, buttonLabel, embedTitle || null, embedDescription || null);
  return info.lastInsertRowid;
}

function setOrderPanelMessage(panelId, messageId) {
  db.prepare('UPDATE order_panels SET message_id = ? WHERE id = ?').run(messageId, panelId);
}

function getOrderPanel(panelId) {
  return db.prepare('SELECT * FROM order_panels WHERE id = ?').get(panelId);
}

// ---------- VOUCH ----------
function hasVouch(orderId) {
  return !!db.prepare('SELECT 1 FROM vouches WHERE order_id = ?').get(orderId);
}

function addVouch({ guildId, orderId, buyerId, rating, comment }) {
  db.prepare(`
    INSERT INTO vouches (guild_id, order_id, buyer_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, orderId, buyerId, rating, comment, Date.now());
}

// ---------- ROLE REWARDS (role otomatis berdasarkan jumlah pembelian sukses, maks 6 per server) ----------
function countRoleRewards(guildId) {
  return db.prepare('SELECT COUNT(*) AS c FROM role_rewards WHERE guild_id = ?').get(guildId).c;
}

function addRoleReward(guildId, roleId, minSpending) {
  db.prepare(`
    INSERT INTO role_rewards (guild_id, role_id, min_spending)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, role_id) DO UPDATE SET min_spending = excluded.min_spending
  `).run(guildId, roleId, minSpending);
}

function listRoleRewards(guildId) {
  return db.prepare('SELECT * FROM role_rewards WHERE guild_id = ? ORDER BY min_spending ASC').all(guildId);
}

function removeRoleReward(guildId, roleId) {
  return db.prepare('DELETE FROM role_rewards WHERE guild_id = ? AND role_id = ?').run(guildId, roleId).changes;
}

// Total nominal belanja (Rupiah) seorang pembeli di server ini dari transaksi SUKSES (dasar role reward)
function getTotalSpending(guildId, buyerId) {
  return db.prepare(`SELECT COALESCE(SUM(total_price), 0) AS total FROM orders WHERE guild_id = ? AND buyer_id = ? AND status = 'SUCCESS'`).get(guildId, buyerId).total;
}

// ---------- JEMBATAN PANEL WEB (tambahan murni, tidak mengubah tabel/logika di atas) ----------
// Dua tabel kecil khusus untuk Panel Web: antrean pengumuman & denyut nadi
// status online. Tidak berkaitan sama sekali dengan tabel produk/order/vouch.
db.exec(`
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

function takeBroadcastQueue(guildId, limit = 5) {
  return db.prepare(`SELECT * FROM web_broadcast_queue WHERE guild_id = ? AND status = 'PENDING' ORDER BY id ASC LIMIT ?`).all(guildId, limit);
}

function markBroadcastDone(id, status, error) {
  db.prepare(`UPDATE web_broadcast_queue SET status = ?, error = ?, processed_at = ? WHERE id = ?`)
    .run(status, error || null, Date.now(), id);
}

function writePanelHeartbeat(guildId, botTag, guildName) {
  db.prepare(`
    INSERT INTO web_panel_status (guild_id, bot_tag, guild_name, last_seen) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET bot_tag = excluded.bot_tag, guild_name = excluded.guild_name, last_seen = excluded.last_seen
  `).run(guildId, botTag, guildName, Date.now());
}

module.exports = {
  init,
  getGuildConfig,
  upsertGuildConfig,
  setStoreStatus,
  addProduct,
  setProductImage,
  setProductMessage,
  clearProductMessageId,
  deleteProduct,
  getProductById,
  getProductBySlug,
  getProductByNameCI,
  listProducts,
  listProductsByType,
  getAvailableCategories,
  listProductsInChannel,
  updateProductPrice,
  addStockCount,
  decrementStock,
  restoreStock,
  addAccountLines,
  popAccountLines,
  createOrder,
  getOrderById,
  updateOrderStatus,
  updateOrderChannel,
  setOrderStatusMessage,
  getActiveOrderByBuyer,
  getExpiredPendingOrders,
  getPendingOrders,
  getNextOrderNumber,
  createOrderPanel,
  setOrderPanelMessage,
  getOrderPanel,
  getPembukuan,
  insertLedger,
  getUnexportedLedger,
  markLedgerExported,
  hasVouch,
  addVouch,
  countRoleRewards,
  addRoleReward,
  listRoleRewards,
  removeRoleReward,
  getTotalSpending,
  // -- jembatan panel web (tambahan) --
  takeBroadcastQueue,
  markBroadcastDone,
  writePanelHeartbeat,
};
