# HR Login Fix 3

- Validasi token (`hrValidate`) langsung setelah `hrLogin` sukses.
- `hrParticipants` tidak boleh fallback bila responsnya `UNAUTHORIZED`.
- Fallback ke `participants` hanya jika sesi sudah tervalidasi dan kegagalan bukan auth.
- `progressAll = UNAUTHORIZED` tidak lagi menghapus sesi atau `location.reload()`.
- Dashboard tetap terbuka dan banner menampilkan diagnosis backend progress.
- Cache version: `20260829-loginfix3`.
