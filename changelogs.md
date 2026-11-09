# Changelogs

## 2026-11-09

### Changed

- Membangun ulang container `frontend` dan `service` serta memperbarui export image `multiprint-frontend.tar` dan `multiprint-service.tar`.
- Memperbaiki pemilihan printer pada tab Items Surat Tugas yang dibuka dari `/tiket`; popup memuat ulang opsi dan filter UUID gudang pada API printer kini diterjemahkan ke kode gudang internal.
- Menyimpan item printer yang ditambahkan saat edit Surat Tugas berstatus progress dan menampilkan kembali item pemakaian saat Surat Tugas dibuka ulang.
- Item Surat Tugas dapat ditambahkan saat pending; pilihan printer tidak lagi dikosongkan ketika Mode atau jenis tugas berubah dan tetap tampil saat Surat Tugas dibuka ulang.

## 2026-11-08

### Database and API compatibility

- Menerapkan skema business key dari `database-schema-edit.md`: master menggunakan `slug` UUID untuk URL, sedangkan relasi database menggunakan kode bisnis bertipe `varchar`.
- Menambahkan migration 023 yang mempertahankan `master_pengguna`, mengosongkan tabel non-pengguna lokal sesuai persetujuan, dan membangun ulang foreign key.
- Mempertahankan kompatibilitas endpoint dengan menerjemahkan UUID pada request API menjadi kode bisnis sebelum disimpan ke database.
- Memverifikasi endpoint utama, pembuatan master, pembuatan Unit Printer, dan posting mutasi stok terhadap database lokal.
- Menetapkan admin sebagai superuser pada backend dan menormalkan role secara case-insensitive agar admin tetap dapat mengakses semua modul dan aksi.
- Menyamakan pemeriksaan `isAdmin` frontend agar role admin dengan variasi kapitalisasi atau spasi tetap dapat membuat dan mengubah master data.
- Menghapus endpoint dan aksi hapus Toner serta Sparepart dari frontend dan service; status `aktif` tetap dapat diubah melalui form edit.
- Menghapus endpoint dan aksi hapus Gudang; tombol Aktif/Nonaktif Gudang kini mengubah status melalui `PUT` seperti master Sparepart.
- Menyamakan tombol Aktif/Nonaktif pada User, Kategori Printer, Model Printer, Customer, dan Billing; perubahan status kini memakai endpoint `PUT` masing-masing.
- Menghapus baris sintetis “Belum ada gudang” dari daftar stok Toner dan Sparepart; daftar kini hanya menampilkan stok yang benar-benar tersimpan pada gudang.
- Memperbaiki validasi Customer saat menyimpan Tiket agar UUID Account dibandingkan dengan kode Account yang tersimpan pada relasi Customer.
- Memperbaiki payload printer saat membuat Surat Tugas dari Tiket agar `model_id` mengirim UUID model, bukan kode model bisnis.
- Memperbaiki validasi Account/Customer pada pembuatan Surat Tugas dari Tiket agar relasi Customer dibandingkan dengan kode Account yang tersimpan.
- Memperbaiki penyimpanan Surat Tugas agar `dibuat_oleh` dan PIC Warehouse menggunakan `user_id` sesuai kolom kode pengguna, bukan UUID.
- Memperbaiki workflow Surat Tugas agar Konfirmasi Keluar, Konfirmasi Terima, dan penyelesaian menyimpan `user_id` pada kolom validator serta mutasi stok.
- Memperbaiki penyelesaian pengiriman Surat Tugas agar Account/Customer printer menggunakan kode bisnis yang sesuai foreign key database.
- Menyembunyikan field Unit Printer untuk Tiket Delivery dan memastikan payload/API menolak keterikatan printer pada kategori tersebut.
- Menyembunyikan field Unit Printer pada Edit Tiket jika Tiket tidak memiliki `mp_no`, termasuk kasus Delivery tanpa printer.

### Fixed

- Simpan Customer kini menerjemahkan UUID Billing ke kode Account pada foreign key database. Daftar dan perubahan Customer tetap memakai UUID pada API; pemeriksaan relasi dan penghapusan Account diselaraskan.
- Penyimpanan Items pada Surat Tugas yang dibuat dari Tiket tidak lagi mengirim `printer_id`/`mp_no` ke PUT identitas ST, sehingga printer komplain tidak dianggap berubah saat printer bawaan ditambahkan atau disimpan.
- Penghapusan printer dari Items Surat Tugas kini menghapus baris unit melalui endpoint khusus dan melepas reservasi printer terkait; tidak lagi mengirim perubahan `printer_id` melalui PUT.
- Printer objek Tiket pada ST On-site Service tidak lagi dihitung sebagai barang bawaan di tab Items.
- Workflow Surat Tugas disesuaikan dengan rancangan terbaru. Pengiriman, Back-up, dan Internal Use selesai setelah Konfirmasi Keluar, sedangkan On-site Service, Repair, dan Maintenance menggunakan Konfirmasi Pengembalian sebelum Selesai Pekerjaan.
- Field Unit Lama pada Back-up bertiket kini menampilkan MP No printer dari Tiket secara readonly.
- Penyimpanan Unit Printer kini mengirim field tanggal kosong sebagai `null` agar lolos validasi service.
- Field Interval Maintenance tetap tampil pada form Unit Printer. Backend kini mengizinkan interval tanpa tanggal maintenance berikutnya, sedangkan tanggal maintenance tetap membutuhkan interval.
- Penyimpanan interval maintenance kini menghitung tanggal maintenance berikutnya secara otomatis sesuai interval; tanggal yang sudah ada dipertahankan jika interval tidak berubah.
- Jadwal maintenance kini mengacu pada tanggal Resolve ST Maintenance terakhir ditambah interval bulan. Tanggal berikutnya boleh kosong sebelum ada riwayat selesai; migration 022 menghapus aturan pasangan tanggal/interval dan menyelaraskan data lama.

### Changed

- Jenis Terima Unit Rusak dan Terima Tukar dihapus dari pilihan pembuatan Surat Tugas dan digabungkan ke jenis Return.

## 2026-11-07

### Fixed

- Konfirmasi Pengembalian dan pemeriksaan unit pada ST kini menggunakan UUID Account/Customer dari master saat mengakses Unit Printer dan Kontrak; ST tetap menyimpan kode referensi sesuai kontrak.
- Pencarian Unit Printer di form ST mengubah kode Customer menjadi UUID khusus untuk filter `/printer`, sehingga memilih jenis On-site Service tidak lagi memicu validasi filter; rincian field yang gagal juga ditampilkan saat pembuatan ST.
- Form Surat Tugas kini mengirim `account_id` sebagai `kode_account` dan `customer_id` sebagai `kode_customer`; validasi serta response ST baru disesuaikan dengan kontrak kode referensi tersebut.
- Memperbaiki pembuatan ST `on_site_service` dari Tiket Komplain; validasi Account/Customer kini membandingkan UUID dari request dengan kode referensi internal Tiket secara benar.
- Mengembalikan endpoint baca daftar dan detail Surat Tugas pada router baru setelah penghapusan router legacy, sehingga halaman `/surat-tugas` tidak lagi mendapat 404 saat memuat daftar.
- Tab Unit Printer pada Surat Tugas kini hanya tampil untuk jenis Repair, On-site Service, dan Maintenance.

### Changed

- Tiket kini mencatat satu objek printer melalui `mp_no`. Untuk TUKAR dan BACK-UP, unit pengganti dipilih pada Surat Tugas; rincian Model dan Sumber penerimaan printer baru juga diisi pada Surat Tugas. Relasi `tiket_printer` dihapus.
- Alur Komplain lama dihapus. Tabel `pengaduan`, endpoint `/pengaduan`, relasi `tiket.pengaduan_lama_id`, trigger sinkronisasi, dan route Surat Tugas legacy tidak lagi digunakan; pencatatan masalah memakai Tiket kategori `komplain`.
- Rincian toner dipindahkan sepenuhnya ke item Surat Tugas. Tabel `tiket_barang`, field `toner` pada pembuatan Tiket, dan input toner pada form Tiket dihapus; ST pengiriman toner mengharuskan item sebelum barang keluar.
- Baris Unit Printer Surat Tugas kini memakai MP No dan kode model sebagai referensi fisik. Printer baru dibuat di master saat ST penerimaan dibuat dengan status tidak aktif, lalu diaktifkan setelah konfirmasi gudang; form menyediakan serial number dan tanggal pembelian opsional.
- Referensi printer pada Surat Tugas kini memakai `mp_no` dengan foreign key ke master printer. Kolom fisik `surat_tugas.printer_id` dihapus; field API lama tetap tersedia sebagai nilai turunan.

## 2026-11-06

### Changed

- Menjadikan nomor Surat Tugas sebagai `id` utama pada database, API, dan relasi anak; UUID lama menjadi `slug` terindeks. Kolom fisik referensi Account, Customer, Tiket, dan Gudang kini memakai kode bisnis, sementara field API terkait tetap memakai UUID master. Migrasi lokal mempertahankan seluruh Surat Tugas dan memperbarui referensi audit lama.
- Menghapus kolom `surat_tugas.pengaduan_id` dan field API terkait. Alur Komplain lama kini menghubungkan Surat Tugas melalui `tiket_id`, dengan Tiket arsip yang dibuat untuk setiap Komplain agar relasi dan hak akses tetap berjalan.
- Mengganti nama tabel fisik item Surat Tugas menjadi `surat_tugas_item` pada database lokal dan skrip inisialisasi berikutnya. Nama relasi Prisma serta field respons API tetap kompatibel; referensi audit diselaraskan.

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
- Mengganti tabel relasi teknisi menjadi `surat_tugas_teknisi` dan memindahkan foreign key `teknisi_id` ke `master_pengguna.user_id`, dengan translasi API tetap kompatibel.
- Mengubah identitas Tiket: UUID menjadi `slug`, nomor tiket menjadi primary key `id`, relasi Account/Customer/Owner/Pembuat memakai kode master atau `user_id`, dan `sales_id` menjadi `owner`.
