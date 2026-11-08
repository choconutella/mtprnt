# Decisions

## DEC-001: Frontend baru menggunakan Nuxt, Vue.js, dan Nuxt UI

- Date: 2026-11-01
- Status: Accepted
- Context: Project membutuhkan frontend baru untuk mengonsumsi service Express yang sudah tersedia.
- Decision: Bangun frontend di `frontend/` menggunakan Nuxt, Vue.js, dan Nuxt UI.
- Reason: Stack ini sesuai arahan proyek dan menyediakan fondasi Vue dengan komponen UI yang konsisten.
- Alternatives Considered: Memakai framework frontend lain atau membangun komponen UI sendiri.
- Consequences: Struktur dan dependency frontend mengikuti ekosistem Nuxt; API client harus disesuaikan dengan kontrak di `api-contracts/`.

## DEC-002: Backend existing menjadi sumber kebenaran

- Date: 2026-11-01
- Status: Accepted
- Context: `service/` sudah memiliki endpoint, validasi, workflow, autentikasi, dan permission yang berjalan.
- Decision: Frontend mengonsumsi API existing dan tidak mengubah backend tanpa approval eksplisit.
- Reason: Mengurangi risiko perubahan perilaku bisnis dan menjaga scope implementasi frontend.
- Alternatives Considered: Refactor backend bersamaan dengan pembangunan frontend.
- Consequences: Gap atau ketidakkonsistenan API dicatat sebagai blocker/permintaan approval, bukan diperbaiki diam-diam di `service/`.

## DEC-003: Kontrak API didokumentasikan sebagai snapshot dari service

- Date: 2026-11-01
- Status: Accepted
- Context: Belum ada spesifikasi API terpisah yang menjadi acuan frontend.
- Decision: Simpan inventaris endpoint dan bentuk payload utama di `api-contracts/README.md`, diturunkan dari `service/src/`.
- Reason: Frontend membutuhkan acuan terpusat tanpa mengklaim detail yang belum terlihat dari implementasi.
- Alternatives Considered: Membuat OpenAPI lengkap sebelum semua payload endpoint diaudit.
- Consequences: Kontrak harus diperbarui saat ada perubahan backend yang telah disetujui; endpoint baru tidak boleh diasumsikan hanya dari kebutuhan UI.

## DEC-004: Billing dapat dibuat sebelum Customer

- Date: 2026-11-01
- Status: Accepted
- Context: Halaman Account dipisah menjadi Billing dan Customer; form Billing hanya mengisi identitas penagihan, sedangkan Customer memilih Billing.
- Decision: `customer_pertama` pada `POST /account` menjadi opsional. Relasi Customer tetap memakai `account_id` dan endpoint Customer existing.
- Reason: Memungkinkan alur membuat Billing lalu menambahkan Customer tanpa memaksa field Customer pada form Billing.
- Alternatives Considered: Tetap mewajibkan Customer pertama pada form Billing.
- Consequences: Billing dapat memiliki nol Customer; alur operasional yang membutuhkan Customer harus memilih Customer yang tersedia.

## DEC-005: Deployment lokal frontend menggunakan Nuxt production server di compose root

- Date: 2026-11-01
- Status: Accepted
- Context: Frontend baru perlu dijalankan dalam Docker bersama service, database, dan frontend lama yang sudah ada.
- Decision: Gunakan Dockerfile multi-stage di `frontend/` dan definisikan service `frontend` di `docker-compose.yml` root; URL API diatur melalui `NUXT_PUBLIC_API_BASE_URL`.
- Reason: Satu entry point Compose menyederhanakan operasi lokal, sementara frontend lama tetap tersedia melalui service `ui` dan konfigurasi API tetap dapat diganti tanpa rebuild image.
- Alternatives Considered: Mempertahankan compose terpisah di `frontend/` atau mengganti service `ui` pada compose root.
- Consequences: Frontend tersedia di port 3000 secara default; service API harus tersedia di host pada port 5000 atau URL API perlu dioverride saat menjalankan compose.

## DEC-006: Jenis pekerjaan dipilih pada Surat Tugas

- Date: 2026-11-04
- Status: Accepted
- Context: Dokumen WO–ST memisahkan kebutuhan pada WO dari rincian pelaksanaan pada ST. Satu Tiket dapat membutuhkan beberapa ST, seperti BACK UP yang memiliki pengiriman pengganti dan penerimaan unit rusak.
- Decision: Tiket baru hanya menyimpan kategori dan cakupan kebutuhan umum. Jenis pekerjaan dipilih saat membuat ST setelah Tiket dipilih; pilihan ST difilter berdasarkan kategori Tiket. Tiket menampilkan rekomendasi penutupan setelah ST terkait selesai, tetapi penutupan tetap dilakukan manual.
- Temporary access: Admin menggunakan hak penutupan selama role Supervisor belum tersedia.
- Consequences: Field `jenis` pada database lama dipertahankan untuk kompatibilitas, tetapi Tiket baru menyimpannya kosong. Endpoint ST menerima Tiket tanpa jenis dan memvalidasi jenis tugas berdasarkan kategori.

## DEC-007: Owner Tiket dapat berupa user aktif dengan role apa pun

- Date: 2026-11-06
- Status: Accepted
- Context: Form Tiket sebelumnya menampilkan Sales dan service membatasi pilihan ke role Sales; kebutuhan operasional meminta Owner dari semua user.
- Decision: Tampilkan pilihan sebagai Owner dan validasi semua user aktif. Pertahankan `sales_id` sebagai nama field API dan kolom database untuk kompatibilitas; Owner wajib untuk kategori delivery dan komplain, opsional untuk kategori lain. Hak akses tiket tetap diatur oleh role dan alur yang sudah ada.
- Reason: Memenuhi kebutuhan penugasan tanpa migrasi data atau memutus kontrak klien lama.
- Alternatives Considered: Menambah kolom dan field `owner_id` baru melalui migrasi; mengganti nama `sales_id` secara breaking.
- Consequences: Nama internal `sales_id` bersifat historis dan perlu dijelaskan di kontrak. Penugasan Owner tidak otomatis memberi akses tiket kepada user yang ditunjuk.

## DEC-008: Maintenance mandiri mengacu pada printer di gudang

- Date: 2026-11-06
- Status: Accepted
- Context: Surat Tugas Maintenance mandiri men-service printer yang berada di gudang; Account dan Customer tidak relevan, sedangkan validasi service sebelumnya menganggap semua Maintenance berada di customer.
- Decision: Untuk Maintenance tanpa Tiket, wajib pilih Gudang dan unit yang benar-benar berada di Gudang tersebut. Account/Customer harus kosong. Maintenance dari Tiket mempertahankan relasi dan validasi customer yang sudah berlaku.
- Reason: Relasi ST mencerminkan lokasi fisik unit tanpa menciptakan Account/Customer fiktif.
- Alternatives Considered: Mewajibkan Account/Customer fiktif atau mengubah semua Maintenance menjadi alur gudang.
- Consequences: Validasi pembuatan dan edit ST serta dokumentasi kontrak membedakan Maintenance mandiri dari Maintenance bertiket; tidak memerlukan migrasi karena relasi Account/Customer sudah nullable.

## DEC-009: Siap Cetak dihapus dari workflow aktif

- Date: 2026-11-06
- Status: Accepted
- Context: Aksi `Siap Cetak` hanya menjadi tahap perantara dan menambah transisi yang tidak diperlukan pada alur Surat Tugas.
- Decision: Hapus endpoint dan seluruh kontrol UI yang membuat atau menampilkan transisi `ready_to_print`. Setelah `progress`, Surat Tugas memakai aksi keluar/serah/selesai sesuai jenis dan validasi operasionalnya.
- Reason: Menyederhanakan workflow tanpa mengubah alur validasi barang, konfirmasi gudang, atau penyelesaian teknisi.
- Alternatives Considered: Mempertahankan aksi sebagai tahap opsional atau menghapus enum database sekaligus.
- Consequences: Data lama dengan status `ready_to_print` tetap dapat dibaca karena enum dipertahankan, tetapi tidak ada aksi baru yang menghasilkan status tersebut.

## DEC-010: Nama tabel fisik item Surat Tugas disederhanakan

- Date: 2026-11-06
- Status: Accepted
- Context: Tabel fisik `pemakaian_barang_surat_tugas` diminta berganti nama menjadi `surat_tugas_item`, sementara nama model dan relasi Prisma sudah dipakai oleh service dan frontend.
- Decision: Rename tabel melalui skrip SQL baru dan petakan model Prisma lama dengan `@@map("surat_tugas_item")`. Nama field API dan relasi Prisma tetap dipertahankan. Referensi audit lama diselaraskan ke nama tabel baru.
- Reason: Memenuhi penamaan database tanpa memutus kontrak API atau memerlukan perubahan frontend.
- Alternatives Considered: Mengganti nama model dan semua relasi Prisma sekaligus, yang akan mengubah respons API dan membutuhkan perubahan di seluruh klien.
- Consequences: Nama model Prisma tetap historis; skrip SQL baru harus diterapkan pada database existing sebelum service dengan schema Prisma baru dijalankan.

## DEC-011: Surat Tugas lama memakai relasi Tiket

- Date: 2026-11-06
- Status: Accepted
- Context: `surat_tugas.pengaduan_id` menduplikasi relasi Komplain yang telah dimigrasi ke Tiket, tetapi alur Komplain lama dan UI lama masih mengandalkannya.
- Decision: Hapus kolom dan field API `pengaduan_id` dari Surat Tugas. Setiap Komplain lama memiliki Tiket arsip dengan ID yang sama; Surat Tugas lama memakai `tiket_id`. UI lama juga memakai `tiket_id` untuk memilih dan menampilkan Komplain terkait.
- Reason: Satu relasi Surat Tugas ke Tiket menghindari duplikasi, sambil mempertahankan alur Komplain lama.
- Alternatives Considered: Mempertahankan dua kolom relasi atau alias API `pengaduan_id`; keduanya tidak sesuai permintaan penghapusan field lama.
- Consequences: Klien yang masih mengirim `pengaduan_id` harus beralih ke `tiket_id`. Migrasi memindahkan relasi lama sebelum menghapus kolom, dan sinkronisasi Komplain ke Tiket tetap diperlukan selama alur lama aktif.

## DEC-012: Nomor Surat Tugas menjadi kunci utama

- Date: 2026-11-06
- Status: Accepted
- Context: Identitas fisik Surat Tugas perlu mengikuti nomor dokumen; UUID lama dan referensi master tetap perlu dipertahankan tanpa memutus data serta alur UI.
- Decision: Rename UUID `surat_tugas.id` menjadi `slug` yang terindeks dan `nomor_surat_tugas` menjadi primary key `id`. Empat foreign key anak dan ID Surat Tugas pada API memakai nomor ST. Kolom fisik Account, Customer, Tiket, dan Gudang merujuk kode bisnisnya; API tetap menerima dan mengembalikan UUID master. `kode_customer` unik global.
- Reason: Nomor dokumen menjadi identitas konsisten untuk relasi dan audit, sementara pemetaan di service mempertahankan input pilihan master dari UI.
- Consequences: Migrasi 014 harus dijalankan setelah 013 sebelum service baru; referensi audit dan mutasi ST lama ikut dikonversi. `nomor_surat_tugas` pada respons tetap alias `id`, dan URL lama berbasis UUID ST tidak berlaku lagi. Perubahan kode master mengikuti foreign key dengan `ON UPDATE CASCADE`.

## DEC-013: Surat Tugas merujuk printer melalui MP No

- Date: 2026-11-07
- Status: Accepted
- Context: `surat_tugas.printer_id` menduplikasi `mp_no`, sedangkan MP No master printer sudah unik. Penerimaan printer baru dapat dibuat sebelum unit terdaftar di master.
- Decision: Pakai `surat_tugas.mp_no` sebagai foreign key ke `master_printer.mp_no` dengan `ON UPDATE CASCADE`, lalu hapus kolom fisik `printer_id`. Penerimaan unit baru menyimpan MP No pada baris `surat_tugas_printer` sampai unit master dibuat. Service menerjemahkan field API `printer_id` lama dari dan ke MP No.
- Reason: Satu referensi printer fisik pada induk Surat Tugas dan alur penerimaan unit baru tetap terjaga.
- Consequences: Migrasi 015 harus dijalankan setelah 014. MP No master yang berubah akan memperbarui referensi induk ST; klien lama tetap dapat memakai UUID printer pada API. Aturan penerimaan unit baru diubah lebih lanjut pada DEC-014.

## DEC-014: Baris Unit ST memakai kode printer dan model

- Date: 2026-11-07
- Status: Accepted
- Context: Baris `surat_tugas_printer` masih menyimpan UUID printer dan model; foreign key MP No membutuhkan master printer tersedia saat ST dibuat.
- Decision: Buat master printer berstatus `inactive` dalam transaksi pembuatan ST penerimaan printer baru. Baris ST merujuk `master_printer.mp_no` dan `master_printer_model.kode_model`; UUID `printer_id` fisik dihapus. Konfirmasi gudang mengaktifkan unit master yang sama. Field UUID pada API tetap diterjemahkan oleh service.
- Reason: Referensi MP No dapat ditegakkan sejak pembuatan ST tanpa mencatat unit yang belum diterima sebagai stok tersedia.
- Consequences: Unit yang menunggu penerimaan muncul di master sebagai tidak aktif. Migrasi 016 berlaku setelah 015; pembatalan ST tidak mengaktifkan unit tersebut.

## DEC-015: Rincian toner hanya dicatat pada Surat Tugas

- Date: 2026-11-07
- Status: Accepted
- Context: `tiket_barang` menduplikasi pencatatan item toner yang tersedia pada Surat Tugas. Data lokal tabel ini kosong.
- Decision: Hapus `tiket_barang` dan field `toner` pada API Tiket. Tiket kategori pembelian toner tetap mencatat kebutuhan umum; toner dan jumlah ditambahkan sebagai item ST `kirim_toner` sebelum barang keluar.
- Reason: Satu sumber rincian toner berada pada dokumen pelaksanaan yang juga mengatur stok dan konfirmasi gudang.
- Consequences: ST pengiriman toner baru tidak lagi menyalin item dari Tiket. Migrasi 017 harus dijalankan setelah 016 sebelum service baru digunakan.

## DEC-016: Satu MP No objek pada Tiket

- Date: 2026-11-07
- Status: Accepted
- Context: Baris `tiket_printer` memungkinkan beberapa unit dan mencampur objek masalah dengan unit pengganti yang seharusnya dicatat pada Surat Tugas.
- Decision: Simpan satu `mp_no` pada `tiket` dan hapus tabel `tiket_printer`. Pada TUKAR dan BACK-UP, MP No Tiket menunjuk unit lama atau bermasalah; ST pengiriman mencatat unit pengganti. MP No Tiket penerimaan printer baru boleh belum terdaftar di master, dan ST penerimaan mencatat model serta sumber lalu membuat unit master.
- Reason: Tiket memiliki satu objek printer, sedangkan rincian pekerjaan dan pergantian unit berada pada Surat Tugas.
- Consequences: Migrasi 018 mengisi MP No Tiket dari baris objek yang ada dan menolak data ambigu sebelum menghapus tabel lama. Respons Tiket tidak lagi berisi `tiket_printer`; permintaan pembuatan masih boleh memakai satu baris `printer` sebagai input kompatibilitas.

## DEC-017: Hapus tabel dan alur Pengaduan lama

- Date: 2026-11-07
- Status: Accepted
- Context: Pengaduan sudah tidak memiliki data lokal dan alur operasional telah dipusatkan pada Tiket. Tabel pengaduan, Tiket legacy, trigger sinkronisasi, dan endpoint lama menambah relasi yang tidak lagi digunakan.
- Decision: Hapus tabel `pengaduan`, foreign key dan field `tiket.pengaduan_lama_id`, enum pengaduan, trigger sinkronisasi, route `/pengaduan`, dan route Surat Tugas legacy. Tiket kategori `komplain` menjadi satu-satunya alur pengaduan.
- Reason: Menghilangkan dua sumber data dan menghindari pemeliharaan alur yang sudah tidak digunakan.
- Consequences: Endpoint `/pengaduan` dan kompatibilitas data Komplain lama tidak tersedia lagi. Migration 019 berhenti jika tabel atau Tiket legacy masih berisi data.

## DEC-018: Referensi teknisi Surat Tugas memakai user_id

- Date: 2026-11-07
- Status: Accepted
- Context: Tabel relasi teknisi masih memakai nama lama dan foreign key UUID internal `master_pengguna.id`.
- Decision: Rename tabel fisik `teknisi_surat_tugas` menjadi `surat_tugas_teknisi` dan ubah `teknisi_id` menjadi foreign key ke `master_pengguna.user_id`. Model Prisma tetap memakai nama relasi yang kompatibel, sedangkan API menerjemahkan UUID `pic_teknisi_id` ke `user_id`.
- Reason: `user_id` adalah identitas pengguna yang stabil untuk relasi operasional, sementara API lama tetap dapat digunakan tanpa perubahan payload.
- Consequences: Migration 020 memetakan enam assignment lokal ke `tech001` dan menolak data tanpa `user_id` atau assignment ganda dalam satu ST.

## DEC-019: Identitas Tiket memakai nomor tiket dan kode master

- Date: 2026-11-07
- Status: Accepted
- Context: Tiket masih memakai UUID internal sebagai primary key, sementara nomor tiket adalah identitas operasional yang tampil di seluruh alur.
- Decision: Rename UUID `tiket.id` menjadi `slug`, rename `nomor_tiket` menjadi primary key `id`, arahkan Account/Customer/Owner/Pembuat ke kode account, kode customer, dan `master_pengguna.user_id`, serta rename `sales_id` menjadi `owner`.
- Reason: Relasi operasional memakai identitas domain yang stabil dan dapat dibaca, tanpa menghilangkan UUID slug untuk kebutuhan internal.
- Consequences: Migration 021 mengonversi seluruh relasi tiket, service memakai `id` sebagai nomor tiket, dan API menyediakan alias kompatibilitas `nomor_tiket`/`sales_id` selama klien lama beralih.
## DEC-020: Jadwal maintenance dari ST terakhir

- Date: 2026-11-08
- Status: Accepted
- Context: Form Unit Printer menyimpan interval maintenance tanpa input tanggal. Constraint lama mensyaratkan tanggal dan interval selalu berpasangan.
- Decision: Tanggal Maintenance Berikutnya nullable. Tanggal tersebut dihitung dari tanggal Resolve ST Maintenance terakhir untuk MP No printer ditambah interval bulan. Tanpa ST Maintenance yang selesai, tanggal tetap kosong. Penyelesaian ST Maintenance memperbarui tanggal dalam transaksi yang sama.
- Reason: Jadwal mengikuti pekerjaan maintenance yang benar-benar selesai, bukan tanggal pendaftaran unit atau rencana sebelumnya.
- Consequences: Migration 022 mengganti constraint dan menghitung ulang tanggal existing dari ST yang selesai. Pembuatan ST Maintenance otomatis baru berjalan setelah unit memiliki tanggal berikutnya.

## DEC-021: Business key master dengan slug UUID

- Date: 2026-11-08
- Status: Accepted
- Context: Dokumentasi `database-schema-edit.md` memisahkan identifier URL dari identifier operasional dan mengarahkan relasi database ke kode bisnis.
- Decision: Tabel master memakai UUID `slug` untuk identifier URL dan kode bisnis sebagai kolom fisik `id`/foreign key. `master_pengguna` tidak boleh ditruncate; `user_id` yang ada dipertahankan sebagai key operasional dan dipindahkan ke kolom fisik `id`.
- Reason: Kode bisnis sudah digunakan oleh operasi dan kontrak API, sedangkan UUID tetap diperlukan untuk identifier publik yang tidak mudah ditebak.
- Consequences: Migration 023 mengosongkan tabel non-pengguna lokal, mengubah tipe foreign key, dan membuat ulang constraint. Service mempertahankan payload API UUID melalui translasi ke business key sebelum menulis ke database.

## DEC-022: Admin sebagai superuser

- Date: 2026-11-08
- Status: Accepted
- Context: Admin harus dapat mengakses seluruh modul dan aksi tanpa bergantung pada baris `role_permission`.
- Decision: Role `admin` selalu melewati middleware `izin` dan `otorisasi`. Normalisasi role dilakukan secara trim dan case-insensitive agar `admin`, `Admin`, dan `ADMIN` diperlakukan sama.
- Reason: Admin adalah role pengelola sistem dan tidak boleh kehilangan akses karena permission tersimpan, format role, atau perubahan konfigurasi modul.
- Consequences: Hak akses admin tidak dapat dibatasi dari halaman Role Permission; perubahan permission tetap berlaku untuk role non-admin.
