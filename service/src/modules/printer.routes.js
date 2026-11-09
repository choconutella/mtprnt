const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses, gagal } = require("../utils/response");
const { autentikasi, izin, otorisasi } = require("../middlewares/auth");
const { buatCrudRouter } = require("./crud");
const { buatNomor } = require("../utils/nomor");
const { catatAuditBarang } = require("./audit-barang.service");
const { tanggalBangkok, tambahBulan } = require("./printer-maintenance.service");

const kategoriSchema = z.object({
  kode_kategori: z.string().trim().min(1).max(50),
  nama_kategori: z.string().trim().min(1).max(150),
  aktif: z.boolean().optional()
});
const modelSchema = z.object({
  kategori_id: z.string().uuid(),
  kode_model: z.string().trim().min(1).max(50),
  merek: z.string().trim().min(1).max(100),
  nama_model: z.string().trim().min(1).max(150),
  aktif: z.boolean().optional()
});
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Tanggal tidak valid.").nullable().optional();
const unitSchema = z.object({
  mp_no: z.string().trim().min(1).max(150),
  serial_number: z.string().trim().max(150).optional().nullable(),
  model_id: z.string().uuid(),
  gudang_id: z.string().uuid(),
  tanggal_pembelian: dateOnly,
  tanggal_maintenance_berikutnya: dateOnly,
  interval_maintenance_bulan: z.number().int().min(1).max(120).nullable().optional(),
  keterangan: z.string().optional().nullable()
});
const listSchema = z.object({
  halaman: z.coerce.number().int().min(1).default(1),
  batas: z.coerce.number().int().min(1).max(100).default(20),
  cari: z.string().optional(),
  kategori_id: z.string().uuid().optional(),
  model_id: z.string().uuid().optional(),
  status: z.enum(["available", "reserved", "issued", "installed", "inactive"]).optional(),
  lokasi: z.enum(["stok", "gudang", "customer", "transit"]).optional(),
  gudang_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional()
});
const include = {
  master_printer_model: { include: { master_printer_kategori: true } },
  master_gudang: true,
  master_account: true,
  master_customer: true,
  surat_tugas: {
    where: { jenis_pekerjaan: "maintenance", status: { in: ["progress", "technician_completed", "warehouse_validated"] } },
    select: { id: true },
    take: 1
  }
};

function formatUnit(item) {
  if (!item) return item;
  const status_operasional = item.kondisi === "in_repair" || item.surat_tugas?.length ? "Sedang Maintenance" :
    item.lokasi_jenis === "customer" ? `${item.master_customer?.nama_customer ? ` ${item.master_customer.nama_customer}` : ""}` :
    item.lokasi_jenis === "gudang" ? "Gudang" :
    item.lokasi_jenis === "transit" ? "Dalam Surat Tugas" :
    item.lokasi_jenis === "internal" ? "Internal" : "Nonaktif";
  const { surat_tugas, ...unit } = item;
  return {
    ...unit,
    model_id: item.master_printer_model?.id || item.model_id,
    gudang_id: item.master_gudang?.id || item.gudang_id,
    account_id: item.master_account?.id || item.account_id,
    customer_id: item.master_customer?.id || item.customer_id,
    kontrak_id: item.master_kontrak?.id || item.kontrak_id,
    status_operasional
  };
}

function konflik(pesan) {
  return Object.assign(new Error(pesan), { statusCode: 409 });
}

function cekJadwalMaintenance(data) {
  if (data.tanggal_maintenance_berikutnya && !data.interval_maintenance_bulan) throw Object.assign(new Error("Tanggal maintenance membutuhkan interval bulan."), { statusCode: 422 });
}

function dataUnit(body) {
  return {
    ...body,
    ...("tanggal_pembelian" in body ? { tanggal_pembelian: body.tanggal_pembelian ? new Date(`${body.tanggal_pembelian}T00:00:00.000Z`) : null } : {}),
    ...("tanggal_maintenance_berikutnya" in body ? { tanggal_maintenance_berikutnya: body.tanggal_maintenance_berikutnya ? new Date(`${body.tanggal_maintenance_berikutnya}T00:00:00.000Z`) : null } : {})
  };
}

async function jadwalDariInterval(tx, body, mpNo) {
  const data = { ...body };
  const last = data.interval_maintenance_bulan ? await tx.surat_tugas.findFirst({
    where: { mp_no: mpNo, jenis_tugas: "maintenance", status: "solved" },
    orderBy: { validasi_kepala_teknisi_pada: "desc" },
    select: { validasi_kepala_teknisi_pada: true, tanggal_diperbarui: true }
  }) : null;
  const completedAt = last?.validasi_kepala_teknisi_pada || last?.tanggal_diperbarui;
  data.tanggal_maintenance_berikutnya = completedAt
    ? tambahBulan(tanggalBangkok(completedAt), data.interval_maintenance_bulan)
    : null;
  return data;
}

async function cekModel(modelId) {
  const model = await prisma.master_printer_model.findUnique({
    where: { id: modelId }, include: { master_printer_kategori: true }
  });
  if (!model?.aktif || !model.master_printer_kategori.aktif) {
    throw Object.assign(new Error("Pilih Model dan Kategori printer aktif."), { statusCode: 422 });
  }
  return model;
}

async function cekKategori(kategoriId) {
  const kategori = await prisma.master_printer_kategori.findUnique({ where: { id: kategoriId } });
  if (!kategori?.aktif) throw Object.assign(new Error("Pilih Kategori printer aktif."), { statusCode: 422 });
  return kategori;
}

const kategori = buatCrudRouter({
  model: "master_printer_kategori",
  kolomCari: ["kode_kategori", "nama_kategori"],
  skemaBuat: kategoriSchema,
  skemaUbah: kategoriSchema.partial(),
  hardDelete: true,
  relationChecks: [{ model: "master_printer_model", field: "kategori_id", label: "Model Printer" }],
  roleLihat: ["admin", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"],
  staticRoleView: true
});

const model = buatCrudRouter({
  model: "master_printer_model",
  businessKey: "kode_model",
  kolomCari: ["kode_model", "merek", "nama_model"],
  skemaBuat: modelSchema,
  skemaUbah: modelSchema.partial(),
  hardDelete: true,
  relationChecks: [{ model: "master_printer", field: "model_id", label: "Unit Printer" }],
  listInclude: { master_printer_kategori: true },
  roleLihat: ["admin", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"],
  staticRoleView: true,
  beforeCreate: async (data) => {
    const kategori = await cekKategori(data.kategori_id);
    data.kategori_id = kategori.kode_kategori;
  },
  beforeUpdate: async (data, req, existing) => {
    if (!data.kategori_id) return;
    const kategori = await cekKategori(data.kategori_id);
    data.kategori_id = kategori.kode_kategori;
    if (data.kategori_id !== existing.kategori_id && await prisma.master_printer.count({ where: { model_id: existing.kode_model } })) {
      throw konflik("Kategori Model yang sudah dipakai unit printer tidak bisa diubah.");
    }
  }
});

const unit = express.Router();
unit.use(autentikasi);
const lihat = otorisasi("sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse");

async function daftar(req, res, fixedStatus) {
  const query = listSchema.parse(req.query);
  const [kategori, model, gudang, account, customer] = await Promise.all([
    query.kategori_id ? prisma.master_printer_kategori.findUnique({ where: { id: query.kategori_id }, select: { kode_kategori: true } }) : null,
    query.model_id ? prisma.master_printer_model.findUnique({ where: { id: query.model_id }, select: { kode_model: true } }) : null,
    query.gudang_id ? prisma.master_gudang.findUnique({ where: { id: query.gudang_id }, select: { kode_gudang: true } }) : null,
    query.account_id ? prisma.master_account.findUnique({ where: { id: query.account_id }, select: { kode_account: true } }) : null,
    query.customer_id ? prisma.master_customer.findUnique({ where: { id: query.customer_id }, select: { kode_customer: true } }) : null
  ]);
  const missingReference = [
    [query.kategori_id, kategori],
    [query.model_id, model],
    [query.gudang_id, gudang],
    [query.account_id, account],
    [query.customer_id, customer]
  ].some(([requested, resolved]) => requested && !resolved);
  if (missingReference) {
    return sukses(res, "Printer berhasil diambil.", { items: [], meta: { halaman: query.halaman, batas: query.batas, total: 0 } });
  }
  const where = {
    ...(fixedStatus || query.status ? { status: fixedStatus || query.status } : {}),
    ...(query.lokasi && query.lokasi !== "stok" ? { lokasi_jenis: query.lokasi } : {}),
    ...(model ? { model_id: model.kode_model } : {}),
    ...(kategori ? { master_printer_model: { kategori_id: kategori.kode_kategori } } : {}),
    ...(gudang ? { gudang_id: gudang.kode_gudang } : {}),
    ...(account ? { account_id: account.kode_account } : {}),
    ...(customer ? { customer_id: customer.kode_customer } : {})
  };
  if (query.cari) {
    where.OR = ["mp_no", "serial_number"].map((key) => ({ [key]: { contains: query.cari, mode: "insensitive" } }));
    where.OR.push({ master_printer_model: { nama_model: { contains: query.cari, mode: "insensitive" } } });
  }
  const [total, items] = await Promise.all([
    prisma.master_printer.count({ where }),
    prisma.master_printer.findMany({ where, include, orderBy: { tanggal_dibuat: "desc" }, skip: (query.halaman - 1) * query.batas, take: query.batas })
  ]);
  return sukses(res, "Printer berhasil diambil.", { items: items.map(formatUnit), meta: { halaman: query.halaman, batas: query.batas, total } });
}

unit.get("/summary", lihat, asyncHandler(async (req, res) => {
  const [available, reserved, issued, installed] = await Promise.all(
    [
      { lokasi_jenis: "gudang", kondisi: "ready", status: "available" },
      { lokasi_jenis: "gudang", status: "reserved" },
      { lokasi_jenis: "transit" },
      { lokasi_jenis: "customer", penempatan: { not: "sold" } }
    ].map((where) => prisma.master_printer.count({ where }))
  );
  return sukses(res, "Ringkasan printer berhasil diambil.", { available, reserved, issued, installed });
}));
unit.get("/", lihat, asyncHandler((req, res) => daftar(req, res)));
unit.get("/:id", lihat, asyncHandler(async (req, res) => {
  const item = await prisma.master_printer.findUnique({ where: { id: req.params.id }, include });
  if (!item) return gagal(res, "Printer tidak ditemukan.", 404);
  return sukses(res, "Printer berhasil diambil.", formatUnit(item));
}));
unit.post("/", izin("master_data", "create", "admin"), asyncHandler(async (req, res) => {
  const body = unitSchema.parse(req.body);
  const model = await cekModel(body.model_id);
  const gudang = await prisma.master_gudang.findUnique({ where: { id: body.gudang_id } });
  if (!gudang?.aktif) return gagal(res, "Pilih Gudang aktif.", 422);
  const item = await prisma.$transaction(async (tx) => {
    const input = { ...body, model_id: model.kode_model, gudang_id: gudang.kode_gudang };
    const created = await tx.master_printer.create({ data: { ...dataUnit(await jadwalDariInterval(tx, input, body.mp_no)), serial_number: body.serial_number || null, status: "available" }, include });
    await catatAuditBarang(tx, req, { jenis_barang: "printer", aksi: "buat", sesudah: created, keterangan: "Unit printer dibuat di gudang." });
    return created;
  });
  return sukses(res, "Unit printer berhasil dibuat.", item, 201);
}));
unit.put("/:id", izin("master_data", "update", "admin"), asyncHandler(async (req, res) => {
  const body = unitSchema.pick({ mp_no: true, serial_number: true, model_id: true, tanggal_pembelian: true, tanggal_maintenance_berikutnya: true, interval_maintenance_bulan: true, keterangan: true }).partial().parse(req.body);
  const model = body.model_id ? await cekModel(body.model_id) : null;
  if (body.serial_number === "") body.serial_number = null;
  const item = await prisma.$transaction(async (tx) => {
    const sebelum = await tx.master_printer.findUnique({ where: { id: req.params.id } });
    if (!sebelum) return null;
    const changes = await jadwalDariInterval(tx, { ...body, ...(model ? { model_id: model.kode_model } : {}), interval_maintenance_bulan: body.interval_maintenance_bulan === undefined ? sebelum.interval_maintenance_bulan : body.interval_maintenance_bulan }, sebelum.mp_no);
    cekJadwalMaintenance({ ...sebelum, ...changes });
    const sesudah = await tx.master_printer.update({ where: { id: req.params.id }, data: { ...dataUnit(changes), tanggal_diperbarui: new Date() }, include });
    await catatAuditBarang(tx, req, { jenis_barang: "printer", aksi: "ubah", sebelum, sesudah, keterangan: "Data unit printer diperbarui." });
    return sesudah;
  });
  if (!item) return gagal(res, "Printer tidak ditemukan.", 404);
  return sukses(res, "Printer berhasil diperbarui.", item);
}));

async function ubahLokasi(req, res, kind) {
  const body = z.object({ gudang_id: kind === "withdraw" ? z.string().uuid().optional() : z.string().uuid(), alasan: z.string().trim().min(1) }).parse(req.body);
  if (kind !== "withdraw") {
    const gudang = await prisma.master_gudang.findUnique({ where: { id: body.gudang_id } });
    if (!gudang?.aktif) return gagal(res, "Pilih Gudang aktif.", 422);
  }
  const item = await prisma.$transaction(async (tx) => {
    const current = await tx.master_printer.findUnique({ where: { id: req.params.id } });
    if (!current) return null;
    const expected = kind === "return" ? "issued" : "available";
    if (current.status !== expected) throw konflik(`Aksi hanya tersedia saat status ${expected}.`);
    if (kind !== "return" && current.lokasi_jenis !== "gudang") throw konflik("Unit harus berada di gudang.");
    if (kind === "return" && current.lokasi_jenis !== "transit") throw konflik("Hanya unit dalam pengiriman yang dapat dikembalikan.");
    if (kind === "transfer" && current.gudang_id === body.gudang_id) throw konflik("Gudang tujuan harus berbeda.");
    if (kind === "return" && current.surat_tugas_aktif_id) {
      const surat = await tx.surat_tugas.findUnique({ where: { id: current.surat_tugas_aktif_id } });
      if (surat?.status === "solved") throw konflik("Printer dari surat tugas selesai tidak bisa dikembalikan lewat aksi ini.");
    }
    const targetGudang = body.gudang_id ? await tx.master_gudang.findUnique({ where: { id: body.gudang_id } }) : null;
    const next = await tx.master_printer.updateMany({
      where: { id: current.id, status: expected },
      data: kind === "withdraw"
        ? { status: "inactive", lokasi_jenis: "keluar", keterangan: body.alasan, tanggal_diperbarui: new Date() }
        : { status: "available", lokasi_jenis: "gudang", gudang_id: targetGudang?.kode_gudang, surat_tugas_aktif_id: null, keterangan: body.alasan, tanggal_diperbarui: new Date() }
    });
    if (next.count !== 1) throw konflik("Status printer sudah berubah.");
    const mutasi = await tx.mutasi_stok.create({ data: {
      nomor_mutasi: buatNomor("MTP"),
      jenis_mutasi: kind === "transfer" ? "transfer" : kind === "return" ? "masuk" : "keluar",
      gudang_asal_id: current.gudang_id,
      gudang_tujuan_id: kind === "withdraw" ? null : targetGudang?.kode_gudang,
      jenis_referensi: "printer_unit",
      referensi_id: current.id,
      status: "terposting",
      keterangan: body.alasan,
      dibuat_oleh: req.pengguna.user_id,
      tanggal_terposting: new Date()
    } });
    await tx.detail_mutasi_stok.create({ data: { mutasi_stok_id: mutasi.id, jenis_barang: "printer", printer_id: current.mp_no, jumlah: 1, keterangan: body.alasan } });
    const sesudah = await tx.master_printer.findUnique({ where: { id: current.id }, include });
    await catatAuditBarang(tx, req, {
      jenis_barang: "printer",
      aksi: kind === "transfer" ? "pindah_gudang" : kind === "return" ? "retur_gudang" : "keluarkan",
      sebelum: current,
      sesudah,
      referensi: { jenis: "mutasi_stok", id: mutasi.id, nomor: mutasi.nomor_mutasi },
      perubahan: { gudang_asal_id: current.gudang_id, gudang_tujuan_id: kind === "withdraw" ? null : targetGudang?.kode_gudang, jumlah: 1 },
      keterangan: body.alasan
    });
    return sesudah;
  });
  if (!item) return gagal(res, "Printer tidak ditemukan.", 404);
  return sukses(res, "Lokasi printer berhasil diperbarui.", item);
}

unit.post("/:id/transfer", izin("stock_data", "workflow", "warehouse"), asyncHandler((req, res) => ubahLokasi(req, res, "transfer")));
unit.post("/:id/withdraw", izin("stock_data", "workflow", "warehouse"), asyncHandler((req, res) => ubahLokasi(req, res, "withdraw")));
unit.post("/:id/return", izin("stock_data", "workflow", "warehouse"), asyncHandler((req, res) => ubahLokasi(req, res, "return")));
unit.delete("/:id", izin("master_data", "delete", "admin"), asyncHandler((req, res) => ubahLokasi(req, res, "withdraw")));

const installed = express.Router();
installed.use(autentikasi);
installed.get("/", lihat, asyncHandler((req, res) => daftar(req, res, "installed")));
installed.get("/:id", lihat, asyncHandler(async (req, res) => {
  const item = await prisma.master_printer.findFirst({ where: { id: req.params.id, status: "installed" }, include });
  if (!item) return gagal(res, "Printer terpasang tidak ditemukan.", 404);
  return sukses(res, "Printer terpasang berhasil diambil.", formatUnit(item));
}));

module.exports = { kategori, model, unit, installed };
