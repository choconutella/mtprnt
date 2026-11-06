# API Contracts

Snapshot ini diturunkan dari `service/src/app.js`, route module, middleware auth, schema Zod, dan utility response pada 2026-11-01. Ini adalah kontrak konsumsi frontend, bukan izin untuk mengubah service.

## Base URL dan autentikasi

- Base URL lokal: `http://localhost:5000/api` sesuai `.env.example`.
- Header untuk endpoint terproteksi: `Authorization: Bearer <jwt>`.
- Token diperoleh dari `POST /auth/masuk`.
- Role service: `admin`, `sales`, `sales-admin`, `kepala-teknisi`, `teknisi`, `warehouse`.

## Response envelope

Sukses:

```json
{ "sukses": true, "pesan": "...", "data": {} }
```

Gagal:

```json
{ "sukses": false, "pesan": "...", "detail": null }
```

Status yang perlu ditangani UI: `400`, `401`, `403`, `404`, `405`, `409`, `422`, dan `500`.

## Endpoint umum

| Method | Path | Auth | Catatan |
|---|---|---|---|
| GET | `/kesehatan` | Tidak | Health check service |
| POST | `/auth/masuk` | Tidak | Body `{ username, kata_sandi }`; menghasilkan `{ token, pengguna }` |
| GET | `/auth/saya` | Ya | Profil pengguna aktif |
| GET | `/pengguna` | Ya | List pengguna |
| GET/PUT/DELETE | `/pengguna/:id` | Ya | Detail, ubah, nonaktifkan |
| GET | `/account` | Ya | List account |
| GET | `/account/:id` | Ya | Detail account |
| POST/PUT/DELETE | `/account` atau `/account/:id` | Permission | CRUD account |
| GET | `/account/lokasi-customer` | Ya | Lookup lokasi customer |
| GET/POST/PUT/DELETE | `/account/:id/customer[/:customerId]` | Permission | Relasi customer account |

| GET/POST/PUT/DELETE | `/kontrak` dan `/kontrak/:id` | Permission | CRUD kontrak |
| GET/POST/PUT/DELETE | `/toner` dan `/toner/:id` | Permission | CRUD toner |
| GET/POST/PUT/DELETE | `/suku-cadang` dan `/suku-cadang/:id` | Permission | CRUD sparepart |
| GET/POST/PUT/DELETE | `/gudang` dan `/gudang/:id` | Permission | CRUD gudang |
| GET/POST/PUT/DELETE | `/printer-kategori` dan `/printer-kategori/:id` | Permission | CRUD kategori printer |
| GET/POST/PUT/DELETE | `/printer-model` dan `/printer-model/:id` | Permission | CRUD model printer |
| GET | `/printer/summary` | Ya | Ringkasan available/reserved/issued/installed |
| GET/POST/PUT/DELETE | `/printer` dan `/printer/:id` | Permission | Unit printer |
| POST | `/printer/:id/transfer` | Permission | Transfer gudang |
| POST | `/printer/:id/withdraw` | Permission | Keluarkan/nonaktifkan unit |
| POST | `/printer/:id/return` | Permission | Return dari transit |
| GET | `/printer-terpasang` dan `/printer-terpasang/:id` | Ya | Unit berstatus installed |

`POST /account` menerima `kode_account`, `nama_account`, `npwp`, `telepon`, `email`, `alamat_penagihan`, dan `aktif`. `customer_pertama` kini opsional sehingga Billing/Account dapat dibuat sebelum Customer. Jika `customer_pertama` dikirim, Account dan Customer pertama harus aktif. Customer baru dibuat melalui `POST /account/:id/customer`; pilihan Billing pada frontend memakai `account_id` dari `/account`.

`PUT /account/:id/customer/:customerId` memperbarui data Customer dan memindahkannya ke Billing pada `:id`. Billing tujuan harus aktif.

## Endpoint operasional

| Method | Path | Auth/role | Catatan |
|---|---|---|---|
| GET | `/stok` | Permission | Ringkasan stok |
| GET/POST | `/stok/mutasi` | Permission | List dan buat mutasi |
| POST | `/stok/mutasi/:id/posting` | Permission | Posting mutasi |
| GET | `/mutasi-stok` dan `/mutasi-stok/:id` | Permission | List/detail mutasi |
| POST | `/mutasi-stok` | Permission | Buat draft/opsional langsung posting |
| POST | `/mutasi-stok/:id/posting` | Permission | Posting mutasi |
| GET/POST/PUT/DELETE | `/pengaduan` dan `/pengaduan/:id` | Role | CRUD pengaduan |
| POST | `/pengaduan/:id/resolve` | Role | Selesaikan pengaduan |
| GET | `/tiket/catalog` | Permission | Katalog jenis tiket |
| GET/POST/PUT | `/tiket` dan `/tiket/:id` | Permission | CRUD tiket; `jenis` opsional pada Tiket baru dan ditentukan pada Surat Tugas |
| POST | `/tiket/:id/resolve` | Permission | Selesaikan tiket |
| POST | `/tiket/:id/cancel` | Permission | Batalkan tiket |

`POST /tiket` dan `PUT /tiket/:id` memakai `sales_id` sebagai ID Owner tiket (nama field lama dipertahankan). Owner boleh user aktif dengan role apa pun; pada kategori `delivery` dan `komplain`, Owner wajib diisi. Owner tidak otomatis mendapat hak akses tiket di luar aturan role yang berlaku. `PUT /tiket/:id` juga menerima `tanggal_transaksi` (ISO datetime) dan `deskripsi`. Nomor, kategori, customer, dan unit printer tetap dibaca saja.

`GET /pengguna?halaman=1&batas=20&cari=...` mengembalikan `{ items, meta }` berisi user aktif, dengan pencarian nama atau user ID. Tanpa parameter tersebut, respons tetap berupa daftar langsung untuk kompatibilitas klien lama.
| GET/POST/PUT | `/surat-tugas` dan `/surat-tugas/:id` | Role | CRUD surat tugas |
| POST | `/surat-tugas/:id/teknisi` | Role | Assign teknisi |
| POST | `/surat-tugas/:id/start` | Role | Mulai pekerjaan |
| POST | `/surat-tugas/:id/pemakaian` | Role | Catat pemakaian barang |
| DELETE | `/surat-tugas/:id/pemakaian/:pemakaianId` | Role | Hapus pemakaian |
| POST | `/surat-tugas/:id/ready-to-print` | Role | Siap cetak |
| POST | `/surat-tugas/:id/selesai-teknisi` | Role | Teknisi selesai |
| POST | `/surat-tugas/:id/validasi-warehouse` | Role | Validasi warehouse |
| POST | `/surat-tugas/:id/ajukan` | Role | Ajukan surat tugas |
| POST | `/surat-tugas/:id/setujui` | Role | Setujui surat tugas |
| POST | `/surat-tugas/:id/resolve` | Role | Resolve surat tugas |

## Workflow surat tugas baru

`POST /surat-tugas`, `POST /surat-tugas/:id/start`, `POST /surat-tugas/:id/assign`, `POST /surat-tugas/:id/ready-to-print`, `POST /surat-tugas/:id/keluar`, `POST /surat-tugas/:id/serah`, `POST /surat-tugas/:id/terima`, `PUT /surat-tugas/:id/printer/:lineId/hasil`, `POST /surat-tugas/:id/selesai`, `POST /surat-tugas/:id/resolve`, dan `POST /surat-tugas/:id/cancel` tersedia pada service. Karena dua router dipasang pada prefix yang sama, frontend wajib memverifikasi response/status aktual saat mengintegrasikan aksi yang overlap.

## Audit, import, dan pengaturan

| Method | Path | Catatan |
|---|---|---|
| GET | `/audit` | List audit trail |
| GET | `/audit/tiket/:nomor_tiket` | Audit tiket |
| GET | `/audit/surat-tugas/:nomor_surat_tugas` | Audit surat tugas |
| GET | `/audit-barang` | List audit barang |
| GET | `/audit-barang/:jenis/:id` | Audit item berdasarkan jenis dan id |
| GET | `/master-import/:kind/format` | Format import |
| GET | `/master-import/:kind/template` | Download template |
| POST | `/master-import/:kind/preview` | Preview file import |
| POST | `/master-import/:kind/commit` | Commit file import |
| GET | `/pengaturan` | Pengaturan |
| PUT | `/pengaturan/sla-pending-komplain` | Ubah SLA |
| PUT | `/pengaturan/role-permission` | Ubah permission |

## Query conventions

CRUD list endpoints gebruiken `halaman` (default 1), `batas` (default 20, max 100), dan `cari`. Endpoint printer menambah filter `kategori_id`, `model_id`, `status`, `lokasi`, `gudang_id`, `account_id`, dan `customer_id`.

## Catatan integrasi

- Validasi body dilakukan service menggunakan Zod; frontend harus menampilkan error validasi dari `pesan`/`detail`.
- Permission adalah kombinasi autentikasi JWT, role, dan permission modul. Jangan menganggap tombol tersembunyi sebagai kontrol keamanan.
- Detail payload endpoint selain contoh autentikasi dan stok di atas harus dibaca dari route/schema terkait sebelum implementasi form.
- Perubahan kontrak wajib approval dan pembaruan file ini.
