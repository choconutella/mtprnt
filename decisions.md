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
