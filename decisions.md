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
