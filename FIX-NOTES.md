# HR Final Fix 1

Akar masalah login ditemukan di CSS, bukan autentikasi.

`#hr-login-gate` menggunakan atribut HTML `hidden`, tetapi class `.hr-login-gate` juga menetapkan `display:grid`. CSS author dapat membuat elemen beratribut `hidden` tetap tampil. Akibatnya dashboard dapat terbuka di belakang login gate, sementara layar login masih terlihat.

Perbaikan:

```css
.hr-login-gate[hidden],
.hr-shell[hidden] {
  display: none !important;
}
```

Tambahan:
- Dashboard shell dibuka segera setelah `hrLogin` berhasil.
- Data peserta/progress dimuat sesudah shell terbuka.
- Error data tidak mengembalikan pengguna ke login.
- Cache key HR: `20260829-hrfinal1`.
