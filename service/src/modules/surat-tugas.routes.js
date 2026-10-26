const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses, gagal } = require("../utils/response");
const { buatNomor } = require("../utils/nomor");
const { autentikasi, otorisasi } = require("../middlewares/auth");
const { normalisasiRole } = require("../utils/roles");
const { kurangiStok } = require("./stok.service");
const { aksiDariStatus, catatAudit } = require("./audit.service");
const { catatAuditBarang } = require("./audit-barang.service");
const { pastikanCustomerAccount } = require("./account.service");
const { jadwalBerikutnya, tanggalSaja } = require("./printer-maintenance.service");

const router = express.Router();

const STATUS_SURAT_TUGAS = ["pending", "progress", "ready_to_print", "technician_completed", "warehouse_validated", "solved", "cancelled"];
const LEGACY_STATUS_SURAT_TUGAS = ["draft", "ditugaskan", "diproses", "diajukan", "disetujui", "ditutup", "dibatalkan"];

const suratTugasSchema = z.object({
  nomor_surat_tugas: z.string().optional(),
  pengaduan_id: z.string().uuid().optional().nullable(),
  mp_no: z.string().optional().nullable(),
  account_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  printer_id: z.string().uuid().optional().nullable(),
  pic_teknisi_id: z.string().uuid().optional().nullable(),
  tanggal_jadwal: z.string().optional().nullable(),
  mulai_kunjungan: z.string().optional().nullable(),
  selesai_kunjungan: z.string().optional().nullable(),
  jenis_pekerjaan: z.string().optional(),
  catatan_masalah: z.string().optional().nullable(),
  tindakan: z.string().optional().nullable(),
  hasil: z.string().optional().nullable(),
  status: z.enum([...STATUS_SURAT_TUGAS, ...LEGACY_STATUS_SURAT_TUGAS]).optional()
});

const teknisiSchema = z.object({
  teknisi_id: z.string().uuid(),
  peran: z.enum(["utama", "pendamping"]).optional()
});

const pemakaianSchema = z.object({
  gudang_id: z.string().uuid(),
  jenis_barang: z.enum(["toner", "printer", "suku_cadang"]),
  toner_id: z.string().uuid().optional().nullable(),
  printer_id: z.string().uuid().optional().nullable(),
  suku_cadang_id: z.string().uuid().optional().nullable(),
  jumlah_pakai: z.number().positive(),
  serial_number: z.string().optional().nullable(),
  keterangan: z.string().optional().nullable()
});

function assertRole(role, allowed, message = "Anda tidak memiliki akses untuk aksi ini.") {
  if (role === "admin" || allowed.includes(role)) return;
  throw Object.assign(new Error(message), { statusCode: 403 });
}

function rolePengguna(req) {
  return normalisasiRole(req.pengguna.peran);
}

function hanyaRole(req, allowed, message = "Anda tidak memiliki akses untuk aksi ini.") {
  assertRole(rolePengguna(req), allowed, message);
}

function assertStatus(current, allowed, message) {
  if (allowed.includes(current)) return;
  throw Object.assign(new Error(message), { statusCode: 409 });
}

async function assertTeknisiAssigned(tx, req, suratId) {
  if (rolePengguna(req) === "admin") return;
  const assigned = await tx.teknisi_surat_tugas.findFirst({
    where: {
      surat_tugas_id: suratId,
      teknisi_id: req.pengguna.id
    }
  });
  if (!assigned) {
    throw Object.assign(new Error("Teknisi hanya bisa mengubah surat tugas yang ditugaskan ke dirinya."), { statusCode: 403 });
  }
}

function bolehLihatSuratTugas(req, item) {
  const role = rolePengguna(req);
  if (["admin", "kepala_teknisi", "warehouse"].includes(role)) return true;
  if (role === "teknisi") {
    return item.teknisi_surat_tugas?.some((teknisi) => teknisi.teknisi_id === req.pengguna.id);
  }
  if (["sales", "sales_admin"].includes(role)) {
    const parent = item.tiket || item.pengaduan;
    if (!parent) return false;
    return parent.sales_id === req.pengguna.id || parent.dibuat_oleh === req.pengguna.id;
  }
  return false;
}

async function catatStatusSurat(tx, req, sebelum, sesudah, aksi, keterangan, dataTambahan = {}) {
  await catatAudit(tx, req, {
    jenis_dokumen: "surat_tugas",
    nomor_dokumen: sesudah.nomor_surat_tugas,
    tabel_sumber: "surat_tugas",
    id_sumber: sesudah.id,
    aksi,
    status_sebelum: sebelum.status,
    status_sesudah: sesudah.status,
    data_sebelum: sebelum,
    data_sesudah: { ...sesudah, ...dataTambahan },
    keterangan
  });
}

function dataSuratTugas(body) {
  const { pic_teknisi_id, ...data } = body;
  if ("tanggal_jadwal" in data) data.tanggal_jadwal = data.tanggal_jadwal ? new Date(data.tanggal_jadwal) : null;
  if ("mulai_kunjungan" in data) data.mulai_kunjungan = data.mulai_kunjungan ? new Date(data.mulai_kunjungan) : null;
  if ("selesai_kunjungan" in data) data.selesai_kunjungan = data.selesai_kunjungan ? new Date(data.selesai_kunjungan) : null;
  return data;
}

async function simpanPicTeknisi(tx, suratId, picTeknisiId) {
  if (!picTeknisiId) return;
  const teknisi = await tx.master_pengguna.findUnique({ where: { id: picTeknisiId } });
  if (!teknisi || teknisi.peran !== "teknisi") {
    throw Object.assign(new Error("PIC harus user dengan role teknisi."), { statusCode: 422 });
  }
  await tx.teknisi_surat_tugas.deleteMany({ where: { surat_tugas_id: suratId, peran: "utama" } });
  await tx.teknisi_surat_tugas.create({
    data: {
      surat_tugas_id: suratId,
      teknisi_id: picTeknisiId,
      peran: "utama"
    }
  });
}

function pekerjaanMemasangPrinter(jenisPekerjaan) {
  return ["installation", "install", "instalasi", "delivery", "replacement", "penggantian"].includes(String(jenisPekerjaan || "").toLowerCase());
}

async function majukanJadwalPrinter(tx, req, surat) {
  if (surat.jenis_pekerjaan !== "maintenance" || !surat.printer_id) return;
  const sebelum = await tx.master_printer.findUnique({ where: { id: surat.printer_id } });
  if (!sebelum?.tanggal_maintenance_berikutnya || !sebelum.interval_maintenance_bulan) return;
  if (surat.tanggal_maintenance_otomatis && tanggalSaja(surat.tanggal_maintenance_otomatis) !== tanggalSaja(sebelum.tanggal_maintenance_berikutnya)) return;
  const berikutnya = jadwalBerikutnya(tanggalSaja(sebelum.tanggal_maintenance_berikutnya), sebelum.interval_maintenance_bulan);
  const sesudah = await tx.master_printer.update({
    where: { id: sebelum.id },
    data: { tanggal_maintenance_berikutnya: berikutnya, tanggal_diperbarui: new Date() }
  });
  await catatAuditBarang(tx, req, {
    jenis_barang: "printer", aksi: "ubah", sebelum, sesudah,
    referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas },
    keterangan: surat.status === "cancelled" ? "Jadwal maintenance berikutnya setelah pembatalan." : "Jadwal maintenance berikutnya setelah pekerjaan selesai."
  });
}

async function catatMaintenancePrinter(tx, req, surat, aksi, dari, ke) {
  if (surat.jenis_pekerjaan !== "maintenance" || !surat.printer_id) return;
  const printer = await tx.master_printer.findUnique({ where: { id: surat.printer_id } });
  if (!printer) return;
  await catatAuditBarang(tx, req, {
    jenis_barang: "printer", aksi,
    sebelum: { ...printer, status_operasional: dari },
    sesudah: { ...printer, status_operasional: ke },
    referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas },
    keterangan: `Status operasional printer berubah dari ${dari} menjadi ${ke}.`
  });
}

async function sinkronPrinterTerpasangDariSurat(tx, req, surat, pemakaian) {
  if (!pekerjaanMemasangPrinter(surat.jenis_pekerjaan)) return [];

  const printerLines = pemakaian.filter((line) => line.jenis_barang === "printer" && line.printer_id);
  const hasil = [];
  const customer = await tx.master_customer.findUnique({ where: { id: surat.customer_id }, select: { nama_customer: true } });

  for (const line of printerLines) {
    const sebelum = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
    const changed = await tx.master_printer.updateMany({
      where: { id: line.printer_id, status: "issued", surat_tugas_aktif_id: surat.id },
      data: {
        account_id: surat.account_id,
        customer_id: surat.customer_id,
        gudang_id: null,
        surat_tugas_aktif_id: null,
        lokasi_detail: customer?.nama_customer || null,
        tanggal_instalasi: surat.selesai_kunjungan || new Date(),
        status: "installed",
        lokasi_jenis: "customer",
        tanggal_diperbarui: new Date()
      }
    });
    if (changed.count !== 1) throw Object.assign(new Error("Unit printer belum divalidasi Warehouse atau sudah dikembalikan."), { statusCode: 409 });

    const printerTerpasang = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
    await catatAuditBarang(tx, req, {
      jenis_barang: "printer", aksi: "pasang_customer", sebelum, sesudah: printerTerpasang,
      referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas },
      keterangan: "Unit printer dipasang di customer."
    });

    await tx.surat_tugas.update({
      where: { id: surat.id },
      data: { printer_id: printerTerpasang.id }
    });

    hasil.push(printerTerpasang);
  }

  return hasil;
}

const penggunaPublik = {
  select: {
    id: true, user_id: true, nama: true, email: true, telepon: true,
    peran: true, aktif: true, tanggal_dibuat: true, tanggal_diperbarui: true
  }
};

const suratTugasInclude = {
  master_account: true,
  master_customer: true,
  master_printer: { include: { master_printer_model: true } },
  pengaduan: true,
  tiket: true,
  master_kontrak_baru: true,
  surat_tugas_printer: { include: { master_printer: true, master_printer_model: true } },
  master_pengguna_surat_tugas_dibuat_olehTomaster_pengguna: penggunaPublik,
  master_pengguna_surat_tugas_disetujui_olehTomaster_pengguna: penggunaPublik,
  master_pengguna_surat_tugas_validasi_warehouse_olehTomaster_pengguna: penggunaPublik,
  master_pengguna_surat_tugas_validasi_kepala_olehTomaster_pengguna: penggunaPublik,
  master_pengguna_pic_warehouse: penggunaPublik,
  teknisi_surat_tugas: {
    include: {
      master_pengguna: penggunaPublik
    }
  },
  pemakaian_barang_surat_tugas: {
    include: {
      master_gudang: true,
      master_printer: { include: { master_printer_model: true } },
      master_toner: true,
      master_suku_cadang: true
    }
  }
};

router.use(autentikasi);

router.get("/", otorisasi("sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const role = rolePengguna(req);
  let where = {};
  if (role === "teknisi") {
    where = { teknisi_surat_tugas: { some: { teknisi_id: req.pengguna.id } } };
  } else if (["sales", "sales_admin"].includes(role)) {
    where = {
      OR: [
        { pengaduan: { is: { OR: [{ sales_id: req.pengguna.id }, { dibuat_oleh: req.pengguna.id }] } } },
        { tiket: { is: { OR: [{ sales_id: req.pengguna.id }, { dibuat_oleh: req.pengguna.id }] } } }
      ]
    };
  }
  const items = await prisma.surat_tugas.findMany({
    where,
    orderBy: { tanggal_dibuat: "desc" },
    take: 100,
    include: suratTugasInclude
  });
  return sukses(res, "Surat tugas berhasil diambil.", items);
}));

router.get("/:id", otorisasi("sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const item = await prisma.surat_tugas.findUnique({
    where: { id: req.params.id },
    include: suratTugasInclude
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  if (!bolehLihatSuratTugas(req, item)) return gagal(res, "Anda tidak memiliki akses ke surat tugas ini.", 403);
  return sukses(res, "Surat tugas berhasil diambil.", {
    ...item,
    teknisi: item.teknisi_surat_tugas,
    pemakaian: item.pemakaian_barang_surat_tugas
  });
}));

router.post("/", otorisasi("kepala-teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["kepala_teknisi"]);
  const body = suratTugasSchema.parse(req.body);
  if (body.status && body.status !== "pending") return gagal(res, "Surat tugas baru harus berstatus pending.", 422);
  if (!body.pic_teknisi_id) {
    return gagal(res, "PIC teknisi wajib diisi.", 422);
  }
  const item = await prisma.$transaction(async (tx) => {
    await pastikanCustomerAccount(tx, body.account_id, body.customer_id);
    if (body.pengaduan_id) {
      const pengaduan = await tx.pengaduan.findUnique({ where: { id: body.pengaduan_id } });
      if (!pengaduan || pengaduan.account_id !== body.account_id || pengaduan.customer_id !== body.customer_id) {
        throw Object.assign(new Error("Account dan Customer harus sesuai dengan komplain terkait."), { statusCode: 422 });
      }
    }
    if (body.printer_id) {
      const printer = await tx.master_printer.findUnique({ where: { id: body.printer_id } });
      if (!printer || printer.status !== "installed" || printer.account_id !== body.account_id || printer.customer_id !== body.customer_id) {
        throw Object.assign(new Error("Pilih printer terpasang milik Customer ini."), { statusCode: 422 });
      }
      body.mp_no = printer.mp_no;
    }
    const surat = await tx.surat_tugas.create({
      data: {
        ...dataSuratTugas(body),
        nomor_surat_tugas: body.nomor_surat_tugas || buatNomor("ST"),
        status: body.status || "pending",
        dibuat_oleh: req.pengguna.id
      }
    });
    await simpanPicTeknisi(tx, surat.id, body.pic_teknisi_id);

    if (surat.pengaduan_id) {
      await tx.pengaduan.update({
        where: { id: surat.pengaduan_id },
        data: { status: "progress" }
      });
    }

    await catatAudit(tx, req, {
      jenis_dokumen: "surat_tugas",
      nomor_dokumen: surat.nomor_surat_tugas,
      tabel_sumber: "surat_tugas",
      id_sumber: surat.id,
      aksi: "buat",
      status_sesudah: surat.status,
      data_sesudah: surat,
      keterangan: "Surat tugas dibuat."
    });

    return surat;
  });
  return sukses(res, "Surat tugas berhasil dibuat.", item, 201);
}));

router.use("/:id", asyncHandler(async (req, res, next) => {
  const surat = await prisma.surat_tugas.findUnique({ where: { id: req.params.id }, select: { jenis_tugas: true, konfirmasi_keluar_pada: true } });
  if (!surat?.jenis_tugas) return next();
  const itemPath = /^\/[^/]+\/pemakaian(?:\/[^/]+)?$/.test(req.path);
  if (!itemPath || !["POST", "DELETE"].includes(req.method)) {
    return gagal(res, "Gunakan alur ST baru untuk jenis pekerjaan ini.", 409);
  }
  if (surat.konfirmasi_keluar_pada) return gagal(res, "Item tidak dapat diubah setelah barang keluar gudang.", 409);
  if (req.method === "POST" && req.body?.jenis_barang === "printer") return gagal(res, "Unit printer dicatat di tab Unit, bukan sebagai item stok.", 422);
  return next();
}));

router.put("/:id", otorisasi("kepala-teknisi", "teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["kepala_teknisi", "teknisi"]);
  const body = suratTugasSchema.partial().parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const sebelum = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!sebelum) return null;
    if (body.status && body.status !== sebelum.status && body.status !== "cancelled") {
      throw Object.assign(new Error("Gunakan aksi workflow untuk mengubah status surat tugas."), { statusCode: 409 });
    }
    if (sebelum.tanggal_maintenance_otomatis && ["account_id", "customer_id", "printer_id", "jenis_pekerjaan", "tanggal_jadwal"].some((key) => body[key] !== undefined && String(body[key]) !== String(sebelum[key] ?? ""))) {
      throw Object.assign(new Error("Relasi dan jadwal surat tugas maintenance otomatis tidak bisa diubah."), { statusCode: 409 });
    }
    const printerItems = await tx.pemakaian_barang_surat_tugas.count({ where: { surat_tugas_id: sebelum.id, jenis_barang: "printer" } });
    if (printerItems && ((body.account_id && body.account_id !== sebelum.account_id) || (body.customer_id && body.customer_id !== sebelum.customer_id))) {
      throw Object.assign(new Error("Account/Customer tidak bisa diganti setelah unit printer ditambahkan."), { statusCode: 409 });
    }
    if (printerItems && body.jenis_pekerjaan && !pekerjaanMemasangPrinter(body.jenis_pekerjaan)) {
      throw Object.assign(new Error("Surat tugas dengan unit printer harus tetap bertipe instalasi, delivery, atau penggantian."), { statusCode: 409 });
    }
    if (rolePengguna(req) !== "admin") {
      delete body.status;
    }
    if (rolePengguna(req) === "teknisi") {
      await assertTeknisiAssigned(tx, req, sebelum.id);
      delete body.pengaduan_id;
      delete body.account_id;
      delete body.customer_id;
      delete body.printer_id;
      delete body.status;
    }
    const accountId = body.account_id || sebelum.account_id;
    const customerId = body.customer_id || sebelum.customer_id;
    await pastikanCustomerAccount(tx, accountId, customerId, accountId !== sebelum.account_id || customerId !== sebelum.customer_id);
    const pengaduanId = body.pengaduan_id === undefined ? sebelum.pengaduan_id : body.pengaduan_id;
    if (pengaduanId) {
      const pengaduan = await tx.pengaduan.findUnique({ where: { id: pengaduanId } });
      if (!pengaduan || pengaduan.account_id !== (body.account_id || sebelum.account_id) || pengaduan.customer_id !== (body.customer_id || sebelum.customer_id)) {
        throw Object.assign(new Error("Account dan Customer harus sesuai dengan komplain terkait."), { statusCode: 422 });
      }
    }
    const targetPrinterId = body.printer_id === undefined ? sebelum.printer_id : body.printer_id;
    if (targetPrinterId) {
      const printer = await tx.master_printer.findUnique({ where: { id: targetPrinterId } });
      if (!printer || printer.status !== "installed" || printer.account_id !== accountId || printer.customer_id !== customerId) {
        throw Object.assign(new Error("Pilih printer terpasang milik Customer ini."), { statusCode: 422 });
      }
      body.mp_no = printer.mp_no;
    }
    if (body.status === "cancelled") {
      if (sebelum.status === "solved") throw Object.assign(new Error("Surat tugas yang selesai tidak bisa dibatalkan."), { statusCode: 409 });
      const issued = await tx.master_printer.count({ where: { surat_tugas_aktif_id: sebelum.id, status: "issued" } });
      if (issued) throw Object.assign(new Error("Kembalikan unit printer ke Gudang sebelum membatalkan surat tugas."), { statusCode: 409 });
      if (["warehouse_validated"].includes(sebelum.status) && await tx.pemakaian_barang_surat_tugas.count({ where: { surat_tugas_id: sebelum.id, jenis_barang: { not: "printer" } } })) {
        throw Object.assign(new Error("Barang toner/sparepart yang sudah diposting harus diretur sebelum surat tugas dibatalkan."), { statusCode: 409 });
      }
      const reserved = await tx.master_printer.findMany({ where: { surat_tugas_aktif_id: sebelum.id, status: "reserved" } });
      await tx.master_printer.updateMany({
        where: { surat_tugas_aktif_id: sebelum.id, status: "reserved" },
        data: { status: "available", surat_tugas_aktif_id: null, tanggal_diperbarui: new Date() }
      });
      for (const unit of reserved) {
        const released = await tx.master_printer.findUnique({ where: { id: unit.id } });
        await catatAuditBarang(tx, req, {
          jenis_barang: "printer", aksi: "lepas_reservasi", sebelum: unit, sesudah: released,
          referensi: { jenis: "surat_tugas", id: sebelum.id, nomor: sebelum.nomor_surat_tugas },
          keterangan: "Reservasi unit dilepas karena surat tugas dibatalkan."
        });
      }
    }

    const sesudah = await tx.surat_tugas.update({
      where: { id: req.params.id },
      data: dataSuratTugas(body)
    });
    await simpanPicTeknisi(tx, sesudah.id, body.pic_teknisi_id);
    if (sesudah.status === "cancelled" && sebelum.status !== "cancelled" && sesudah.tanggal_maintenance_otomatis) {
      await majukanJadwalPrinter(tx, req, sesudah);
    }
    if (sesudah.status === "cancelled" && ["progress", "ready_to_print", "technician_completed", "warehouse_validated"].includes(sebelum.status)) {
      await catatMaintenancePrinter(tx, req, sesudah, "maintenance_dibatalkan", "Sedang Maintenance", "Di Customer");
    }

    await catatAudit(tx, req, {
      jenis_dokumen: "surat_tugas",
      nomor_dokumen: sesudah.nomor_surat_tugas,
      tabel_sumber: "surat_tugas",
      id_sumber: sesudah.id,
      aksi: aksiDariStatus(sebelum, sesudah),
      status_sebelum: sebelum.status,
      status_sesudah: sesudah.status,
      data_sebelum: sebelum,
      data_sesudah: sesudah,
      keterangan: "Surat tugas diperbarui."
    });

    return sesudah;
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Surat tugas berhasil diperbarui.", item);
}));

router.post("/:id/teknisi", otorisasi("kepala-teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["kepala_teknisi"]);
  const body = teknisiSchema.parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const surat = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!surat) return null;
    const teknisi = await tx.master_pengguna.findUnique({ where: { id: body.teknisi_id } });
    if (!teknisi || teknisi.peran !== "teknisi") {
      throw Object.assign(new Error("PIC harus user dengan role teknisi."), { statusCode: 422 });
    }

    const assigned = await tx.teknisi_surat_tugas.create({
      data: {
        surat_tugas_id: req.params.id,
        teknisi_id: body.teknisi_id,
        peran: body.peran || "utama"
      }
    });

    await catatStatusSurat(tx, req, surat, surat, "assign_teknisi", "Teknisi ditugaskan.", { teknisi_id: body.teknisi_id });

    return assigned;
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Teknisi surat tugas berhasil ditambahkan.", item, 201);
}));

router.post("/:id/start", otorisasi("kepala-teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["kepala_teknisi"]);
  const item = await prisma.$transaction(async (tx) => {
    const sebelum = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!sebelum) return null;
    assertStatus(sebelum.status, ["pending"], "Surat tugas hanya bisa dimulai dari status pending.");
    const assigned = await tx.teknisi_surat_tugas.count({ where: { surat_tugas_id: sebelum.id, peran: "utama" } });
    if (!assigned) throw Object.assign(new Error("Assign PIC teknisi sebelum memulai surat tugas."), { statusCode: 409 });

    const sesudah = await tx.surat_tugas.update({
      where: { id: sebelum.id },
      data: { status: "progress" }
    });

    await catatMaintenancePrinter(tx, req, sesudah, "maintenance_mulai", "Di Customer", "Sedang Maintenance");
    await catatStatusSurat(tx, req, sebelum, sesudah, "start", "Kepala teknisi memulai surat tugas.");
    return sesudah;
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Surat tugas dimulai.", item);
}));

router.post("/:id/pemakaian", otorisasi("teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["teknisi"]);
  const body = pemakaianSchema.parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const surat = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!surat) return null;
    await assertTeknisiAssigned(tx, req, surat.id);
    assertStatus(surat.status, ["progress", "ready_to_print"], "Item hanya bisa ditambahkan saat surat tugas progress atau ready_to_print.");

    if (body.jenis_barang === "printer") {
      if (!pekerjaanMemasangPrinter(surat.jenis_pekerjaan)) {
        throw Object.assign(new Error("Unit printer gudang hanya bisa dibawa untuk instalasi, delivery, atau penggantian."), { statusCode: 422 });
      }
      if (!body.printer_id || body.jumlah_pakai !== 1) {
        throw Object.assign(new Error("Pilih satu unit printer (kuantitas 1)."), { statusCode: 422 });
      }
      const printer = await tx.master_printer.findUnique({ where: { id: body.printer_id } });
      if (!printer || printer.status !== "available" || printer.lokasi_jenis !== "gudang" || printer.kondisi !== "ready" || printer.gudang_id !== body.gudang_id) {
        throw Object.assign(new Error("Unit printer tidak tersedia di Gudang yang dipilih."), { statusCode: 409 });
      }
      if (body.serial_number && body.serial_number !== printer.serial_number) {
        throw Object.assign(new Error("Serial Number harus sesuai dengan unit printer."), { statusCode: 422 });
      }
      const claimed = await tx.master_printer.updateMany({
        where: { id: printer.id, status: "available", gudang_id: body.gudang_id },
        data: { status: "reserved", surat_tugas_aktif_id: surat.id, tanggal_diperbarui: new Date() }
      });
      if (claimed.count !== 1) throw Object.assign(new Error("Unit printer sudah direservasi."), { statusCode: 409 });
      const reserved = await tx.master_printer.findUnique({ where: { id: printer.id } });
      await catatAuditBarang(tx, req, {
        jenis_barang: "printer", aksi: "reservasi", sebelum: printer, sesudah: reserved,
        referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas },
        keterangan: "Unit printer direservasi untuk surat tugas."
      });
      body.serial_number = printer.serial_number;
    }

    const pemakaian = await tx.pemakaian_barang_surat_tugas.create({
      data: {
        surat_tugas_id: req.params.id,
        ...body
      }
    });

    await catatAudit(tx, req, {
      jenis_dokumen: "surat_tugas",
      nomor_dokumen: surat.nomor_surat_tugas,
      tabel_sumber: "pemakaian_barang_surat_tugas",
      id_sumber: pemakaian.id,
      aksi: "tambah_item",
      status_sesudah: surat.status,
      data_sesudah: pemakaian,
      keterangan: "Item surat tugas ditambahkan."
    });

    return pemakaian;
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Pemakaian barang berhasil ditambahkan.", item, 201);
}));

router.delete("/:id/pemakaian/:pemakaianId", otorisasi("teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["teknisi"]);
  const item = await prisma.$transaction(async (tx) => {
    const surat = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!surat) return null;
    await assertTeknisiAssigned(tx, req, surat.id);
    assertStatus(surat.status, ["progress", "ready_to_print"], "Item hanya bisa dihapus saat surat tugas progress atau ready_to_print.");

    const pemakaian = await tx.pemakaian_barang_surat_tugas.findFirst({
      where: {
        id: req.params.pemakaianId,
        surat_tugas_id: surat.id
      }
    });
    if (!pemakaian) {
      throw Object.assign(new Error("Item surat tugas tidak ditemukan."), { statusCode: 404 });
    }

    if (pemakaian.jenis_barang === "printer") {
      const sebelum = await tx.master_printer.findUnique({ where: { id: pemakaian.printer_id } });
      const released = await tx.master_printer.updateMany({
        where: { id: pemakaian.printer_id, status: "reserved", surat_tugas_aktif_id: surat.id },
        data: { status: "available", surat_tugas_aktif_id: null, tanggal_diperbarui: new Date() }
      });
      if (released.count !== 1) throw Object.assign(new Error("Unit printer tidak bisa dilepas dari surat tugas ini."), { statusCode: 409 });
      const sesudah = await tx.master_printer.findUnique({ where: { id: pemakaian.printer_id } });
      await catatAuditBarang(tx, req, {
        jenis_barang: "printer", aksi: "lepas_reservasi", sebelum, sesudah,
        referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas },
        keterangan: "Item printer dihapus dari surat tugas."
      });
    }

    await tx.pemakaian_barang_surat_tugas.delete({ where: { id: pemakaian.id } });

    await catatAudit(tx, req, {
      jenis_dokumen: "surat_tugas",
      nomor_dokumen: surat.nomor_surat_tugas,
      tabel_sumber: "pemakaian_barang_surat_tugas",
      id_sumber: pemakaian.id,
      aksi: "hapus_item",
      status_sebelum: surat.status,
      status_sesudah: surat.status,
      data_sebelum: pemakaian,
      keterangan: "Item surat tugas dihapus."
    });

    return pemakaian;
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Item surat tugas berhasil dihapus.", item);
}));

router.post("/:id/ready-to-print", otorisasi("teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["teknisi"]);
  const item = await prisma.$transaction(async (tx) => {
    const sebelum = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!sebelum) return null;
    await assertTeknisiAssigned(tx, req, sebelum.id);
    assertStatus(sebelum.status, ["progress"], "Surat tugas harus progress sebelum Ready to Print.");

    const sesudah = await tx.surat_tugas.update({
      where: { id: req.params.id },
      data: { status: "ready_to_print" }
    });

    await catatStatusSurat(tx, req, sebelum, sesudah, "ready_to_print", "Surat tugas siap dicetak.");

    return sesudah;
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Surat tugas siap dicetak.", item);
}));

router.post("/:id/selesai-teknisi", otorisasi("teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["teknisi"]);
  const item = await prisma.$transaction(async (tx) => {
    const sebelum = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!sebelum) return null;
    await assertTeknisiAssigned(tx, req, sebelum.id);
    assertStatus(sebelum.status, ["ready_to_print"], "Surat tugas harus ready_to_print sebelum diselesaikan teknisi.");

    const sesudah = await tx.surat_tugas.update({
      where: { id: req.params.id },
      data: {
        status: "technician_completed",
        selesai_kunjungan: req.body?.selesai_kunjungan ? new Date(req.body.selesai_kunjungan) : new Date(),
        hasil: req.body?.hasil || sebelum.hasil
      }
    });

    await catatStatusSurat(tx, req, sebelum, sesudah, "selesai_teknisi", "Teknisi menyelesaikan pekerjaan lapangan.");

    return sesudah;
  });
  if (!item) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Surat tugas selesai oleh teknisi.", item);
}));

router.post("/:id/validasi-warehouse", otorisasi("warehouse"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["warehouse"]);
  const hasil = await prisma.$transaction(async (tx) => {
    const surat = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!surat) return null;
    assertStatus(surat.status, ["technician_completed"], "Warehouse hanya bisa validasi surat tugas yang sudah technician_completed.");

    const pemakaian = await tx.pemakaian_barang_surat_tugas.findMany({
      where: { surat_tugas_id: surat.id }
    });
    if (!pemakaian.length) {
      throw Object.assign(new Error("Warehouse hanya validasi surat tugas yang memiliki item/barang."), { statusCode: 409 });
    }

    const claimed = await tx.surat_tugas.updateMany({
      where: { id: surat.id, status: "technician_completed" },
      data: {
        status: "warehouse_validated",
        validasi_warehouse_oleh: req.pengguna.id,
        validasi_warehouse_pada: new Date()
      }
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("Surat tugas sudah divalidasi Warehouse."), { statusCode: 409 });
    }

    const mutasi = await tx.mutasi_stok.create({
      data: {
        nomor_mutasi: buatNomor("PMK"),
        jenis_mutasi: "pemakaian",
        gudang_asal_id: pemakaian[0]?.gudang_id || null,
        jenis_referensi: "surat_tugas",
        referensi_id: surat.id,
        status: "terposting",
        keterangan: `Pemakaian barang surat tugas ${surat.nomor_surat_tugas}`,
        dibuat_oleh: req.pengguna.id,
        tanggal_terposting: new Date()
      }
    });

    for (const line of pemakaian) {
      const itemId = line.toner_id || line.printer_id || line.suku_cadang_id;
      if (line.jenis_barang === "printer") {
        const sebelum = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
        const issued = await tx.master_printer.updateMany({
          where: { id: line.printer_id, status: "reserved", surat_tugas_aktif_id: surat.id, gudang_id: line.gudang_id },
        data: { status: "issued", lokasi_jenis: "transit", tanggal_diperbarui: new Date() }
        });
        if (issued.count !== 1) throw Object.assign(new Error("Unit printer tidak lagi tersedia untuk surat tugas ini."), { statusCode: 409 });
        const sesudah = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
        await catatAuditBarang(tx, req, {
          jenis_barang: "printer", aksi: "keluar_gudang", sebelum, sesudah,
          referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas, mutasi_stok_id: mutasi.id },
          keterangan: "Unit printer dikeluarkan setelah validasi Warehouse."
        });
      } else {
        await kurangiStok(tx, line.jenis_barang, line.gudang_id, itemId, line.jumlah_pakai);
        const stockModel = line.jenis_barang === "toner" ? "stok_toner" : "stok_suku_cadang";
        const itemModel = line.jenis_barang === "toner" ? "master_toner" : "master_suku_cadang";
        const itemField = line.jenis_barang === "toner" ? "toner_id" : "suku_cadang_id";
        const [master, stock, gudang] = await Promise.all([
          tx[itemModel].findUnique({ where: { id: itemId } }),
          tx[stockModel].findFirst({ where: { gudang_id: line.gudang_id, [itemField]: itemId } }),
          tx.master_gudang.findUnique({ where: { id: line.gudang_id }, select: { nama_gudang: true } })
        ]);
        const saldoSesudah = Number(stock.jumlah_tersedia);
        const jumlah = Number(line.jumlah_pakai);
        const lokasi = { gudang_id: line.gudang_id, nama_gudang: gudang?.nama_gudang || null };
        await catatAuditBarang(tx, req, {
          jenis_barang: line.jenis_barang, aksi: "pemakaian",
          sebelum: { ...master, stok: [{ ...lokasi, jumlah_tersedia: saldoSesudah + jumlah }] },
          sesudah: { ...master, stok: [{ ...lokasi, jumlah_tersedia: saldoSesudah }] },
          perubahan: { jenis_mutasi: "pemakaian", jumlah, gudang_asal_id: line.gudang_id, gudang_tujuan_id: null },
          referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas, mutasi_stok_id: mutasi.id },
          keterangan: line.keterangan || "Barang dipakai pada surat tugas."
        });
      }
      await tx.detail_mutasi_stok.create({
        data: {
          mutasi_stok_id: mutasi.id,
          jenis_barang: line.jenis_barang,
          toner_id: line.toner_id,
          printer_id: line.printer_id,
          suku_cadang_id: line.suku_cadang_id,
          jumlah: line.jumlah_pakai,
          keterangan: line.keterangan
        }
      });
    }

    const sesudah = await tx.surat_tugas.findUnique({ where: { id: surat.id } });

    await catatStatusSurat(tx, req, { ...surat, pemakaian }, sesudah, "validasi_warehouse", "Warehouse validasi barang dan stok pemakaian diposting.", { pemakaian, mutasi_stok_id: mutasi.id });

    return sesudah;
  });

  if (!hasil) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Surat tugas berhasil divalidasi warehouse dan stok sudah dikurangi.", hasil);
}));

router.post("/:id/resolve", otorisasi("kepala-teknisi"), asyncHandler(async (req, res) => {
  hanyaRole(req, ["kepala_teknisi"]);
  const hasil = await prisma.$transaction(async (tx) => {
    const sebelum = await tx.surat_tugas.findUnique({ where: { id: req.params.id } });
    if (!sebelum) return null;

    const pemakaian = await tx.pemakaian_barang_surat_tugas.findMany({
      where: { surat_tugas_id: sebelum.id }
    });

    if (pemakaian.length) {
      assertStatus(sebelum.status, ["warehouse_validated"], "Surat tugas dengan item harus warehouse_validated sebelum solved.");
    } else {
      assertStatus(sebelum.status, ["technician_completed"], "Surat tugas tanpa item harus technician_completed sebelum solved.");
    }

    const sesudah = await tx.surat_tugas.update({
      where: { id: sebelum.id },
      data: {
        status: "solved",
        validasi_kepala_teknisi_oleh: req.pengguna.id,
        validasi_kepala_teknisi_pada: new Date(),
        disetujui_oleh: req.pengguna.id,
        disetujui_pada: new Date()
      }
    });

    const printerTerpasang = await sinkronPrinterTerpasangDariSurat(tx, req, sesudah, pemakaian);
    await catatMaintenancePrinter(tx, req, sesudah, "maintenance_selesai", "Sedang Maintenance", "Di Customer");
    await majukanJadwalPrinter(tx, req, sesudah);

    await catatStatusSurat(tx, req, { ...sebelum, pemakaian }, sesudah, "resolve", "Surat tugas diselesaikan kepala teknisi.", { pemakaian, printer_terpasang: printerTerpasang });

    return {
      ...sesudah,
      printer_terpasang: printerTerpasang
    };
  });

  if (!hasil) return gagal(res, "Surat tugas tidak ditemukan.", 404);
  return sukses(res, "Surat tugas berhasil diselesaikan.", hasil);
}));

router.post("/:id/ajukan", otorisasi("teknisi", "kepala-teknisi"), asyncHandler(async (req, res) => {
  req.url = `/${req.params.id}/ready-to-print`;
  return gagal(res, "Endpoint ajukan sudah diganti menjadi /ready-to-print.", 410);
}));

router.post("/:id/setujui", otorisasi("warehouse"), asyncHandler(async (req, res) => {
  return gagal(res, "Endpoint setujui sudah diganti menjadi /validasi-warehouse.", 410);
}));

module.exports = router;
