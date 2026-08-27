# AEON PPM Training System

Frontend GitHub Pages untuk Learning Journey AEON Alam Sutera.

## Perubahan versi ini
- Tampilan disesuaikan dengan rancangan Learning Journey.
- Memperbaiki error syntax pada URL API.
- Login/pencarian tetap menggunakan NIK atau nama.
- Setelah peserta ditemukan, halaman menampilkan kategori, current level, nama, NIK, section, Basic yang harus dikerjakan, judul materi, Link Post Test, dan Link Modul.
- `catalog.js` dibuat dari workbook `Penugasan PPM-Magang-KI Aeon Alam Sutera 2026.xlsx` untuk melengkapi Link Post Test/Modul berdasarkan judul materi bila API belum mengirim kedua link secara lengkap.
- Checklist progress belum diaktifkan. Fokus versi ini adalah menampilkan apa yang harus dikerjakan dan link yang dibutuhkan.

## Deploy
1. Upload seluruh isi folder ini ke repository GitHub.
2. Pastikan file `index.html`, `style.css`, `app.js`, dan `catalog.js` berada di level yang sama.
3. Aktifkan GitHub Pages.
4. Jika URL Apps Script berubah, ganti konstanta `API` di `app.js`.

## Catatan backend
Frontend mengharapkan endpoint:
- `?action=participants`
- `?action=search&keyword=NIK`

Data pencarian idealnya mengembalikan `nama`, `nik`, `section`, `level`, `basic`, `kategori`, dan `modules`.

Untuk setiap item `modules`, frontend mendukung beberapa nama field:
- Judul: `module`, `title`, `namaModul`, `judul`
- Post Test: `postTest`, `post_test`, `linkPostTest`
- Modul: `moduleLink`, `linkModul`, `link`

Jika backend hanya mengirim judul + satu link modul, `catalog.js` akan mencoba melengkapi Link Post Test dari workbook berdasarkan judul materi.
