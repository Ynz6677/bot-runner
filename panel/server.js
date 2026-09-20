// server.js — entry point panel kontrol. Jalankan di perangkat/server yang
// sama dengan bot Discord kamu, karena panel membaca file database bot
// secara langsung (lihat db.js).

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db'); // sekalian memvalidasi DB_PATH & GUILD_ID saat start
const config = require('./config.json');
const { attachSession, login, cocokKredensial } = require('./middleware/auth');
const { formatRupiah } = require('./utils/helpers');
const { formatWIB } = require('./utils/time');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.use(attachSession);

app.use((req, res, next) => {
  res.locals.cfgApp = config;
  res.locals.rupiah = formatRupiah;
  res.locals.waktu = formatWIB;
  res.locals.path = req.path;
  next();
});

app.get('/masuk', (req, res) => {
  if (req.masuk) return res.redirect('/');
  res.render('masuk', { title: 'Masuk', pesan: null });
});

app.post('/masuk', (req, res) => {
  const { username, password } = req.body;
  if (!cocokKredensial(username || '', password || '')) {
    return res.status(401).render('masuk', { title: 'Masuk', pesan: 'Username atau kata sandi salah.' });
  }
  login(req, res);
  res.redirect('/');
});

app.post('/keluar', (req, res) => {
  res.clearCookie('panel_session');
  res.redirect('/masuk');
});

app.use('/', require('./routes/panel'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Tidak ditemukan', pesan: 'Halaman ini tidak ada.' });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[ERROR]', err);
  res.status(500).render('error', { title: 'Terjadi kesalahan', pesan: err.message });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`[PANEL] Berjalan di http://0.0.0.0:${PORT}`));
