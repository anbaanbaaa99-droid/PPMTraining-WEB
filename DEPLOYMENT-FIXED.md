AEON PPM Training Web - Fixed Package

Perbaikan utama:
1. Leader dashboard tidak lagi memakai variabel progress yang tidak ada.
2. Chart leader dihitung dari data peserta yang diterima backend.
3. Tambahan validasi response API.
4. Pencegahan error ketika data kosong.
5. Escape HTML untuk nama peserta.
6. Encoding token diperbaiki pada request.

Catatan:
- URL Apps Script tetap harus diarahkan ke Web App deployment aktif.
- Script Properties Apps Script harus berisi konfigurasi HR dan token.
- Jangan menaruh password HR/Leader di frontend.
