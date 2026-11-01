# Project Agents

## Tujuan Proyek

Multiprint adalah aplikasi operasional untuk mengelola printer, master data, stok, pengaduan, tiket, surat tugas, pengguna, audit, dan pengaturan layanan.

## Otoritas

File ini berisi aturan khusus proyek dan berada di bawah master `AGENTS.md` lingkungan Codex. Jika terjadi konflik, ikuti master policy.

## Peran dan Stack

Bertindak sebagai implementation partner yang konservatif, menjaga kompatibilitas dengan service yang sudah ada.

- Backend: Express.js, Prisma, PostgreSQL di `service/`.
- Frontend: Nuxt dan Vue.js dengan Nuxt UI di `frontend/`.
- Kontrak API: `api-contracts/`.

## Aturan Perubahan

- Perubahan frontend baru hanya boleh dilakukan di `frontend/`.
- Jangan mengubah backend, database, migration, atau konfigurasi di `service/` tanpa approval eksplisit dari user.
- Jangan mengubah kontrak API atau perilaku endpoint tanpa approval; dokumentasikan perubahan di `api-contracts/` setelah disetujui.
- Pertahankan bahasa domain dan nama field API yang sudah digunakan service.
- Hindari refactor luas dan dependency baru jika tidak diperlukan.

## Frontend

- Gunakan Nuxt, Vue.js, dan Nuxt UI sebagai fondasi UI.
- Integrasikan frontend terhadap endpoint yang tercatat di `api-contracts/`; jangan menebak endpoint baru.
- Pisahkan komponen UI, halaman, composable, dan client API secara jelas.
- Sediakan state loading, error, empty, permission, dan validasi untuk alur operasional utama.

### Selection dan Pencarian Master Data

- Selection yang mengambil data master berukuran besar wajib memakai pencarian server-side melalui parameter `cari` atau parameter pencarian resmi pada kontrak API.
- Jangan memuat seluruh master data hanya untuk mengisi opsi selection.
- Saat awal dibuka, tampilkan paling banyak 20 hasil pertama; gunakan pagination atau batas hasil yang wajar.
- Terapkan debounce sekitar 300 ms pada input pencarian agar request tidak dikirim pada setiap ketikan.
- Tampilkan state loading, empty, dan error pada selection/search.
- Pertahankan item yang sedang terpilih ketika hasil pencarian berubah agar label selection tidak hilang.
- Gunakan `USelectMenu` atau komponen Nuxt UI yang mendukung input pencarian; jangan membuat endpoint atau parameter baru tanpa approval.

## Verifikasi

- Sebelum perubahan frontend selesai, jalankan pemeriksaan dan test yang tersedia di `frontend/`.
- Untuk perubahan kontrak yang sudah disetujui, verifikasi request, response envelope, autentikasi, role, dan status error.
- Jangan menandai task selesai tanpa memperbarui tracking yang relevan.

## Dokumentasi dan Tracking

- Gunakan `tasks.json` sebagai backlog aktif.
- Gunakan `decisions.md` untuk keputusan arsitektur, domain, keamanan, integrasi, deployment, dan database.
- Gunakan `changelogs.md` untuk perubahan bermakna yang memengaruhi pengguna, integrator, atau operasional.
- Rujuk skill `project-tracking` untuk prosedur rinci.

## Approval Proyek

Minta approval sebelum mengubah API publik, skema database, migration, alur bisnis, autentikasi/otorisasi, deployment, atau file apa pun di `service/`.
