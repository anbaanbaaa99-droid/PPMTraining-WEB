# AEON PPM Training System + HR Monitoring — Stage 3

Satu repository GitHub Pages untuk Learning Journey peserta dan HR Monitoring AEON Alam Sutera.

## Halaman

- `index.html` — Learning Journey peserta.
- `hr.html` — HR Monitoring dengan login.

## Stage 3

### HR Login
- Dashboard HR tidak tampil sebelum autentikasi.
- Username/password diverifikasi oleh Google Apps Script, bukan JavaScript GitHub.
- Password dikirim menggunakan POST, bukan query URL.
- Session token bertanda tangan berlaku 8 jam.
- Token disimpan di `sessionStorage`.
- Tombol `Keluar` menghapus sesi.
- Maksimal 5 percobaan login gagal sebelum lock sementara sekitar 15 menit.

### HR Data
- `hr-data.js` tidak lagi digunakan.
- Daftar peserta HR diambil dari sheet `Daftar Peserta` setelah token tervalidasi.
- Endpoint `progressAll` juga membutuhkan token HR.

### Progress
- Checklist peserta tetap tersimpan di sheet `Progress PPM`.
- HR melihat Completed / On Progress / Belum Mulai, progress bar, detail materi, dan Export CSV.

### Credit
Credit kecil `Created by FINH` ditambahkan pada Learning Journey dan HR Monitoring.

## File frontend untuk GitHub

```text
index.html
style.css
app.js
catalog.js
hr.html
hr.css
hr.js
```

> Hapus `hr-data.js` lama dari repository.

## Backend Apps Script

Folder `backend/` berisi:

- `apps-script-progress-addon.gs` → copy sebagai `Progress.gs`
- `apps-script-hr-auth-addon.gs` → copy sebagai `HRAuth.gs`
- `BACKEND-INSTALL.md` → instruksi pemasangan

Lihat `backend/BACKEND-INSTALL.md` sebelum deploy.

## Catatan

Login HR adalah autentikasi server-side untuk dashboard. Learning Journey peserta masih menggunakan endpoint peserta publik berbasis NIK, jadi ini belum merupakan sistem IAM/SSO penuh.
