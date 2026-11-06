# Changelogs

## 2026-11-06

### Fixed

- Surat Tugas berstatus `solved` kini dibuka dalam mode lihat saja: tab Detil menampilkan nilai sebagai field readonly, sementara aksi perubahan disembunyikan dan tab lain tetap dapat dibaca.
- Tombol Simpan pada ST alur baru kini memakai endpoint edit khusus untuk menyimpan hasil pekerjaan; service tidak lagi mengarahkannya ke validasi ST lama.
- Aksi Selesai Pekerjaan kini memeriksa Hasil Unit pada popup Edit dan menyimpan perubahan unit sebelum mengirim transisi workflow; unit yang belum diisi ditunjukkan secara spesifik.
- Menghapus popup Detail Surat Tugas lama; daftar dan Tiket tetap membuka popup Edit Surat Tugas yang memiliki tab Detil, Items, dan Unit Printer.
- Tab Unit Printer kini tersedia dalam popup Edit Surat Tugas yang memiliki unit, termasuk Maintenance; hasil per unit disimpan bersama perubahan ST melalui satu tombol Simpan sebelum aksi Selesai Pekerjaan.
- Mengubah label aksi `Konfirmasi Serah` menjadi `Konfirmasi Pengembalian` pada seluruh UI Surat Tugas.
- Menghapus seluruh aksi aktif `Siap Cetak` dari service, frontend, dan UI lama; alur setelah `progress` kini langsung menggunakan aksi pekerjaan berikutnya. Nilai status legacy `ready_to_print` tetap dipertahankan di schema untuk kompatibilitas data lama.
- Tab Items pada Maintenance kini hanya menampilkan pemakaian toner/sparepart; unit yang diservis tetap dipilih pada Detil. Jenis pengiriman tetap menampilkan printer pada Items.
- Tab `Items` kini tampil juga untuk Surat Tugas `Maintenance` setelah Jenis Surat Tugas dipilih.
- Maintenance mandiri kini dapat dibuat untuk unit printer di Gudang tanpa Account/Customer; service memvalidasi kesesuaian lokasi unit dan Gudang, dan form edit tetap dapat menyimpan ST tersebut.
- Form Surat Tugas kini menampilkan `Jenis Surat Tugas` terlebih dahulu; field lain dan tab Items muncul setelah jenis dipilih, sementara Tiket terkait tetap terlihat.
- Jenis Surat Tugas `Maintenance` kini hanya menampilkan field `MP No (Unit Printer)`, `Gudang`, dan `PIC Teknisi`.
- Pilihan `MP No (Unit Printer)` pada `Maintenance` kini difilter berdasarkan Gudang yang dipilih.
- Menyembunyikan field `Tiket` pada form Buat Surat Tugas langsung dari `/surat-tugas`; field tetap tampil baca-saja saat form dibuka dari modal Tiket atau saat Surat Tugas yang diedit memiliki tiket terkait.
- Membangun ulang container `frontend` dan `service` pada 2026-11-06 serta memperbarui kedua export image TAR.
- Menampilkan checkbox `Sendiri` hanya pada modal Tambah Customer; modal Edit Customer langsung menampilkan pilihan Billing.
- Menghapus menu `Lokasi Customer` dan `Lokasi`, serta memindahkan `Master Gudang` menjadi menu langsung di bawah `Master Data`.
- Memformat pilihan `Model` pada modal Tambah Unit Printer di halaman Stok Printer menjadi `Merk Printer - Model Printer (Kategori Printer)`.
- Menghilangkan field `Maintenance Berikutnya` dari modal Unit Printer pada halaman Stok Printer.
- Menambahkan pencarian server pada pilihan Model Printer di modal Tambah/Edit Unit Printer, dengan hasil awal maksimal 20 dan label model terpilih tetap terlihat.
- Menghapus kolom `Cadangan` dari tabel Stok Toner dan Stok Sparepart.
- Menyamakan tata letak modal Buat Tiket dengan Edit Tiket: tab Detil dan Surat Tugas, ukuran modal, serta area konten bergulir.
- Mengganti pilihan Sales di modal Tiket menjadi Owner dari semua user aktif; service menerima Owner lintas role dan pilihan user mendukung pencarian server.
- Nomor Surat Tugas pada modal Edit Tiket dapat diklik untuk membuka popup Edit Surat Tugas; daftar diperbarui saat popup ditutup.

## 2026-11-04

### Changed

- Membangun ulang dan menjalankan container `frontend` serta `service` dari root Compose.
- Memperbarui export image `multiprint-frontend.tar` dan `multiprint-service.tar`.
- Mengganti tombol View pada halaman `/surat-tugas` menjadi Edit. Form edit menggunakan form yang sama dengan pembuatan Surat Tugas, mengisi data ST terpilih, dan menyimpan perubahan melalui endpoint PUT Surat Tugas.
- Menambahkan tab sidebar Detil dan Items pada popup Surat Tugas. Tab Items mendukung pemilihan printer serta penambahan toner/sparepart dengan gudang, jumlah, dan keterangan.
- Tab Items kini menampilkan jumlah item dan daftar beberapa Toner/Sparepart. Penambahan item tersedia setelah ST dimulai, sesuai batas status pada service.
- Tombol workflow Surat Tugas kini tersedia langsung pada tab Detil popup Edit dan status dimuat ulang setelah aksi berhasil.
- Tombol workflow, termasuk Mulai dan Batalkan, kini sejajar dengan Simpan Surat Tugas pada footer modal.
- Saat ST dapat dimulai, aksi Batalkan dipindahkan ke menu panah pada tombol Mulai.
- Popup ST kini hanya menampilkan langkah workflow berikutnya; Batalkan berada pada panah dropdown langkah aktif, termasuk Siap Cetak dan Selesai Pekerjaan.
- Setelah sebuah tahap selesai dan belum ada aksi lanjutan untuk peran pengguna, popup menampilkan nama tahap tersebut sebagai tombol nonaktif dengan menu Batalkan, tanpa label generik Aksi.
- Mengubah daftar Toner/Sparepart pada tab Items modal Edit Surat Tugas menjadi tabel dengan kolom jenis, item, gudang, jumlah, keterangan, dan aksi.
- Tab Items kini menyatukan printer, toner, dan sparepart dalam tabel; tombol Tambah Item membuka popup pemilihan jenis dan rincian item.
- Pilihan Printer selalu tampil pada popup Tambah Item; untuk penerimaan printer baru, popup mengarahkan pengisian MP No dan model ke tab Detil.
- Menetapkan dimensi popup Tambah Item agar tetap sama saat Jenis Item diganti, dengan area isi yang dapat digulir pada layar pendek.

- Tombol Buat Surat Tugas di modal Tiket kini membuka form Surat Tugas sebagai popup di halaman Tiket, dengan tiket terpilih otomatis dan field Tiket baca saja. Setelah Surat Tugas disimpan, modal Edit Tiket terbuka pada tab Surat Tugas.

- Modal Edit Tiket memiliki tab Detil dan Surat Tugas; Sales, tanggal tiket, dan deskripsi dapat diedit, sedangkan nomor, kategori, customer/site, dan unit printer hanya dibaca.

- Mengubah alur Tiket agar Tiket baru tidak lagi memilih Jenis Pekerjaan; jenis tugas dipilih saat membuat Surat Tugas berdasarkan kategori Tiket.
- Menambahkan rekomendasi siap ditinjau pada detail Tiket ketika seluruh Surat Tugas terkait telah selesai; penutupan tetap manual dan admin menjadi hak akses sementara.
- Menyesuaikan service agar Tiket tanpa jenis tetap kompatibel dengan Tiket lama dan ST dapat memvalidasi jenis tugas berdasarkan kategori.

## 2026-11-02

### Changed

- Menghapus `frontend/docker-compose.yml` setelah service `frontend` dipusatkan di compose root.
- Membuat ulang container `multiprint-frontend` dan `service` dari root Compose.
- Mengekspor image hasil build ke `multiprint-frontend.tar` dan `multiprint-service.tar`.

## 2026-11-01

### Added

- Menambahkan PRD untuk frontend Multiprint berbasis Nuxt, Vue.js, dan Nuxt UI.
- Menambahkan scaffold Nuxt UI di `frontend/` dengan `@nuxt/ui` 4.12.0.
- Menambahkan navigasi frontend dengan hierarki menu yang sama seperti aplikasi pada `ui/`.
- Menambahkan modul Kategori Printer, Model Printer, dan Unit Printer dengan flow API dari `ui/`.
- Menambahkan autentikasi frontend yang kompatibel dengan `ui/`, termasuk login, sesi Bearer, profil pengguna, dan redirect 401.
- Memperbaiki error runtime filter Unit Printer akibat `SelectItem` dengan value kosong.
- Menambahkan tombol refresh dan `+ Buat` pada menu Unit Printer, Kategori Printer, dan Model Printer.
- Memperbaiki posisi tombol refresh dan `+ Buat` agar tampil pada toolbar ketiga menu printer.
- Mengurutkan submenu Printer menjadi Kategori Printer, Model Printer, lalu Unit Printer.
- Memperlebar field Kategori pada modal Tambah Model Printer agar memenuhi lebar modal.
- Menambahkan halaman Master Gudang di `/master/gudang` dengan CRUD berbasis Nuxt UI, pagination, pencarian, status aktif, dan relasi teknisi.
- Menampilkan tombol `+ Buat` di samping tombol refresh pada toolbar Master Gudang.
- Menambahkan halaman Master Akun / User di `/master/pengguna` dengan CRUD pengguna berbasis Nuxt UI.
- Menambahkan status `isAdmin` terpusat pada autentikasi frontend agar admin melewati pembatasan akses halaman.
- Memperlebar field Model dan Gudang Awal pada modal Tambah Unit Printer.
- Menambahkan opsi `+ Buat Model` pada pilihan Model di modal Unit Printer yang membuka popup pembuatan model; model baru langsung terpilih setelah disimpan.
- Menambahkan opsi `+ Buat Gudang` pada pilihan Gudang Awal di modal Unit Printer yang membuka popup pembuatan gudang; gudang baru langsung terpilih setelah disimpan.
- Memperlebar field Keterangan pada modal Unit Printer.
- Menambahkan opsi `+ Buat Kategori` pada pilihan Kategori di modal Model Printer; kategori baru langsung terpilih setelah dibuat.
- Menambahkan opsi `+ Buat Kategori` juga pada popup Buat Model Printer dari halaman Unit Printer, dengan pemilihan otomatis kategori baru.
- Memperbaiki popup Buat Kategori dari Buat Model Printer agar tampil di depan dan kembali ke form model setelah ditutup.
- Memperlebar field Gudang dan Alasan pada modal aksi Unit Printer.
- Menambahkan aturan proyek pada `agents.md`, termasuk batas perubahan frontend dan approval backend.
- Menambahkan keputusan arsitektur awal pada `decisions.md`.
- Menambahkan snapshot kontrak API dari service di `api-contracts/README.md`.
- Menambahkan backlog awal pada `tasks.json`.
- Menambahkan halaman Master Toner di `/master/toner` berbasis Nuxt UI dengan pencarian, pagination, CRUD, nonaktifkan, dan hapus permanen.
- Menambahkan halaman Master Sparepart di `/master/sparepart` berbasis Nuxt UI dengan pencarian, pagination, CRUD, nonaktifkan, dan hapus permanen.
- Menggunakan logo `logo-multi-transparent.png` pada header sidebar frontend.
- Menggunakan `favicon.png` sebagai icon tab browser.
- Menambahkan halaman Account di `/master/account` berbasis Nuxt UI dengan CRUD Account, Customer pertama saat pembuatan, pengelolaan Customer/Site, pagination server, dan aksi status sesuai endpoint `/account`.
- Memperjelas validasi form Account baru dan menampilkan rincian kesalahan dari service saat penyimpanan gagal.
- Memisahkan Account menjadi halaman Customer dan Billing; Customer memilih Billing, sedangkan form Billing hanya berisi identitas dan alamat penagihan.
- Mengizinkan pembuatan Billing melalui `POST /account` tanpa `customer_pertama`.
- Memindahkan redirect `/master/account` ke route index agar halaman Customer dan Billing dapat dirender tanpa konflik parent route.
- Memulihkan status admin pada halaman Customer dan Billing dari profil service saat state frontend tertinggal, dengan pesan akses yang menampilkan role profil aktif.
- Menambahkan pencarian Billing pada selection Customer serta opsi `+ Buat Billing` yang otomatis memilih Billing baru.
- Customer kini dapat dipindahkan ke Billing lain saat diedit; Billing tujuan wajib aktif.
- Menambahkan checkbox `Sendiri` pada form Customer di area Billing; selection Billing menjadi nonaktif saat dicentang dan Billing otomatis dibuat dari kode serta nama Customer.
- Menampilkan tombol Nonaktifkan Customer sebagai disabled untuk Customer aktif terakhir yang tidak boleh dinonaktifkan.
- Menambahkan halaman `/stok/printer` berbasis Nuxt UI dengan ringkasan status, filter lokasi, pagination, dan aksi transfer, keluarkan, serta kembalikan unit.
- Menambahkan halaman `/stok/toner` berbasis Nuxt UI dengan pencarian, pagination, empty/loading/error state, pembatasan role, serta aksi tambah dan kurangi stok melalui endpoint mutasi existing.
- Memastikan role admin dapat mengelola stok toner melalui normalisasi role di frontend.
- Menambahkan halaman `/stok/sparepart` berbasis Nuxt UI dengan pencarian, pagination, state operasional, serta aksi tambah dan kurangi stok melalui endpoint mutasi existing.
- Menyederhanakan pencarian Stok Printer menjadi satu field multi-keyword; keyword dipisahkan koma dan dicocokkan pada MP No, serial, kategori, model, lokasi, serta status.
- Memusatkan fungsi CRUD Unit Printer di `/stok/printer`; menu Unit Printer pada Master Data dihapus dan `/master/printer` mengarah ke halaman stok.
- Menambahkan opsi `+ Buat Model` dan `+ Buat Gudang` pada form Tambah Unit Printer, dengan pemilihan otomatis setelah data berhasil dibuat.
- Menambahkan opsi `+ Buat Kategori` pada modal Buat Model Printer, dengan pemilihan otomatis setelah kategori berhasil dibuat.
- Menambahkan halaman `/surat-tugas` berbasis Nuxt UI dengan daftar, pencarian, pembuatan dari tiket atau mandiri, detail bertab, penugasan PIC, hasil unit, pemakaian barang, dan kontrol workflow sesuai role/status.
- Menambahkan halaman `/tiket` berbasis Nuxt UI dengan daftar/filter/pagination, pembuatan berdasarkan katalog, detail, update, resolve, cancel, dan relasi Surat Tugas.
- Menambahkan pencarian server-side berbasis debounce dan batas 20 hasil awal untuk pilihan master data pada form Tiket.
- Menambahkan halaman `/audit` berbasis Nuxt UI dengan filter tanggal, satu field Search gabungan user/nomor tiket/nomor surat tugas, state operasional, dan pagination.
- Menambahkan halaman `/audit-barang` berbasis Nuxt UI dengan filter tanggal, jenis barang, pencarian server-side, pagination, dan detail perubahan.
- Menambahkan halaman `/pengaturan/role-permission` berbasis Nuxt UI untuk mengatur permission role dan menyimpannya melalui endpoint pengaturan existing.
- Menambahkan halaman `/pengaturan/sla-pending-komplain` berbasis Nuxt UI untuk mengatur batas pending komplain dalam jam.
- Mengganti halaman awal Dashboard dengan ringkasan tiket, surat tugas, stok, printer, dan beban teknisi berbasis endpoint existing.
- Menambahkan deployment Docker lokal khusus `frontend/` dengan build Nuxt production dan konfigurasi URL API melalui environment variable.
- Menggabungkan service Nuxt production `frontend` ke `docker-compose.yml` root dengan build context `./frontend` dan port default 3000.
