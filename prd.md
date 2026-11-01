# Product Requirements Document

## Ringkasan

Multiprint adalah aplikasi internal untuk operasi layanan printer. Frontend baru akan dibangun di `frontend/` menggunakan Nuxt, Vue.js, dan Nuxt UI, dengan backend existing di `service/` sebagai sumber data dan aturan bisnis.

## Tujuan

- Menyatukan pengelolaan master printer, toner, sparepart, gudang, kontrak, account, dan pengguna.
- Mendukung alur pengaduan, tiket, surat tugas, maintenance, dan penyelesaian pekerjaan.
- Menyediakan visibilitas stok, mutasi, penempatan printer, audit trail, dan permission berbasis role.
- Menyediakan UI operasional yang jelas, responsif, dan aman untuk role berbeda.

## Ruang Lingkup MVP Frontend

1. Login dan profil pengguna.
2. Dashboard ringkas berdasarkan role.
3. Daftar/detail serta CRUD terkontrol untuk master data.
4. Pengaduan dan tiket beserta perubahan statusnya.
5. Surat tugas dan workflow teknisi/warehouse.
6. Printer, maintenance, penempatan, transfer, withdrawal, dan return.
7. Stok dan mutasi stok.
8. Audit trail dan pengaturan yang diizinkan oleh API.

## Pengguna dan Role

Role yang dikenali service: `admin`, `sales`, `sales-admin`, `kepala-teknisi`, `teknisi`, dan `warehouse`. UI wajib menyembunyikan atau menonaktifkan aksi yang tidak diizinkan, tetapi backend tetap menjadi otoritas permission.

## Persyaratan Fungsional

- Login mengirim `username` dan `kata_sandi`, lalu menyimpan token secara aman untuk request Bearer.
- Semua request terautentikasi mengirim `Authorization: Bearer <token>`.
- UI membaca envelope API dan menampilkan `pesan` serta `detail` ketika request gagal.
- Daftar mendukung pagination (`halaman`, `batas`), pencarian (`cari`), filter yang disediakan endpoint, loading, empty state, dan error state.
- Workflow status harus menampilkan status saat ini, role yang dapat melakukan aksi, dan alasan kegagalan dari service.
- Destructive action harus meminta konfirmasi dan menampilkan konsekuensi dari endpoint.

## Non-Fungsional

- Gunakan Nuxt UI untuk komponen konsisten dan aksesibel.
- Layout usable pada desktop dan layar kecil.
- Jangan mengekspos token, password, atau data sensitif dalam log browser.
- Perubahan backend, database, dan kontrak publik berada di luar scope frontend tanpa approval.

## Kriteria Sukses

- Pengguna dapat login dan melihat menu sesuai role.
- Alur operasional utama dapat dicapai tanpa mengubah backend.
- Error 401/403/404/409/422/500 ditampilkan dengan pesan yang dapat ditindaklanjuti.
- Kontrak di `api-contracts/` tetap sinkron dengan endpoint yang digunakan frontend.

## Di Luar Scope Awal

- Perubahan skema database atau migration.
- Perubahan endpoint, permission, aturan status, atau response backend.
- Deployment produksi dan perubahan konfigurasi produksi.
