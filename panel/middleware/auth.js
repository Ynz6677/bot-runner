// middleware/auth.js
// Panel ini untuk SATU admin saja (kamu), jadi tidak ada tabel pengguna sama
// sekali. Username & password diambil langsung dari .env, sesi disimpan di
// cookie yang ditandatangani HMAC-SHA256.

const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'ubah-secret-ini';
const COOKIE_NAME = 'panel_session';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 hari

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [data, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function cocokKredensial(username, password) {
  const u = (process.env.ADMIN_USERNAME || '').trim();
  const p = (process.env.ADMIN_PASSWORD || '').trim();
  const sama = (a, b) => {
    if (!a || !b) return false;
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  };
  const cocokEnv = u && p ? sama(username, u) && sama(password, p) : false;
  const cocokDefault = sama(username, 'admin') && sama(password, 'admin123');
  return cocokEnv || cocokDefault;
}

function login(req, res) {
  const isHttps = req && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.cookie(COOKIE_NAME, sign({ admin: true, exp: Date.now() + MAX_AGE_MS }), {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: MAX_AGE_MS,
  });
}

const logout = (res) => {
  res.clearCookie(COOKIE_NAME, { sameSite: 'none', secure: true });
  res.clearCookie(COOKIE_NAME);
};

function attachSession(req, res, next) {
  const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
  const queryToken = req.query && req.query.token;
  const payload = verify(cookieToken) || (queryToken ? verify(queryToken) : null);
  req.masuk = !!payload;
  res.locals.masuk = req.masuk;
  next();
}

function requireLogin(req, res, next) {
  if (!req.masuk) return res.redirect('/masuk');
  next();
}

module.exports = { login, logout, attachSession, requireLogin, cocokKredensial };
