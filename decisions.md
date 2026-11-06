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
