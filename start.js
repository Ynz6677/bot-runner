// start.js
// Railway hanya menjalankan SATU perintah start per service, tapi kita perlu
// dua proses: bot Discord dan Panel Web. File ini menyalakan keduanya di
// dalam satu container yang sama, supaya keduanya bisa berbagi satu Volume
// (satu file database SQLite) — Volume di Railway tidak bisa dipasang ke dua
// service berbeda, jadi ini satu-satunya cara agar panel bisa membaca
// database bot secara langsung dan real-time seperti yang diminta.
//
// Kalau salah satu proses mati (sengaja atau crash), yang satu lagi IKUT
// dimatikan lebih dulu, baru orkestrator ini keluar — supaya tidak ada
// proses "anak yatim" yang terus jalan sendirian, dan Railway bisa
// me-restart service ini dengan bersih.

const { spawn } = require('child_process');
const path = require('path');

let sedangMematikan = false;
const semuaProses = [];

function jalankan(nama, folder, argumen) {
  const proses = spawn(process.execPath, argumen, {
    cwd: path.join(__dirname, folder),
    stdio: 'inherit',
    env: process.env,
  });
  proses.nama = nama;
  semuaProses.push(proses);

  proses.on('error', (err) => {
    console.error(`[start] Gagal menyalakan proses "${nama}": ${err.message}`);
    matikanSemuaLaluKeluar(1);
  });

  proses.on('exit', (code) => {
    if (sedangMematikan) return;
    console.warn(`[start] Proses "${nama}" berhenti (kode ${code}).`);
    if (nama === 'panel') {
      matikanSemuaLaluKeluar(code || 1);
    }
  });

  return proses;
}

function matikanSemuaLaluKeluar(kodeKeluar) {
  if (sedangMematikan) return;
  sedangMematikan = true;
  console.log('[start] Menghentikan semua proses...');
  for (const p of semuaProses) {
    if (!p.killed) p.kill('SIGTERM');
  }
  setTimeout(() => process.exit(kodeKeluar), 1500);
}

const hasToken = !!(process.env.TOKEN || process.env.DISCORD_TOKEN);
if (hasToken) {
  console.log('[start] Menyalakan bot Discord...');
  jalankan('bot', 'bot', ['index.js']);
} else {
  console.log('[start] TOKEN bot Discord belum diatur di environment. Bot Discord dilewati.');
}

console.log('[start] Menyalakan Panel Web pada port 3000...');
jalankan('panel', 'panel', ['server.js']);

process.on('SIGTERM', () => matikanSemuaLaluKeluar(0));
process.on('SIGINT', () => matikanSemuaLaluKeluar(0));
