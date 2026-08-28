# AEON PPM Training System + HR Monitoring

Frontend GitHub Pages untuk Learning Journey AEON Alam Sutera dan dashboard monitoring HR.

## Halaman
- `index.html` — Learning Journey peserta. Peserta mencari NIK/nama dan melihat Basic, judul materi, Link Post Test, dan Modul.
- `hr.html` — Dashboard monitoring HR. Default menampilkan peserta kategori PPM.

## Fitur HR Monitoring
- Ringkasan jumlah peserta yang sedang tampil.
- Filter kategori, section, current level, dan Basic.
- Pencarian berdasarkan NIK atau nama.
- Detail peserta melalui endpoint Apps Script `action=search`.
- Detail assignment menampilkan Post Test dan Modul jika backend mengirim data modul.
- Tombol **Buka sebagai peserta** untuk mengecek Learning Journey NIK tertentu.
- Export hasil filter ke CSV.
- Progress/checklist belum diaktifkan karena belum ada sumber data completion yang persisten.

## Sumber data
- `hr-data.js` adalah snapshot master peserta dari sheet `Daftar Peserta` pada workbook `Penugasan PPM-Magang-KI Aeon Alam Sutera 2026.xlsx`.
- `catalog.js` adalah katalog materi/Post Test/Modul dari workbook yang sama.
- Detail assignment per peserta tetap mencoba mengambil data terbaru dari Apps Script.

## Deploy
1. Upload seluruh isi folder/ZIP ke repository GitHub Pages yang sama.
2. Pastikan file berikut berada di level yang sama:
   - `index.html`
   - `style.css`
   - `app.js`
   - `catalog.js`
   - `hr.html`
   - `hr.css`
   - `hr.js`
   - `hr-data.js`
3. Peserta membuka `index.html`.
4. HR membuka `hr.html`.
5. Jika URL Apps Script berubah, ganti konstanta API pada `app.js` dan `hr.js`.

## Catatan keamanan penting
`hr.html` saat ini adalah dashboard frontend dan **belum memiliki autentikasi HR yang aman**. Jangan menganggap URL tersembunyi atau password yang ditulis di JavaScript sebagai pengamanan. Sebelum dipakai untuk produksi/internal data sensitif, tambahkan autentikasi di backend (misalnya Google Apps Script dengan kontrol akun/domain, Firebase Auth, atau sistem login server-side) dan batasi endpoint agar data master peserta tidak dapat diambil publik.

## Tahap progress berikutnya
Untuk checklist yang dapat dimonitor HR, status harus disimpan pada backend/Google Sheet, misalnya:
`NIK + ID materi + completed + completedAt`.
Setelah sumber data completion tersedia, dashboard dapat ditambah status `Belum Mulai / On Progress / Completed`, persentase progress, overdue, dan rekap per section.
