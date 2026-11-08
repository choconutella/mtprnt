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
| GET/POST/PUT | `/toner` dan `/toner/:id` | Permission | CRUD toner tanpa fitur hapus |
| GET/POST/PUT | `/suku-cadang` dan `/suku-cadang/:id` | Permission | CRUD sparepart tanpa fitur hapus |
| GET/POST/PUT | `/gudang` dan `/gudang/:id` | Permission | CRUD gudang tanpa fitur hapus |
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
| GET | `/tiket/catalog` | Permission | Katalog jenis tiket |
| GET/POST/PUT | `/tiket` dan `/tiket/:id` | Permission | CRUD tiket; `jenis` opsional pada Tiket baru dan ditentukan pada Surat Tugas |
| POST | `/tiket/:id/resolve` | Permission | Selesaikan tiket |
| POST | `/tiket/:id/cancel` | Permission | Batalkan tiket |

`POST /tiket` dan `PUT /tiket/:id` memakai `sales_id` sebagai ID Owner tiket (nama field lama dipertahankan). Owner boleh user aktif dengan role apa pun; pada kategori `delivery` dan `komplain`, Owner wajib diisi. Owner tidak otomatis mendapat hak akses tiket di luar aturan role yang berlaku. `PUT /tiket/:id` juga menerima `tanggal_transaksi` (ISO datetime) dan `deskripsi`. Nomor, kategori, customer, dan unit printer tetap dibaca saja.

Tiket `toner_purchase` tidak menerima rincian toner atau jumlah. Item toner dicatat melalui `POST /surat-tugas/:id/pemakaian` pada ST `kirim_toner` setelah pekerjaan dimulai; konfirmasi barang keluar memerlukan minimal satu item toner. Field `toner` dan relasi `tiket_barang` telah dihapus dari kontrak Tiket.

Tiket memiliki satu objek printer pada field `mp_no` (string, boleh kosong untuk tiket toner). `POST /tiket` menerima `mp_no`; field `printer` lama boleh dikirim hanya dengan satu unit yang sama sebagai input kompatibilitas, tetapi tidak lagi disimpan atau dikembalikan sebagai `tiket_printer`. Pada Tiket TUKAR dan BACK-UP, `mp_no` adalah unit lama/bermasalah. Unit pengganti dicatat pada `surat_tugas_printer` saat ST pengiriman dibuat. Untuk Tiket penerimaan printer baru, MP No dapat dicatat sebelum unit ada di master; Model dan Sumber diisi pada ST penerimaan, yang mendaftarkan unit ke master dengan status tidak aktif sampai penerimaan dikonfirmasi.

`GET /pengguna?halaman=1&batas=20&cari=...` mengembalikan `{ items, meta }` berisi user aktif, dengan pencarian nama atau user ID. Tanpa parameter tersebut, respons tetap berupa daftar langsung untuk kompatibilitas klien lama.
| GET/POST/PUT | `/surat-tugas` dan `/surat-tugas/:id` | Role | CRUD surat tugas |
| POST | `/surat-tugas/:id/teknisi` | Role | Assign teknisi |
| POST | `/surat-tugas/:id/start` | Role | Mulai pekerjaan |
| POST | `/surat-tugas/:id/pemakaian` | Role | Catat pemakaian barang |
| DELETE | `/surat-tugas/:id/pemakaian/:pemakaianId` | Role | Hapus pemakaian |
| DELETE | `/surat-tugas/:id/printer/:lineId` | Role | Hapus unit printer dari ST dan lepaskan reservasinya bila masih aktif |
| POST | `/surat-tugas/:id/selesai-teknisi` | Role | Teknisi selesai |
| POST | `/surat-tugas/:id/validasi-warehouse` | Role | Validasi warehouse |
| POST | `/surat-tugas/:id/ajukan` | Role | Ajukan surat tugas |
| POST | `/surat-tugas/:id/setujui` | Role | Setujui surat tugas |
| POST | `/surat-tugas/:id/resolve` | Role | Resolve surat tugas |

Alur Komplain lama dan endpoint `/pengaduan` telah dihapus. Gunakan Tiket kategori `komplain` untuk mencatat masalah, objek printer, status, dan Surat Tugas terkait. Field `pengaduan_id` dan `pengaduan_lama_id` tidak lagi diterima atau dikembalikan.

Identitas Surat Tugas pada respons API dan parameter path `:id` sekarang berupa nomor ST (contoh `ST-20261106-ABC123`). Field `nomor_surat_tugas` tetap tersedia sebagai alias nilai `id`; `slug` berisi UUID lama dan tidak dipakai sebagai path ID. Pada request dan respons ST, `account_id` memakai `kode_account` dan `customer_id` memakai `kode_customer`; `tiket_id` dan `gudang_id` tetap memakai identifier sesuai kontrak masing-masing. ID relasi anak dan referensi audit ST memakai nomor ST.

Referensi printer fisik Surat Tugas memakai `mp_no` yang terhubung ke `master_printer.mp_no`; kolom `surat_tugas.printer_id` telah dihapus. API lama tetap menerima dan mengembalikan `printer_id` sebagai UUID turunan dari MP No untuk form lama. Pada penerimaan printer baru, unit master dibuat berstatus `inactive` bersama ST sehingga referensi induk dan baris unit langsung tersedia. Respons API menampilkan MP No sebelum penerimaan selesai.

Pada `surat_tugas_printer`, `mp_no` adalah foreign key ke `master_printer.mp_no` dan `model_id` fisik mengacu ke `master_printer_model.kode_model`. API tetap menerima dan mengembalikan UUID pada `printer[].printer_id`, `printer[].model_id`, serta baris respons untuk kompatibilitas. `terima_printer_baru` membuat unit master berstatus `inactive` saat ST dibuat; `POST /surat-tugas/:id/terima` mengaktifkan unit tersebut setelah gudang menerima barang. Field `printer[].tanggal_pembelian` dan `printer[].serial_number` opsional untuk unit baru.

## Workflow surat tugas baru

`PUT /surat-tugas/:id` pada ST baru menyimpan `hasil` pekerjaan selama ST belum ditutup. Field relasi/jenis yang dikirim oleh form harus sama dengan nilai tersimpan; perubahan field tersebut ditolak dengan 422. Penghapusan unit printer dilakukan melalui `DELETE /surat-tugas/:id/printer/:lineId` saat ST pending/progress dan sebelum Konfirmasi Keluar. Hasil per unit tetap disimpan melalui `PUT /surat-tugas/:id/printer/:lineId/hasil`.

`tanggal_maintenance_berikutnya` pada Unit Printer dapat bernilai `null` meskipun `interval_maintenance_bulan` terisi. Saat Surat Tugas Maintenance mencapai `solved`, service mengisi tanggal berikutnya dari tanggal Resolve ditambah interval bulan. Pembuatan dan pengubahan Unit Printer memakai ST Maintenance terakhir yang selesai untuk menghitung ulang tanggal tersebut; tanpa riwayat selesai, nilainya tetap `null`.

`GET /surat-tugas` dan `GET /surat-tugas/:id` mengembalikan daftar (maksimal 100 terbaru) dan detail dalam envelope standar; teknisi hanya melihat ST yang ditugaskan, sedangkan Sales/Sales Admin hanya melihat ST dari Tiket milik atau buatan mereka. `POST /surat-tugas`, `POST /surat-tugas/:id/start`, `POST /surat-tugas/:id/assign`, `POST /surat-tugas/:id/keluar`, `POST /surat-tugas/:id/serah`, `POST /surat-tugas/:id/terima`, `POST /surat-tugas/:id/pemakaian`, `DELETE /surat-tugas/:id/pemakaian/:pemakaianId`, `PUT /surat-tugas/:id/printer/:lineId/hasil`, `POST /surat-tugas/:id/selesai`, `POST /surat-tugas/:id/resolve`, dan `POST /surat-tugas/:id/cancel` tersedia pada service. Endpoint pemakaian hanya dapat digunakan saat ST berstatus `progress` dan sebelum Konfirmasi Keluar.

Untuk `POST /surat-tugas` dengan `jenis_tugas: "maintenance"` tanpa `tiket_id` (Maintenance gudang), `gudang_id`, `pic_teknisi_id`, dan minimal satu unit pada `printer` wajib diisi. `account_id` dan `customer_id` harus kosong/null. Setiap unit harus memiliki `printer_id` serta `mp_no` yang cocok dan berada di Gudang (`lokasi_jenis: "gudang"`, `gudang_id` sama dengan pilihan). Ketidakcocokan lokasi/relasi menghasilkan 422. Maintenance yang berasal dari Tiket tetap memakai Account/Customer dan validasi lokasi customer sesuai Tiket. `PUT /surat-tugas/:id` menerima pembaruan ST Maintenance gudang tanpa Account/Customer; relasi unit pada `surat_tugas_printer` tetap dipertahankan.

Penugasan teknisi pada database disimpan di tabel `surat_tugas_teknisi`, dengan `teknisi_id` mereferensikan `master_pengguna.user_id`. API tetap menerima dan mengembalikan `pic_teknisi_id` sebagai UUID pengguna; service menerjemahkan UUID tersebut ke `user_id` saat menyimpan.

Identitas utama Tiket pada database sekarang adalah `id` berisi nomor tiket; UUID lama tersedia sebagai `slug`. Relasi Account, Customer, Owner, dan Pembuat disimpan sebagai `kode_account`, `kode_customer`, dan `master_pengguna.user_id`. API kanonik memakai `owner`, sementara alias `nomor_tiket` dan `sales_id` masih dikembalikan untuk kompatibilitas klien lama.

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
