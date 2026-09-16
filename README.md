# ProConstruct ERP v3.0 — Struktur File (Hasil Pemecahan)

File `Revisi_71.html` (1 file, 13.000+ baris) telah dipecah menjadi beberapa
file agar lebih mudah diedit dan lebih hemat token saat revisi di Claude Project.

**PENTING:** Cara kerja aplikasi TIDAK BERUBAH SAMA SEKALI. Semua kode persis
sama seperti aslinya, hanya dipindah lokasinya ke file terpisah. Sudah diverifikasi
byte-per-byte bahwa hasil gabungan seluruh file = file HTML asli.

## Struktur folder

```
index.html              <- file utama, buka ini di browser
css/
  styles.css             <- semua CSS (dulu di dalam <style> tag)
js/
  core-init.js           <- state awal, localStorage, Firebase sync, role/hak akses, init halaman, sidebar
  project-nav.js         <- pilih/kelola proyek, gabung proyek, navigasi tab
  dashboard.js           <- halaman Beranda/Dashboard
  rab.js                 <- modul RAB & import Excel
  laporan-harian.js      <- Laporan Harian
  cco.js                 <- RAB CCO (adendum) & Volume CCO
  keuangan.js            <- Laporan Keuangan (pembayaran, laba rugi)
  kendala-notulen.js     <- Kendala & Notulen Harian
  laporan-mingguan-bulanan.js  <- Laporan Mingguan & Bulanan
  time-schedule-action-plan.js <- Time Schedule, Kurva-S, Action Plan
  material.js            <- Modul Material
  backup-quantity.js     <- Backup Quantity (Opname Lapangan & Input Manual)
  absensi.js             <- Absensi & Karyawan + Kamera Absensi
  rekap-kehadiran.js     <- Rekap Kehadiran Bulanan
  backup-data.js         <- Backup/Restore data proyek
  export-functions.js    <- Semua fungsi export (Excel, PDF, WhatsApp)
```

## Cara pakai di Claude Project

1. Upload SEMUA file di atas (jaga struktur folder: `css/styles.css`, `js/....js`) ke Project Knowledge.
2. Kalau mau revisi fitur tertentu — misalnya "RAB" — cukup minta Claude
   membaca & mengedit `js/rab.js` saja, tidak perlu memuat ulang 13.000 baris.
3. Kalau revisi menyangkut tampilan/warna → edit `css/styles.css`.
4. Kalau revisi menyangkut markup/HTML (form, tabel, modal) → edit `index.html`.
5. Setelah revisi, cukup unduh file yang berubah dan ganti file lama di folder Anda
   (nama file & lokasinya tetap sama, jadi tidak perlu ubah apa pun di index.html).

## Cara menjalankan

Karena file JS dipisah dan dimuat lewat `<script src="js/....js">`, browser
butuh diakses lewat server lokal (bukan dibuka langsung via `file://`) supaya
tidak kena batasan CORS. Cara termudah:

- Kalau punya Python: jalankan `python3 -m http.server 8000` di folder ini,
  lalu buka `http://localhost:8000` di browser.
- Atau pakai ekstensi "Live Server" di VS Code.
- Atau upload seluruh folder ke hosting statis (Netlify, Vercel, GitHub Pages, dst).

(Catatan: dengan 1 file HTML tunggal seperti sebelumnya, dia bisa dibuka
langsung dari file di komputer tanpa server. Setelah dipecah jadi banyak file,
sebagian browser memblokir pemuatan file eksternal lewat `file://` — jadi
disarankan pakai server lokal seperti di atas.)
