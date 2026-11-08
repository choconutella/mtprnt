# Dokumentasi Skema Database Multiprint

Sumber: [`service/prisma/schema.prisma`](../service/prisma/schema.prisma).

Format kolom:

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|

## 1. `app_pengaturan`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `kunci` | varchar(100) | Key pengaturan; UNIQUE | - |
| `nilai` | JSON | Nilai konfigurasi | - |
| `tanggal_dibuat` | timestamptz | Waktu pembuatan | - |
| `tanggal_diperbarui` | timestamptz | Waktu perubahan terakhir | - |

## 2. `role_permission`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `role` | varchar(30) | Nama role | - |
| `modul` | varchar(50) | Nama modul | - |
| `can_view` | boolean | Izin melihat | - |
| `can_create` | boolean | Izin membuat | - |
| `can_update` | boolean | Izin mengubah | - |
| `can_delete` | boolean | Izin menghapus | - |
| `can_resolve` | boolean | Izin menyelesaikan | - |
| `can_workflow` | boolean | Izin workflow | - |
| `tanggal_dibuat` | timestamptz | Waktu pembuatan | - |
| `tanggal_diperbarui` | timestamptz | Waktu perubahan terakhir | - |

Unique: `role, modul`.

## 3. `master_account`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `master_customer.account_id`, `master_printer.account_id` |
| `kode_account` | varchar(50) | Kode account; UNIQUE; business key | `tiket.account_id`, `surat_tugas.account_id` |
| `nama_account` | varchar(200) | Nama account | - |
| `npwp` | varchar(50) nullable | Nomor pajak | - |
| `telepon` | varchar(50) nullable | Nomor telepon | - |
| `email` | varchar(150) nullable | Email account | - |
| `alamat_penagihan` | text nullable | Alamat penagihan | - |
| `aktif` | boolean | Status aktif | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 4. `master_customer`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `master_kontrak.customer_id`, `master_printer.customer_id` |
| `account_id` | UUID | Account pemilik | `master_account.id` |
| `kode_customer` | varchar(50) | Kode customer; business key | `tiket.customer_id`, `surat_tugas.customer_id` |
| `nama_customer` | varchar(200) | Nama customer | - |
| `alamat` | text | Alamat customer | - |
| `nama_pic`, `telepon_pic`, `email_pic` | varchar | Data PIC customer | - |
| `aktif` | boolean | Status aktif | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 5. `master_pengguna`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | Kolom pengguna pada `master_gudang`, `mutasi_stok`, `surat_tugas`, `riwayat_audit` |
| `user_id` | varchar(20) | ID pengguna legacy; UNIQUE; business key | `tiket.owner`, `tiket.dibuat_oleh`, `surat_tugas_teknisi.teknisi_id` |
| `nama` | varchar(150) | Nama pengguna | - |
| `email` | varchar(150) nullable | Email; UNIQUE | - |
| `telepon` | varchar(50) nullable | Nomor telepon | - |
| `peran` | enum `peran_pengguna` | Role pengguna | - |
| `aktif` | boolean | Status aktif | - |
| `kata_sandi_hash` | text nullable | Hash password | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 6. `master_gudang`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `master_printer.gudang_id`, mutasi, stok, dan `surat_tugas_item` |
| `kode_gudang` | varchar(50) | Kode gudang; UNIQUE; business key | `surat_tugas.gudang_id` |
| `nama_gudang` | varchar(150) | Nama gudang | - |
| `jenis_gudang` | enum `jenis_gudang` | Jenis gudang | - |
| `teknisi_id` | UUID nullable | Teknisi penanggung jawab | `master_pengguna.id` |
| `alamat` | text nullable | Alamat gudang | - |
| `aktif` | boolean | Status aktif | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 7. `master_printer_kategori`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `master_printer_model.kategori_id` |
| `kode_kategori` | varchar(50) | Kode kategori; UNIQUE | - |
| `nama_kategori` | varchar(150) | Nama kategori | - |
| `aktif` | boolean | Status aktif | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 8. `master_printer_model`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `master_printer.model_id` |
| `kategori_id` | UUID | Kategori printer | `master_printer_kategori.id` |
| `kode_model` | varchar(50) | Kode model; UNIQUE; business key | `surat_tugas_printer.model_id` |
| `merek` | varchar(100) | Merek printer | - |
| `nama_model` | varchar(150) | Nama model | - |
| `aktif` | boolean | Status aktif | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 9. `master_printer`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `surat_tugas.unit_asal_id`, item mutasi, item surat tugas |
| `mp_no` | varchar(150) | Nomor printer; UNIQUE; business key | `tiket.mp_no`, `surat_tugas.mp_no`, `surat_tugas_printer.mp_no` |
| `serial_number` | varchar(150) nullable | Nomor serial; UNIQUE | - |
| `model_id` | UUID | Model printer | `master_printer_model.id` |
| `gudang_id` | UUID nullable | Gudang printer | `master_gudang.id` |
| `account_id` | UUID nullable | Account pemilik | `master_account.id` |
| `customer_id` | UUID nullable | Customer pemilik | `master_customer.id` |
| `surat_tugas_aktif_id` | varchar(100) nullable | Surat tugas aktif | `surat_tugas.id` |
| `status` | varchar(20) | Status printer | - |
| `lokasi_detail` | varchar(200) nullable | Detail lokasi | - |
| `tanggal_pembelian`, `tanggal_instalasi` | date nullable | Riwayat tanggal printer | - |
| `tanggal_maintenance_berikutnya` | date nullable | Jadwal maintenance | - |
| `interval_maintenance_bulan` | integer nullable | Interval maintenance | - |
| `meter_hitam_putih`, `meter_warna` | integer | Meter printer | - |
| `keterangan` | text nullable | Catatan printer | - |
| `lokasi_jenis`, `penempatan`, `kondisi` | varchar | Status lokasi/penempatan/kondisi | - |
| `kontrak_id` | UUID nullable | Kontrak printer | `master_kontrak.id` |
| `lokasi_internal` | varchar(200) nullable | Lokasi internal | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 10. `master_kontrak`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `master_printer.kontrak_id`, `tiket.kontrak_id`, `surat_tugas.kontrak_id` |
| `customer_id` | UUID | Customer kontrak | `master_customer.id` |
| `nomor_kontrak` | varchar(100) | Nomor kontrak; UNIQUE | - |
| `tanggal_mulai`, `tanggal_selesai` | date | Periode kontrak | - |
| `jenis_layanan` | varchar(100) | Jenis layanan | - |
| `sla_respon_jam`, `sla_penyelesaian_jam` | integer | SLA layanan | - |
| `status` | varchar(50) | Status kontrak | - |
| `keterangan` | text nullable | Catatan kontrak | - |
| `tiket_id` | UUID nullable | Tiket asal kontrak; UNIQUE | `tiket.id` |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 11. `master_toner`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | Detail mutasi, stok toner, dan item surat tugas |
| `kode_toner` | varchar(50) | Kode toner; UNIQUE | - |
| `nama_toner` | varchar(200) | Nama toner | - |
| `warna` | varchar(50) nullable | Warna toner | - |
| `tipe` | varchar(100) nullable | Tipe toner | - |
| `merek` | varchar(100) nullable | Merek toner | - |
| `model_printer_kompatibel` | text nullable | Model kompatibel | - |
| `satuan` | varchar(30) | Satuan stok | - |
| `aktif` | boolean | Status aktif | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 12. `master_suku_cadang`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | Detail mutasi, stok suku cadang, dan item surat tugas |
| `kode_suku_cadang` | varchar(50) | Kode suku cadang; UNIQUE | - |
| `nama_suku_cadang` | varchar(200) | Nama suku cadang | - |
| `aktif` | boolean | Status aktif | - |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 13. `mutasi_stok`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | `detail_mutasi_stok.mutasi_stok_id` |
| `nomor_mutasi` | varchar(100) | Nomor mutasi; UNIQUE | - |
| `jenis_mutasi` | enum `jenis_mutasi_stok` | Jenis mutasi | - |
| `tanggal_mutasi` | timestamptz | Waktu mutasi | - |
| `gudang_asal_id`, `gudang_tujuan_id` | UUID nullable | Gudang asal/tujuan | `master_gudang.id` |
| `jenis_referensi` | varchar(50) nullable | Tipe referensi polimorfik | Tidak ada FK langsung |
| `referensi_id` | varchar(100) nullable | ID referensi polimorfik | Tidak ada FK langsung |
| `status` | enum `status_mutasi_stok` | Status mutasi | - |
| `keterangan` | text nullable | Catatan mutasi | - |
| `dibuat_oleh` | UUID nullable | Pengguna pembuat | `master_pengguna.id` |
| `tanggal_dibuat` | timestamptz | Waktu pembuatan | - |
| `tanggal_terposting` | timestamptz nullable | Waktu posting | - |

## 14. `detail_mutasi_stok`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `mutasi_stok_id` | UUID | Header mutasi | `mutasi_stok.id` |
| `jenis_barang` | enum `jenis_barang` | Jenis item | - |
| `toner_id` | UUID nullable | Toner | `master_toner.id` |
| `printer_id` | UUID nullable | Printer | `master_printer.id` |
| `suku_cadang_id` | UUID nullable | Suku cadang | `master_suku_cadang.id` |
| `jumlah` | numeric(14,2) | Jumlah item | - |
| `satuan` | varchar(30) | Satuan item | - |
| `keterangan` | text nullable | Catatan detail | - |

## 15. `stok_toner`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `gudang_id` | UUID | Gudang stok | `master_gudang.id` |
| `toner_id` | UUID | Toner stok | `master_toner.id` |
| `jumlah_tersedia` | numeric(14,2) | Stok tersedia | - |
| `jumlah_dicadangkan` | numeric(14,2) | Stok dicadangkan | - |
| `tanggal_diperbarui` | timestamptz | Waktu perubahan stok | - |

Unique: `gudang_id, toner_id`.

## 16. `stok_suku_cadang`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `gudang_id` | UUID | Gudang stok | `master_gudang.id` |
| `suku_cadang_id` | UUID | Suku cadang stok | `master_suku_cadang.id` |
| `jumlah_tersedia` | numeric(14,2) | Stok tersedia | - |
| `jumlah_dicadangkan` | numeric(14,2) | Stok dicadangkan | - |
| `tanggal_diperbarui` | timestamptz | Waktu perubahan stok | - |

Unique: `gudang_id, suku_cadang_id`.

## 17. `tiket`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | varchar(100) | Primary key | `master_kontrak.tiket_id`, `surat_tugas.tiket_id`, `tiket.tiket_asal_id` |
| `slug` | UUID | Identifier URL; UNIQUE | - |
| `mp_no` | varchar(150) nullable | Nomor printer terkait | Business key `master_printer.mp_no` |
| `kategori`, `jenis`, `status` | varchar | Kategori, jenis, dan status tiket | - |
| `account_id` | varchar(50) nullable | Account terkait | `master_account.kode_account` |
| `customer_id` | varchar(50) nullable | Customer terkait | `master_customer.kode_customer` |
| `kontrak_id` | UUID nullable | Kontrak terkait | `master_kontrak.id` |
| `tiket_asal_id` | varchar(100) nullable | Tiket asal/lanjutan | `tiket.id` |
| `owner` | varchar(20) nullable | Owner tiket | `master_pengguna.user_id` |
| `tanggal_transaksi`, `tanggal_akhir` | timestamptz | Waktu transaksi dan akhir | - |
| `mode`, `lokasi_internal`, `alasan` | varchar | Metadata penanganan | - |
| `deskripsi` | text nullable | Deskripsi masalah | - |
| `hasil` | varchar(50) nullable | Hasil penanganan | - |
| `ringkasan_penyelesaian` | text nullable | Ringkasan penyelesaian | - |
| `dibuat_oleh` | varchar(20) nullable | Pengguna pembuat | `master_pengguna.user_id` |
| `tanggal_dibuat`, `tanggal_diperbarui`, `tanggal_diselesaikan` | timestamptz | Audit dan penyelesaian | - |

## 18. `surat_tugas`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | varchar(100) | Primary key | Item, teknisi, printer, dan `master_printer.surat_tugas_aktif_id` |
| `slug` | UUID | Identifier URL; UNIQUE | - |
| `tiket_id` | varchar(100) nullable | Tiket sumber | `tiket.id` |
| `kontrak_id` | UUID nullable | Kontrak terkait | `master_kontrak.id` |
| `unit_asal_id` | UUID nullable | Printer unit asal | `master_printer.id` |
| `mp_no` | varchar(150) nullable | Printer target | `master_printer.mp_no` |
| `account_id` | varchar(50) nullable | Account terkait | `master_account.kode_account` |
| `customer_id` | varchar(50) nullable | Customer terkait | `master_customer.kode_customer` |
| `gudang_id` | varchar(50) nullable | Gudang terkait | `master_gudang.kode_gudang` |
| `pic_warehouse_id` | UUID nullable | PIC warehouse | `master_pengguna.id` |
| `tanggal_jadwal`, `mulai_kunjungan`, `selesai_kunjungan` | timestamptz nullable | Jadwal dan waktu kunjungan | - |
| `tanggal_maintenance_otomatis` | date nullable | Jadwal maintenance otomatis | - |
| `jenis_pekerjaan`, `jenis_tugas` | varchar | Jenis pekerjaan/tugas | - |
| `lokasi_internal`, `sumber` | varchar | Lokasi dan sumber tugas | - |
| `tanggal_transaksi`, `tanggal_akhir` | timestamptz nullable | Waktu transaksi dan akhir | - |
| `catatan_masalah`, `tindakan`, `hasil` | text | Masalah, tindakan, dan hasil | - |
| `status` | enum `status_surat_tugas` | Status workflow | - |
| `disetujui_oleh` | UUID nullable | Pengguna approval | `master_pengguna.id` |
| `disetujui_pada` | timestamptz nullable | Waktu approval | - |
| `validasi_warehouse_oleh` | UUID nullable | Validator warehouse | `master_pengguna.id` |
| `validasi_warehouse_pada` | timestamptz nullable | Waktu validasi warehouse | - |
| `validasi_kepala_teknisi_oleh` | UUID nullable | Validator kepala teknisi | `master_pengguna.id` |
| `validasi_kepala_teknisi_pada` | timestamptz nullable | Waktu validasi kepala teknisi | - |
| `dibuat_oleh` | UUID nullable | Pengguna pembuat | `master_pengguna.id` |
| `tanggal_dibuat`, `tanggal_diperbarui` | timestamptz | Audit waktu | - |

## 19. `surat_tugas_printer`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `surat_tugas_id` | varchar(100) | Surat tugas | `surat_tugas.id` |
| `mp_no` | varchar(150) | Printer terkait | `master_printer.mp_no` |
| `model_id` | varchar(50) nullable | Model printer berdasarkan business key | `master_printer_model.kode_model` |
| `serial_number` | varchar(150) nullable | Snapshot serial printer | - |
| `sumber` | varchar(200) nullable | Sumber data | - |
| `peran` | varchar(30) | Peran printer | - |
| `hasil`, `alasan` | varchar/text nullable | Hasil dan alasan | - |
| `kondisi_hasil`, `kondisi_sebelum` | varchar(30) nullable | Kondisi printer | - |
| `konfirmasi_keluar_pada`, `konfirmasi_serah_pada`, `konfirmasi_terima_pada`, `disetujui_kepala_pada` | timestamptz nullable | Waktu konfirmasi/status | - |

## 20. `surat_tugas_teknisi`

Model Prisma: `teknisi_surat_tugas`.

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `surat_tugas_id` | varchar(100) | Surat tugas | `surat_tugas.id` |
| `teknisi_id` | varchar(20) | Teknisi yang ditugaskan | `master_pengguna.user_id` |
| `peran` | enum `peran_teknisi_surat_tugas` | Utama atau pendamping | - |

Unique: `surat_tugas_id, teknisi_id`.

## 21. `surat_tugas_item`

Model Prisma: `pemakaian_barang_surat_tugas`.

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `surat_tugas_id` | varchar(100) | Surat tugas | `surat_tugas.id` |
| `gudang_id` | UUID | Gudang pemakaian | `master_gudang.id` |
| `jenis_barang` | enum `jenis_barang` | Jenis barang | - |
| `toner_id` | UUID nullable | Toner yang dipakai | `master_toner.id` |
| `printer_id` | UUID nullable | Printer yang dipakai | `master_printer.id` |
| `suku_cadang_id` | UUID nullable | Suku cadang yang dipakai | `master_suku_cadang.id` |
| `jumlah_pakai` | numeric(14,2) | Jumlah pemakaian | - |
| `serial_number` | varchar(150) nullable | Serial barang | - |
| `keterangan` | text nullable | Catatan pemakaian | - |

## 22. `riwayat_audit`

| Nama kolom | Data type | Fungsi / keterangan kolom | Referensi dari table lain (if exists) |
|---|---|---|---|
| `id` | UUID | Primary key | - |
| `jenis_dokumen`, `nomor_dokumen` | varchar | Identitas dokumen | - |
| `tabel_sumber`, `id_sumber` | varchar | Referensi audit polimorfik | Tidak ada FK langsung |
| `aksi` | varchar(50) | Aksi yang dilakukan | - |
| `status_sebelum`, `status_sesudah` | varchar(50) nullable | Status sebelum/sesudah | - |
| `data_sebelum`, `data_sesudah` | JSON nullable | Snapshot data | - |
| `keterangan` | text nullable | Catatan audit | - |
| `pengguna_id` | UUID nullable | Pengguna pelaku aksi | `master_pengguna.id` |
| `nama_pengguna` | varchar(150) nullable | Snapshot nama pengguna | - |
| `ip_address` | varchar(100) nullable | IP address | - |
| `user_agent` | text nullable | User agent | - |
| `tanggal_audit` | timestamptz | Waktu audit | - |

## Enum

| Enum | Nilai |
|---|---|
| `jenis_barang` | `toner`, `printer`, `suku_cadang` |
| `jenis_gudang` | `utama`, `cabang`, `teknisi` |
| `jenis_mutasi_stok` | `masuk`, `keluar`, `transfer`, `penyesuaian`, `pemakaian` |
| `status_mutasi_stok` | `draft`, `terposting`, `dibatalkan` |
| `peran_pengguna` | `admin`, `sales`, `sales_admin`, `kepala_teknisi`, `teknisi`, `warehouse` |
| `peran_teknisi_surat_tugas` | `utama`, `pendamping` |
| `status_surat_tugas` | `pending`, `progress`, `ready_to_print`, `technician_completed`, `warehouse_validated`, `solved`, `cancelled`, `draft`, `ditugaskan`, `diproses`, `diajukan`, `disetujui`, `ditutup`, `dibatalkan` |

## Catatan perubahan referensi

Perubahan pada Prisma schema, migration, database, API, atau perilaku endpoint memerlukan persetujuan eksplisit terlebih dahulu.

| No. | Tabel sumber | Kolom sumber | Referensi saat ini | Referensi yang diinginkan | Alasan |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |
