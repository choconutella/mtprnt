const column = (key, label, required, example, note = "", options = {}) => ({ key, label, required, example, note, ...options });

const active = column("aktif", "Aktif", false, "ya", "ya/tidak; kosong = ya", { type: "boolean" });

const formats = {
  account: {
    title: "Account dan Customer Pertama",
    code: "kode_account",
    columns: [
      column("kode_account", "Kode Account", true, "ACC-001", "Unik global", { max: 50 }),
      column("nama_account", "Nama Account", true, "PT Contoh", "", { max: 200 }),
      column("npwp", "NPWP", false, "01.234.567.8-901.000", "", { max: 50 }),
      column("telepon", "Telepon Account", false, "0211234567", "", { max: 50 }),
      column("email", "Email Account", false, "admin@contoh.co.id", "", { type: "email", max: 150 }),
      column("alamat_penagihan", "Alamat Penagihan", false, "Jakarta", ""),
      column("kode_customer", "Kode Customer Pertama", true, "CUS-001", "Customer pertama dibuat bersama Account", { max: 50 }),
      column("nama_customer", "Nama Customer Pertama", true, "Kantor Pusat", "", { max: 200 }),
      column("alamat_customer", "Alamat Customer", true, "Jl. Contoh No. 1, Jakarta", "Alamat operasional"),
      column("nama_pic", "Nama PIC", false, "Budi", "", { max: 150 }),
      column("telepon_pic", "Telepon PIC", false, "08123456789", "", { max: 50 }),
      column("email_pic", "Email PIC", false, "budi@contoh.co.id", "", { type: "email", max: 150 }),
      active
    ]
  },
  lokasiCustomer: {
    title: "Lokasi Customer",
    code: "kode_customer",
    columns: [
      column("kode_account", "Kode Account", true, "ACC-001", "Account harus sudah ada dan aktif", { max: 50 }),
      column("kode_customer", "Kode Customer", true, "CUS-002", "Unik dalam Account", { max: 50 }),
      column("nama_customer", "Nama Lokasi Customer", true, "Cabang Bandung", "", { max: 200 }),
      column("alamat", "Alamat", true, "Jl. Contoh No. 2, Bandung", "Alamat operasional"),
      column("nama_pic", "Nama PIC", false, "Sari", "", { max: 150 }),
      column("telepon_pic", "Telepon PIC", false, "08123456780", "", { max: 50 }),
      column("email_pic", "Email PIC", false, "sari@contoh.co.id", "", { type: "email", max: 150 }),
      active
    ]
  },
  printerKategori: {
    title: "Kategori Printer",
    code: "kode_kategori",
    columns: [
      column("kode_kategori", "Kode Kategori", true, "LASER", "Unik global", { max: 50 }),
      column("nama_kategori", "Nama Kategori", true, "Laser Printer", "", { max: 150 }),
      active
    ]
  },
  printerModel: {
    title: "Model Printer",
    code: "kode_model",
    columns: [
      column("kode_kategori", "Kode Kategori", true, "LASER", "Kategori harus sudah ada dan aktif", { max: 50 }),
      column("kode_model", "Kode Model", true, "HP-M404", "Unik global", { max: 50 }),
      column("merek", "Merek", true, "HP", "", { max: 100 }),
      column("nama_model", "Nama Model", true, "LaserJet Pro M404", "", { max: 150 }),
      active
    ]
  },
  printer: {
    title: "Unit Printer",
    code: "mp_no",
    columns: [
      column("mp_no", "MP No", true, "MP-0001", "Satu baris = satu unit; unik global", { max: 150 }),
      column("serial_number", "Serial Number", false, "SN123456", "Unik jika diisi", { max: 150 }),
      column("kode_model", "Kode Model", true, "HP-M404", "Model dan kategorinya harus aktif", { max: 50 }),
      column("kode_gudang", "Kode Gudang Awal", true, "GDG-01", "Gudang harus sudah ada dan aktif", { max: 50 }),
      column("tanggal_pembelian", "Tanggal Pembelian", false, "2026-10-15", "YYYY-MM-DD; boleh kosong", { type: "date" }),
      column("tanggal_maintenance_berikutnya", "Maintenance Berikutnya", false, "2027-01-15", "YYYY-MM-DD; isi bersama interval", { type: "date" }),
      column("interval_maintenance_bulan", "Interval Maintenance (Bulan)", false, "3", "1-120; isi bersama tanggal maintenance", { type: "integer", min: 1, max: 120 }),
      column("keterangan", "Keterangan", false, "Unit baru", "Status awal otomatis available")
    ]
  },
  toner: {
    title: "Toner",
    code: "kode_toner",
    columns: [
      column("kode_toner", "Kode Toner", true, "TON-001", "Unik global", { max: 50 }),
      column("nama_toner", "Nama Toner", true, "Toner 85A", "", { max: 200 }),
      column("warna", "Warna", true, "Hitam", "", { max: 50 }),
      column("tipe", "Tipe", true, "Laser", "", { max: 100 }),
      active
    ]
  },
  sukuCadang: {
    title: "Sparepart",
    code: "kode_suku_cadang",
    columns: [
      column("kode_suku_cadang", "Kode Sparepart", true, "SP-001", "Unik global", { max: 50 }),
      column("nama_suku_cadang", "Nama Sparepart", true, "Fuser Unit", "", { max: 200 }),
      active
    ]
  },
  gudang: {
    title: "Master Gudang",
    code: "kode_gudang",
    columns: [
      column("kode_gudang", "Kode Gudang", true, "GDG-01", "Unik global", { max: 50 }),
      column("nama_gudang", "Nama Gudang", true, "Gudang Utama", "", { max: 150 }),
      column("jenis_gudang", "Jenis Gudang", true, "utama", "utama/cabang/teknisi", { choices: ["utama", "cabang", "teknisi"] }),
      column("user_id_teknisi", "User ID Teknisi", false, "teknisi", "Isi hanya untuk gudang teknisi", { max: 20 }),
      column("alamat", "Alamat", false, "Jakarta", ""),
      active
    ]
  },
  pengguna: {
    title: "Master Akun / User",
    code: "user_id",
    columns: [
      column("user_id", "Username", true, "teknisi01", "Unik global", { max: 20 }),
      column("name", "Nama", true, "Teknisi Satu", "", { max: 150 }),
      column("email", "Email", true, "teknisi01@contoh.co.id", "Unik global", { type: "email", max: 150 }),
      column("role", "Role", true, "teknisi", "admin/sales/sales-admin/kepala-teknisi/teknisi/warehouse", { choices: ["admin", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"] }),
      column("password", "Password Awal", true, "", "Minimal 6 karakter. Hapus file setelah impor.", { type: "password" }),
      { ...active, key: "active" }
    ]
  }
};

module.exports = { formats };
