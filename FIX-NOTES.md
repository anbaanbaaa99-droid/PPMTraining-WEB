# Frontend Fix Notes — 2026-08-28

Perbaikan utama:

1. Mendukung assignment multi-Basic seperti `Basic 2 / 3`, `Basic 1, Basic 2`, dan format sejenis.
2. Pencocokan section menangani `&` vs `and` tanpa mengubah format `taskKey` lama.
3. Detail HR menghitung progress dari daftar modul yang benar-benar dikembalikan backend, bukan selalu dari katalog lokal.
4. Mencegah race condition saat pencarian peserta/progress lama selesai setelah user sudah membuka peserta lain.
5. Pesan error pencarian menampilkan message dari backend jika tersedia.
6. Data peserta HR dinormalisasi dan kategori kosong diberi fallback `PPM`.
7. Cache-busting ditambahkan ke CSS/JS agar GitHub Pages/browser tidak terus memakai file versi lama setelah deploy.
8. `hr-data.js` lama dihapus karena sudah tidak dipakai.

Catatan yang belum dapat diselesaikan hanya dari frontend:
- Section generik seperti `Bakery`, `Sushi`, `Meat`, atau `Delica` dapat menunjuk ke beberapa sheet turunan. Tanpa subtype/mapping eksplisit pada `Daftar Peserta`, backend tidak memiliki informasi yang cukup untuk memilih sheet turunan secara pasti.
- `saveProgress` masih memakai GET demi kompatibilitas dengan backend saat ini. Untuk production, sebaiknya dipindahkan ke POST bersamaan dengan perubahan `doPost`/`Progress.gs`.

## Fix tahap 2 — backend-safe mapping

- `saveProgress` frontend sekarang memakai POST.
- Frontend membaca `moduleSheet` bila tersedia.
- Section yang cocok ke beberapa subtype tidak lagi memilih kandidat pertama secara otomatis.
- Section ambigu menampilkan pesan **Perlu Mapping** / instruksi mengisi `Module Sheet`.
- HR dashboard memiliki status `Perlu Mapping`.
- `Daily & Dairy` tetap dinormalisasi ke katalog `Daily and Dairy`.
- Multi-Basic tetap didukung.
