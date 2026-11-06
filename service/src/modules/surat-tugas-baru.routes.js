const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses, gagal } = require("../utils/response");
const { buatNomor } = require("../utils/nomor");
const { autentikasi, izin } = require("../middlewares/auth");
const { normalisasiRole } = require("../utils/roles");
const { catatAudit } = require("./audit.service");
const { catatAuditBarang } = require("./audit-barang.service");
const { pastikanCustomerAccount } = require("./account.service");
const { terapkanMutasi } = require("./stok.service");
const { jadwalBerikutnya, tanggalSaja } = require("./printer-maintenance.service");
const { JENIS_ST, PENGIRIMAN_PRINTER, PENERIMAAN_PRINTER, HASIL_KONDISI, kategoriUntukJenisSt, jenisStDiizinkan } = require("./tiket.catalog");

const router = express.Router();
router.use(autentikasi);

const assetSchema = z.object({
  printer_id: z.string().uuid().optional().nullable(),
  mp_no: z.string().trim().min(1),
  model_id: z.string().uuid().optional().nullable(),
  serial_number: z.string().trim().optional().nullable(),
  sumber: z.string().trim().optional().nullable(),
  peran: z.enum(["utama", "pengganti", "unit_lama"]).default("utama")
});
const createSchema = z.object({
  tiket_id: z.string().uuid().optional().nullable(),
  jenis_tugas: z.enum(JENIS_ST),
  mode: z.enum(["baru", "tukar", "sementara", "permanen"]).optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  kontrak_id: z.string().uuid().optional().nullable(),
  unit_asal_id: z.string().uuid().optional().nullable(),
  gudang_id: z.string().uuid().optional().nullable(),
  pic_teknisi_id: z.string().uuid().optional().nullable(),
  pic_warehouse_id: z.string().uuid().optional().nullable(),
  lokasi_internal: z.string().trim().optional().nullable(),
  sumber: z.string().trim().optional().nullable(),
  tanggal_transaksi: z.string().datetime({ offset: true }).optional(),
  tanggal_akhir: z.string().datetime({ offset: true }).optional().nullable(),
  catatan_masalah: z.string().optional().nullable(),
  printer: z.array(assetSchema).default([])
});
const unitResultSchema = z.object({
  hasil: z.string().trim().min(1),
  kondisi_hasil: z.enum(HASIL_KONDISI).optional(),
  alasan: z.string().trim().optional().nullable()
});
const assetInclude = { surat_tugas_printer: { include: { master_printer: true } }, teknisi_surat_tugas: true, tiket: true, pemakaian_barang_surat_tugas: true };

function reject(message, statusCode = 409) {
  throw Object.assign(new Error(message), { statusCode });
}

async function changeOnce(tx, surat, data, expected = {}) {
  const changed = await tx.surat_tugas.updateMany({
    where: { id: surat.id, status: surat.status, ...expected }, data
  });
  if (changed.count !== 1) reject("Surat Tugas sudah berubah; muat ulang sebelum mencoba lagi.");
  return tx.surat_tugas.findUnique({ where: { id: surat.id } });
}

function role(req) {
  return normalisasiRole(req.pengguna.peran);
}

function requireRole(req, allowed) {
  if (role(req) !== "admin" && !allowed.includes(role(req))) reject("Role Anda tidak boleh menjalankan aksi ini.", 403);
}

async function requireAssigned(tx, req, suratId) {
  if (role(req) === "admin") return;
  if (role(req) !== "teknisi") reject("Aksi ini hanya untuk teknisi assigned.", 403);
  if (!await tx.teknisi_surat_tugas.count({ where: { surat_tugas_id: suratId, teknisi_id: req.pengguna.id } })) reject("Surat tugas bukan milik teknisi ini.", 403);
}

async function auditSurat(tx, req, before, after, aksi, keterangan) {
  await catatAudit(tx, req, {
    jenis_dokumen: "surat_tugas", nomor_dokumen: after.nomor_surat_tugas,
    tabel_sumber: "surat_tugas", id_sumber: after.id, aksi,
    status_sebelum: before?.status, status_sesudah: after.status,
    data_sebelum: before, data_sesudah: after, keterangan
  });
}

async function auditUnit(tx, req, surat, before, after, aksi) {
  await catatAuditBarang(tx, req, {
    jenis_barang: "printer", aksi, sebelum: before, sesudah: after,
    referensi: { jenis: "surat_tugas", id: surat.id, nomor: surat.nomor_surat_tugas },
    keterangan: `${aksi}: ${after?.mp_no || before?.mp_no}`
  });
}

async function loadNew(tx, id) {
  const surat = await tx.surat_tugas.findUnique({ where: { id }, include: assetInclude });
  return surat?.jenis_tugas ? surat : null;
}

function isInbound(jenis) {
  return PENERIMAAN_PRINTER.includes(jenis);
}

function peranUntukJenis(jenis) {
  if (jenis === "terima_tukar") return "unit_lama";
  if (jenis === "kirim_kontrak") return "utama";
  if (jenis === "terima_unit_rusak") return "utama";
  if (jenis === "kirim_back_up") return "pengganti";
  return null;
}

async function validateAsset(tx, body, ticket, line) {
  if (body.jenis_tugas === "terima_printer_baru") {
    if (line.printer_id || !line.model_id || !(line.sumber || body.sumber)) reject("Setiap printer baru membutuhkan MP No, Model, dan Sumber.", 422);
    if (await tx.master_printer.count({ where: { mp_no: line.mp_no } })) reject(`MP No ${line.mp_no} sudah ada.`);
    return;
  }
  if (!line.printer_id) reject("Pilih unit printer.", 422);
  const printer = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
  if (!printer || printer.mp_no !== line.mp_no) reject("MP No dan unit printer tidak cocok.", 422);
  if (ticket && !ticket.tiket_printer.some((item) => item.printer_id === line.printer_id && item.peran === line.peran)) reject("Unit tidak tercantum pada tiket.", 422);
  const expectedRole = peranUntukJenis(body.jenis_tugas);
  if (expectedRole && line.peran !== expectedRole) reject(`Jenis ST ini hanya menerima unit berperan ${expectedRole}.`, 422);
  if (PENGIRIMAN_PRINTER.includes(body.jenis_tugas) && !(body.jenis_tugas === "kirim_kontrak" && ticket?.tiket_asal_id && printer.penempatan === "trial")) {
    if (printer.lokasi_jenis !== "gudang" || printer.kondisi !== "ready" || printer.surat_tugas_aktif_id) reject(`Unit ${line.mp_no} tidak READY di gudang.`);
  }
  if (body.jenis_tugas === "on_site_service" || (body.jenis_tugas === "maintenance" && ticket)) {
    if (printer.lokasi_jenis !== "customer" || printer.customer_id !== body.customer_id) reject("Unit harus berada di customer tujuan.", 422);
  }
  if (body.jenis_tugas === "maintenance" && !ticket && (printer.lokasi_jenis !== "gudang" || printer.gudang_id !== body.gudang_id)) reject("Unit harus berada di gudang yang dipilih.", 422);
  if (["repair", "qc"].includes(body.jenis_tugas) && printer.lokasi_jenis !== "gudang") reject("Unit harus berada di gudang untuk QC/Repair.", 422);
  if (isInbound(body.jenis_tugas) && (printer.lokasi_jenis !== "customer" || body.customer_id && printer.customer_id !== body.customer_id)) reject("Unit belum berada di customer tujuan untuk diterima kembali.", 422);
  if (body.jenis_tugas === "terima_tukar" && printer.kontrak_id !== body.kontrak_id) reject("Unit yang diterima harus terikat kontrak TUKAR.", 422);
}

router.post("/", izin("surat_tugas", "create", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res, next) => {
  if (!req.body?.jenis_tugas) return next();
  const body = createSchema.parse(req.body);
  const identity = kategoriUntukJenisSt(body.jenis_tugas);
  requireRole(req, isInbound(body.jenis_tugas) ? ["warehouse", "kepala_teknisi"] : ["kepala_teknisi"]);
  const created = await prisma.$transaction(async (tx) => {
    const ticket = body.tiket_id ? await tx.tiket.findUnique({ where: { id: body.tiket_id }, include: { tiket_printer: true, tiket_barang: true } }) : null;
    if (body.tiket_id && !ticket) reject("Tiket tidak ditemukan.", 404);
    if (ticket?.pengaduan_lama_id) reject("Tiket arsip tetap memakai alur Surat Tugas lama.", 409);
    if (ticket && (ticket.status === "solved" || ticket.status === "cancelled" || identity?.kategori !== ticket.kategori || (ticket.jenis && !jenisStDiizinkan(ticket.kategori, ticket.jenis, body.jenis_tugas, ticket.mode)))) reject("Jenis ST tidak berlaku untuk tiket ini.", 422);
    if (ticket && (body.account_id && body.account_id !== ticket.account_id || body.customer_id && body.customer_id !== ticket.customer_id)) reject("Account/Customer ST harus sesuai tiket.", 422);
    body.account_id = ticket?.account_id || body.account_id || null;
    body.customer_id = ticket?.customer_id || body.customer_id || null;
    body.mode = ticket?.mode || body.mode || null;
    body.kontrak_id = ticket?.kontrak_id || body.kontrak_id || null;
    body.lokasi_internal = ticket?.lokasi_internal || body.lokasi_internal || null;
    if (body.jenis_tugas === "kirim_kontrak" && !["baru", "tukar"].includes(body.mode)) reject("Pilih mode KONTRAK baru atau tukar.", 422);
    if (!ticket && body.jenis_tugas === "kirim_kontrak" && body.mode === "baru" && body.kontrak_id) reject("Kontrak baru dibuat otomatis; jangan pilih kontrak lama.", 422);
    if (body.jenis_tugas === "kirim_back_up" && !["sementara", "permanen"].includes(body.mode)) reject("Pilih mode BACK-UP sementara atau permanen.", 422);
    const originalRole = body.jenis_tugas === "kirim_kontrak" && body.mode === "tukar" ? "unit_lama" : body.jenis_tugas === "kirim_back_up" ? "utama" : null;
    const originalId = originalRole ? ticket?.tiket_printer.find((line) => line.peran === originalRole)?.printer_id || body.unit_asal_id : null;
    if (originalRole && !originalId) reject("Pilih unit lama yang akan ditarik kembali.", 422);
    if (originalId) {
      const original = await tx.master_printer.findUnique({ where: { id: originalId } });
      if (!original || original.lokasi_jenis !== "customer" || original.customer_id !== body.customer_id) reject("Unit lama harus berada di customer tujuan.", 422);
      if (body.jenis_tugas === "kirim_kontrak" && original.kontrak_id !== body.kontrak_id) reject("Unit lama harus terikat kontrak TUKAR yang dipilih.", 422);
      if (body.jenis_tugas === "kirim_back_up" && body.mode === "permanen") {
        if (!original.kontrak_id) reject("BACK-UP permanen membutuhkan kontrak aktif unit lama.", 422);
        const kontrak = await tx.master_kontrak.findUnique({ where: { id: original.kontrak_id } });
        if (kontrak?.status !== "aktif") reject("Kontrak unit lama harus aktif.", 422);
        body.kontrak_id = original.kontrak_id;
      }
    }
    if (body.jenis_tugas === "kirim_kontrak" && body.mode === "tukar" || body.jenis_tugas === "terima_tukar") {
      const kontrak = body.kontrak_id ? await tx.master_kontrak.findUnique({ where: { id: body.kontrak_id } }) : null;
      if (!kontrak || kontrak.status !== "aktif" || kontrak.customer_id !== body.customer_id) reject("TUKAR membutuhkan kontrak aktif milik customer.", 422);
    }
    if ((["delivery", "komplain"].includes(identity.kategori) || body.jenis_tugas === "maintenance" && ticket || ["terima_return", "terima_tukar", "terima_unit_rusak"].includes(body.jenis_tugas)) && (!body.account_id || !body.customer_id)) reject("Account dan Customer wajib dipilih.", 422);
    if (body.jenis_tugas === "maintenance" && !ticket && (body.account_id || body.customer_id)) reject("Maintenance gudang tidak menggunakan Account atau Customer.", 422);
    if (body.customer_id || body.account_id) await pastikanCustomerAccount(tx, body.account_id, body.customer_id);
    if (!isInbound(body.jenis_tugas) && !body.pic_teknisi_id) reject("PIC teknisi wajib dipilih.", 422);
    if (isInbound(body.jenis_tugas) && !body.pic_warehouse_id) reject("PIC Warehouse wajib dipilih.", 422);
    if (isInbound(body.jenis_tugas) && body.pic_warehouse_id) {
      const pic = await tx.master_pengguna.findUnique({ where: { id: body.pic_warehouse_id } });
      if (!pic?.aktif || pic.peran !== "warehouse") reject("PIC harus user Warehouse aktif.", 422);
    }
    if (body.pic_teknisi_id) {
      const pic = await tx.master_pengguna.findUnique({ where: { id: body.pic_teknisi_id } });
      if (!pic?.aktif || pic.peran !== "teknisi") reject("PIC harus user Teknisi aktif.", 422);
    }
    if ((PENGIRIMAN_PRINTER.includes(body.jenis_tugas) || isInbound(body.jenis_tugas) || body.jenis_tugas === "kirim_toner" || body.jenis_tugas === "maintenance" && !ticket) && !body.gudang_id) reject("Gudang wajib dipilih.", 422);
    if (body.gudang_id && !await tx.master_gudang.count({ where: { id: body.gudang_id, aktif: true } })) reject("Gudang tidak aktif.", 422);
    if (body.jenis_tugas === "internal_use" && !body.lokasi_internal) reject("Lokasi/divisi internal wajib diisi.", 422);
    if (body.jenis_tugas === "terima_printer_baru" && !body.sumber && body.printer.some((line) => !line.sumber)) reject("Sumber/pemasok setiap unit wajib diisi.", 422);
    if (body.jenis_tugas === "kirim_kontrak" && !body.kontrak_id && body.mode !== "baru") reject("Pilih kontrak aktif untuk TUKAR.", 422);
    if (body.jenis_tugas !== "kirim_toner" && !body.printer.length) reject("Pilih minimal satu unit printer.", 422);
    if (["on_site_service", "repair"].includes(body.jenis_tugas) && body.printer.length !== 1) reject("Jenis pekerjaan ini hanya boleh satu unit.", 422);
    if (new Set(body.printer.map((line) => line.mp_no.toLowerCase())).size !== body.printer.length) reject("MP No tidak boleh berulang.", 422);
    for (const line of body.printer) await validateAsset(tx, body, ticket, line);
    let kontrakId = body.kontrak_id;
    if (!ticket && body.jenis_tugas === "kirim_kontrak" && body.mode === "baru") {
      const kontrak = await tx.master_kontrak.create({ data: {
        customer_id: body.customer_id, nomor_kontrak: buatNomor("KTR"),
        tanggal_mulai: new Date(body.tanggal_transaksi || Date.now()),
        tanggal_selesai: body.tanggal_akhir ? new Date(body.tanggal_akhir) : null,
        jenis_layanan: "printer", status: "draft"
      } });
      kontrakId = kontrak.id;
    }
    const surat = await tx.surat_tugas.create({ data: {
      nomor_surat_tugas: buatNomor("ST"), tiket_id: body.tiket_id || null,
      account_id: body.account_id, customer_id: body.customer_id,
      kontrak_id: kontrakId || null, mode: body.mode,
      unit_asal_id: originalId || null,
      jenis_tugas: body.jenis_tugas, jenis_pekerjaan: body.jenis_tugas,
      gudang_id: body.gudang_id || null, pic_warehouse_id: body.pic_warehouse_id || null,
      lokasi_internal: body.lokasi_internal || null, sumber: body.sumber || null,
      tanggal_transaksi: body.tanggal_transaksi ? new Date(body.tanggal_transaksi) : new Date(),
      tanggal_akhir: body.tanggal_akhir ? new Date(body.tanggal_akhir) : ticket?.tanggal_akhir || null,
      catatan_masalah: body.catatan_masalah || ticket?.deskripsi || null,
      mp_no: body.printer[0]?.mp_no || null,
      dibuat_oleh: req.pengguna.id,
      surat_tugas_printer: { create: body.printer.map((line) => ({ ...line, sumber: line.sumber || body.sumber || null, serial_number: line.serial_number || null })) },
      ...(body.pic_teknisi_id ? { teknisi_surat_tugas: { create: { teknisi_id: body.pic_teknisi_id, peran: "utama" } } } : {})
    } });
    if (body.jenis_tugas === "kirim_toner" && ticket) {
      for (const item of ticket.tiket_barang) {
        await tx.pemakaian_barang_surat_tugas.create({ data: {
          surat_tugas_id: surat.id, gudang_id: body.gudang_id,
          jenis_barang: "toner", toner_id: item.toner_id, jumlah_pakai: item.jumlah
        } });
      }
    }
    for (const line of body.printer) {
      if (!PENGIRIMAN_PRINTER.includes(body.jenis_tugas) || (body.jenis_tugas === "kirim_kontrak" && ticket?.tiket_asal_id)) continue;
      const current = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
      const changed = await tx.master_printer.updateMany({ where: { id: line.printer_id, lokasi_jenis: "gudang", kondisi: "ready", surat_tugas_aktif_id: null }, data: { status: "reserved", surat_tugas_aktif_id: surat.id, tanggal_diperbarui: new Date() } });
      if (changed.count !== 1) reject(`Unit ${line.mp_no} baru saja direservasi ST lain.`);
      await auditUnit(tx, req, surat, current, await tx.master_printer.findUnique({ where: { id: line.printer_id } }), "reservasi");
    }
    if (ticket) await tx.tiket.update({ where: { id: ticket.id }, data: { status: "progress", tanggal_diperbarui: new Date() } });
    await auditSurat(tx, req, null, surat, "buat", "Surat tugas dibuat.");
    return tx.surat_tugas.findUnique({ where: { id: surat.id }, include: assetInclude });
  });
  return sukses(res, "Surat tugas berhasil dibuat.", created, 201);
}));

router.put("/:id", izin("surat_tugas", "update", "kepala-teknisi", "teknisi"), asyncHandler(async (req, res, next) => {
  const body = z.object({
    hasil: z.string().optional().nullable(),
    account_id: z.string().uuid().optional().nullable(),
    customer_id: z.string().uuid().optional().nullable(),
    pic_teknisi_id: z.string().uuid().optional().nullable(),
    jenis_pekerjaan: z.string().optional(),
    mode: z.string().optional().nullable(),
    printer_id: z.string().uuid().optional().nullable(),
    mp_no: z.string().optional().nullable()
  }).strict().parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) return null;
    requireRole(req, ["kepala_teknisi", "teknisi"]);
    if (role(req) === "teknisi") await requireAssigned(tx, req, surat.id);
    if (["solved", "cancelled"].includes(surat.status)) reject("Surat Tugas yang sudah ditutup tidak dapat diedit.");
    const current = {
      account_id: surat.account_id, customer_id: surat.customer_id,
      pic_teknisi_id: surat.teknisi_surat_tugas[0]?.teknisi_id,
      jenis_pekerjaan: surat.jenis_pekerjaan, mode: surat.mode,
      printer_id: surat.jenis_tugas === "maintenance" && !surat.tiket_id ? null : surat.surat_tugas_printer[0]?.printer_id,
      mp_no: surat.mp_no
    };
    for (const key of Object.keys(current)) {
      if (body[key] !== undefined && (body[key] || null) !== (current[key] || null)) {
        reject(`Perubahan ${key} belum didukung pada ST baru.`, 422);
      }
    }
    if (body.hasil === undefined || body.hasil === surat.hasil) return surat;
    const after = await changeOnce(tx, surat, { hasil: body.hasil });
    await auditSurat(tx, req, surat, after, "ubah", "Hasil pekerjaan diperbarui.");
    return after;
  });
  if (!result) return next();
  return sukses(res, "Surat tugas berhasil diperbarui.", result);
}));

router.post("/:id/start", izin("surat_tugas", "workflow", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res, next) => {
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) return null;
    requireRole(req, isInbound(surat.jenis_tugas) ? ["warehouse", "kepala_teknisi"] : ["kepala_teknisi"]);
    if (surat.status !== "pending") reject("ST hanya dapat dimulai dari pending.");
    if (!isInbound(surat.jenis_tugas) && !surat.teknisi_surat_tugas.length) reject("Assign PIC teknisi sebelum ST dimulai.");
    const after = await changeOnce(tx, surat, { status: "progress", tanggal_diperbarui: new Date() });
    if (surat.jenis_tugas === "repair") {
      for (const line of surat.surat_tugas_printer) {
        const before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
        await tx.surat_tugas_printer.update({ where: { id: line.id }, data: { kondisi_sebelum: before.kondisi } });
        const unit = await tx.master_printer.update({ where: { id: line.printer_id }, data: { kondisi: "in_repair", tanggal_diperbarui: new Date() } });
        await auditUnit(tx, req, surat, before, unit, "repair_mulai");
      }
    }
    await auditSurat(tx, req, surat, after, "start", "Surat tugas dimulai.");
    return after;
  });
  if (!result) return next();
  return sukses(res, "Surat tugas dimulai.", result);
}));

router.post("/:id/assign", izin("surat_tugas", "update", "kepala-teknisi"), asyncHandler(async (req, res, next) => {
  const body = z.object({ pic_teknisi_id: z.string().uuid() }).parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) return null;
    requireRole(req, ["kepala_teknisi"]);
    if (surat.status !== "pending" || isInbound(surat.jenis_tugas)) reject("PIC hanya bisa di-assign pada ST pending non-inbound.");
    const pic = await tx.master_pengguna.findUnique({ where: { id: body.pic_teknisi_id } });
    if (!pic?.aktif || pic.peran !== "teknisi") reject("Pilih teknisi aktif.", 422);
    await tx.teknisi_surat_tugas.deleteMany({ where: { surat_tugas_id: surat.id, peran: "utama" } });
    await tx.teknisi_surat_tugas.create({ data: { surat_tugas_id: surat.id, teknisi_id: pic.id, peran: "utama" } });
    await auditSurat(tx, req, surat, surat, "assign_teknisi", `PIC teknisi: ${pic.name}.`);
    return tx.surat_tugas.findUnique({ where: { id: surat.id }, include: assetInclude });
  });
  if (!result) return next();
  return sukses(res, "PIC teknisi ditugaskan.", result);
}));

router.post("/:id/keluar", izin("surat_tugas", "workflow", "warehouse"), asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) reject("ST tidak ditemukan.", 404);
    requireRole(req, ["warehouse"]);
    if (surat.status !== "progress" || surat.konfirmasi_keluar_pada) reject("Pengeluaran sudah dikonfirmasi atau ST belum berada pada tahap pekerjaan.");
    if (!PENGIRIMAN_PRINTER.includes(surat.jenis_tugas) && surat.jenis_tugas !== "kirim_toner" && !surat.pemakaian_barang_surat_tugas.length) reject("Jenis ST ini tidak mengeluarkan barang.");
    const after = await changeOnce(tx, surat, {
      konfirmasi_keluar_pada: new Date(), validasi_warehouse_oleh: req.pengguna.id,
      validasi_warehouse_pada: new Date()
    }, { konfirmasi_keluar_pada: null });
    for (const line of surat.surat_tugas_printer) {
      if (!PENGIRIMAN_PRINTER.includes(surat.jenis_tugas)) break;
      if (surat.jenis_tugas === "kirim_kontrak" && surat.tiket?.tiket_asal_id) continue;
      const before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
      const changed = await tx.master_printer.updateMany({ where: { id: line.printer_id, status: "reserved", surat_tugas_aktif_id: surat.id, kondisi: "ready" }, data: { status: "issued", lokasi_jenis: "transit", tanggal_diperbarui: new Date() } });
      if (changed.count !== 1) reject(`Unit ${line.mp_no} tidak lagi direservasi.`);
      const after = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
      await tx.surat_tugas_printer.update({ where: { id: line.id }, data: { konfirmasi_keluar_pada: new Date() } });
      await auditUnit(tx, req, surat, before, after, "keluar_gudang");
    }
    const consumed = surat.pemakaian_barang_surat_tugas.filter((x) => x.jenis_barang !== "printer");
    if (surat.jenis_tugas === "kirim_toner" && !consumed.length) reject("Tambahkan item toner terlebih dahulu.");
    if (consumed.length) {
      const gudangAsal = surat.gudang_id || consumed[0].gudang_id;
      if (consumed.some((line) => line.gudang_id !== gudangAsal)) reject("Gunakan satu gudang asal per ST.", 422);
      const mutasi = await tx.mutasi_stok.create({ data: {
        nomor_mutasi: buatNomor("PMK"), jenis_mutasi: "pemakaian",
        gudang_asal_id: gudangAsal, jenis_referensi: "surat_tugas", referensi_id: surat.id,
        status: "terposting", dibuat_oleh: req.pengguna.id, tanggal_terposting: new Date(),
        keterangan: `Pengeluaran barang ST ${surat.nomor_surat_tugas}`
      } });
      const lines = consumed.map((line) => ({
        jenis_barang: line.jenis_barang, toner_id: line.toner_id, suku_cadang_id: line.suku_cadang_id,
        jumlah: line.jumlah_pakai, keterangan: line.keterangan
      }));
      for (const line of lines) await tx.detail_mutasi_stok.create({ data: { mutasi_stok_id: mutasi.id, ...line } });
      await terapkanMutasi(tx, mutasi, lines, req);
    }
    await auditSurat(tx, req, surat, after, "keluar_gudang", "Warehouse mengonfirmasi pengeluaran barang.");
    return after;
  });
  return sukses(res, "Barang keluar gudang dikonfirmasi.", result);
}));

router.post("/:id/serah", izin("surat_tugas", "workflow", "teknisi"), asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) reject("ST tidak ditemukan.", 404);
    await requireAssigned(tx, req, surat.id);
    if (!PENGIRIMAN_PRINTER.includes(surat.jenis_tugas) && surat.jenis_tugas !== "kirim_toner") reject("Jenis ST ini tidak memiliki serah terima.");
    if (surat.status !== "progress") reject("ST belum berada pada tahap pekerjaan.");
    if (surat.konfirmasi_serah_pada) reject("Serah terima sudah dikonfirmasi.");
    if (!surat.konfirmasi_keluar_pada && !(surat.jenis_tugas === "kirim_kontrak" && surat.tiket?.tiket_asal_id)) reject("Warehouse harus mengonfirmasi unit keluar dahulu.");
    if (surat.jenis_tugas === "kirim_toner" && !surat.konfirmasi_keluar_pada) reject("Warehouse harus mengonfirmasi toner keluar dahulu.");
    const after = await changeOnce(tx, surat, { konfirmasi_serah_pada: new Date() }, { konfirmasi_serah_pada: null });
    const placement = { kirim_kontrak: "kontrak", kirim_trial: "trial", kirim_stand_by: "stand_by", kirim_event: "event", kirim_sell: "sold", kirim_back_up: "back_up", internal_use: "internal_use" }[surat.jenis_tugas];
    for (const line of surat.surat_tugas_printer) {
      const before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
      const conversion = surat.jenis_tugas === "kirim_kontrak" && surat.tiket?.tiket_asal_id;
      const changed = await tx.master_printer.updateMany({
        where: conversion ? { id: line.printer_id, lokasi_jenis: "customer", penempatan: "trial", customer_id: surat.customer_id } : { id: line.printer_id, status: "issued", surat_tugas_aktif_id: surat.id, lokasi_jenis: "transit" },
        data: {
          status: surat.jenis_tugas === "kirim_sell" ? "inactive" : "installed",
          lokasi_jenis: surat.jenis_tugas === "internal_use" ? "internal" : "customer",
          penempatan: placement, account_id: surat.jenis_tugas === "internal_use" ? null : surat.account_id,
          customer_id: surat.jenis_tugas === "internal_use" ? null : surat.customer_id,
          kontrak_id: surat.jenis_tugas === "kirim_kontrak" ? surat.kontrak_id : null,
          gudang_id: null, surat_tugas_aktif_id: null,
          lokasi_internal: surat.jenis_tugas === "internal_use" ? surat.lokasi_internal : null,
          tanggal_instalasi: new Date(), tanggal_diperbarui: new Date()
        }
      });
      if (changed.count !== 1) reject(`Unit ${line.mp_no} tidak berada pada tahap serah terima.`);
      await tx.surat_tugas_printer.update({ where: { id: line.id }, data: { konfirmasi_serah_pada: new Date() } });
      await auditUnit(tx, req, surat, before, await tx.master_printer.findUnique({ where: { id: line.printer_id } }), "serah_terima");
    }
    await auditSurat(tx, req, surat, after, "serah_terima", "Teknisi mengonfirmasi serah terima.");
    return after;
  });
  return sukses(res, "Serah terima dikonfirmasi.", result);
}));

router.post("/:id/terima", izin("surat_tugas", "workflow", "warehouse"), asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) reject("ST tidak ditemukan.", 404);
    requireRole(req, ["warehouse"]);
    if (!isInbound(surat.jenis_tugas) || surat.konfirmasi_terima_pada || surat.status !== "progress") reject("Penerimaan tidak tersedia pada tahap ini.");
    const after = await changeOnce(tx, surat, {
      konfirmasi_terima_pada: new Date(), status: "warehouse_validated",
      validasi_warehouse_oleh: req.pengguna.id, validasi_warehouse_pada: new Date()
    }, { konfirmasi_terima_pada: null });
    for (const line of surat.surat_tugas_printer) {
      let before = null;
      let after;
      if (surat.jenis_tugas === "terima_printer_baru") {
        after = await tx.master_printer.create({ data: {
          mp_no: line.mp_no, serial_number: line.serial_number || null, model_id: line.model_id,
          gudang_id: surat.gudang_id, status: "available", lokasi_jenis: "gudang", kondisi: "checking", penempatan: "none",
          keterangan: line.sumber || surat.sumber ? `Sumber: ${line.sumber || surat.sumber}` : null
        } });
        await tx.surat_tugas_printer.update({ where: { id: line.id }, data: { printer_id: after.id, konfirmasi_terima_pada: new Date() } });
        if (surat.tiket_id) await tx.tiket_printer.updateMany({ where: { tiket_id: surat.tiket_id, mp_no: line.mp_no }, data: { printer_id: after.id, tanggal_konfirmasi: new Date() } });
      } else {
        before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
        const changed = await tx.master_printer.updateMany({ where: { id: line.printer_id, lokasi_jenis: "customer" }, data: {
          status: "available", lokasi_jenis: "gudang", gudang_id: surat.gudang_id,
          account_id: null, customer_id: null, kontrak_id: null, penempatan: "none", kondisi: "checking",
          surat_tugas_aktif_id: null, tanggal_diperbarui: new Date()
        } });
        if (changed.count !== 1) reject(`Unit ${line.mp_no} sudah diterima atau tidak lagi di customer.`);
        after = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
        await tx.surat_tugas_printer.update({ where: { id: line.id }, data: { konfirmasi_terima_pada: new Date() } });
      }
      await auditUnit(tx, req, surat, before, after, "terima_gudang");
    }
    await auditSurat(tx, req, surat, after, "terima_gudang", "Warehouse menerima unit fisik.");
    return after;
  });
  return sukses(res, "Penerimaan printer dikonfirmasi.", result);
}));

router.put("/:id/printer/:lineId/hasil", izin("surat_tugas", "workflow", "teknisi"), asyncHandler(async (req, res) => {
  const body = unitResultSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) reject("ST tidak ditemukan.", 404);
    await requireAssigned(tx, req, surat.id);
    if (!["progress", "technician_completed"].includes(surat.status)) reject("Hasil hanya bisa diisi saat pekerjaan berjalan.");
    const line = surat.surat_tugas_printer.find((row) => row.id === req.params.lineId);
    if (!line) reject("Unit tidak ada pada ST.", 404);
    if (["qc", "repair"].includes(surat.jenis_tugas) && !body.kondisi_hasil) reject("Pilih kondisi hasil QC.", 422);
    if (body.kondisi_hasil && body.kondisi_hasil !== "ready" && !body.alasan) reject("Hasil selain READY wajib alasan.", 422);
    const after = await tx.surat_tugas_printer.update({ where: { id: line.id }, data: body });
    await auditSurat(tx, req, surat, surat, "hasil_unit", `Hasil unit ${line.mp_no} dicatat.`);
    return after;
  });
  return sukses(res, "Hasil unit disimpan.", result);
}));

router.post("/:id/selesai", izin("surat_tugas", "workflow", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) reject("ST tidak ditemukan.", 404);
    if (isInbound(surat.jenis_tugas)) requireRole(req, ["warehouse"]);
    else await requireAssigned(tx, req, surat.id);
    if (isInbound(surat.jenis_tugas)) {
      if (surat.status !== "warehouse_validated") reject("Warehouse harus menerima semua unit terlebih dulu.");
    } else if (surat.status !== "progress") reject("ST belum berada di tahap pekerjaan.");
    if (PENGIRIMAN_PRINTER.includes(surat.jenis_tugas) || surat.jenis_tugas === "kirim_toner") {
      if (!surat.konfirmasi_serah_pada) reject("Serah terima belum dikonfirmasi.");
    }
    if (["qc", "repair", "maintenance", "on_site_service"].includes(surat.jenis_tugas) && surat.surat_tugas_printer.some((line) => !line.hasil)) reject("Isi hasil untuk setiap unit.");
    if (surat.pemakaian_barang_surat_tugas.some((line) => line.jenis_barang !== "printer") && !surat.konfirmasi_keluar_pada) reject("Barang harus divalidasi keluar oleh Warehouse dahulu.");
    const after = await changeOnce(tx, surat, { status: "technician_completed", hasil: req.body?.hasil || surat.hasil });
    await auditSurat(tx, req, surat, after, "selesai_pekerjaan", "Pelaksana menyelesaikan pekerjaan.");
    return after;
  });
  return sukses(res, "Pekerjaan selesai.", result);
}));

router.post("/:id/resolve", izin("surat_tugas", "resolve", "kepala-teknisi"), asyncHandler(async (req, res, next) => {
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) return null;
    requireRole(req, ["kepala_teknisi"]);
    if (surat.status !== "technician_completed" && !(isInbound(surat.jenis_tugas) && surat.status === "warehouse_validated")) reject("Pekerjaan belum selesai dan belum dapat disetujui.");
    if (PENGIRIMAN_PRINTER.includes(surat.jenis_tugas) || surat.jenis_tugas === "kirim_toner") {
      if (!surat.konfirmasi_serah_pada) reject("Serah terima belum lengkap.");
    }
    if (isInbound(surat.jenis_tugas) && !surat.konfirmasi_terima_pada) reject("Penerimaan Warehouse belum lengkap.");
    const after = await changeOnce(tx, surat, {
      status: "solved", validasi_kepala_teknisi_oleh: req.pengguna.id,
      validasi_kepala_teknisi_pada: new Date()
    });
    if (!surat.tiket_id && (surat.jenis_tugas === "kirim_kontrak" && surat.mode === "tukar" || surat.jenis_tugas === "kirim_back_up" && surat.mode === "permanen")) {
      const original = surat.unit_asal_id ? await tx.master_printer.findUnique({ where: { id: surat.unit_asal_id } }) : null;
      if (!original || original.lokasi_jenis !== "gudang" || original.kondisi !== "checking") reject("Unit lama harus diterima Warehouse sebelum ST mandiri diselesaikan.", 409);
      if (surat.jenis_tugas === "kirim_back_up") {
        for (const line of surat.surat_tugas_printer) {
          const before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
          if (!before || before.penempatan !== "back_up" || before.customer_id !== surat.customer_id) reject("Unit pengganti belum diserahkan ke customer.", 409);
          const afterUnit = await tx.master_printer.update({ where: { id: line.printer_id }, data: { penempatan: "kontrak", kontrak_id: surat.kontrak_id, tanggal_diperbarui: new Date() } });
          await auditUnit(tx, req, surat, before, afterUnit, "backup_permanen");
        }
      }
    }
    if (["qc", "repair"].includes(surat.jenis_tugas)) {
      for (const line of surat.surat_tugas_printer) {
        if (!line.kondisi_hasil || line.kondisi_hasil !== "ready" && !line.alasan) reject(`Hasil QC ${line.mp_no} belum lengkap.`);
        const before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
        const after = await tx.master_printer.update({ where: { id: line.printer_id }, data: { kondisi: line.kondisi_hasil, surat_tugas_aktif_id: null, tanggal_diperbarui: new Date() } });
        await tx.surat_tugas_printer.update({ where: { id: line.id }, data: { disetujui_kepala_pada: new Date() } });
        await auditUnit(tx, req, surat, before, after, "qc_disetujui");
      }
    }
    if (surat.jenis_tugas === "maintenance") {
      for (const line of surat.surat_tugas_printer) {
        const before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
        if (!before?.tanggal_maintenance_berikutnya || !before.interval_maintenance_bulan) continue;
        if (surat.tanggal_maintenance_otomatis && tanggalSaja(before.tanggal_maintenance_berikutnya) !== tanggalSaja(surat.tanggal_maintenance_otomatis)) continue;
        const nextDate = jadwalBerikutnya(tanggalSaja(before.tanggal_maintenance_berikutnya), before.interval_maintenance_bulan);
        const afterUnit = await tx.master_printer.update({ where: { id: before.id }, data: { tanggal_maintenance_berikutnya: nextDate, tanggal_diperbarui: new Date() } });
        await auditUnit(tx, req, surat, before, afterUnit, "maintenance_berikutnya");
      }
    }
    if (surat.jenis_tugas === "kirim_kontrak" && surat.kontrak_id) {
      const kontrak = await tx.master_kontrak.findUnique({ where: { id: surat.kontrak_id } });
      if (kontrak?.status === "draft") await tx.master_kontrak.update({ where: { id: kontrak.id }, data: { status: "aktif", tanggal_diperbarui: new Date() } });
    }
    await auditSurat(tx, req, surat, after, "resolve", "Kepala teknisi menyelesaikan surat tugas.");
    return after;
  });
  if (!result) return next();
  return sukses(res, "Surat tugas selesai.", result);
}));

router.post("/:id/cancel", izin("surat_tugas", "update", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const surat = await loadNew(tx, req.params.id);
    if (!surat) reject("ST tidak ditemukan.", 404);
    requireRole(req, isInbound(surat.jenis_tugas) ? ["warehouse", "kepala_teknisi"] : ["kepala_teknisi"]);
    if (["solved", "cancelled"].includes(surat.status)) reject("ST sudah ditutup.");
    if (surat.konfirmasi_keluar_pada || surat.konfirmasi_serah_pada || surat.konfirmasi_terima_pada) reject("Perpindahan yang sudah dikonfirmasi harus dibalik lewat proses Return, bukan membatalkan ST.");
    for (const line of surat.surat_tugas_printer) {
      if (!line.printer_id) continue;
      const before = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
      if (before?.surat_tugas_aktif_id === surat.id && before.status === "reserved") {
        const after = await tx.master_printer.update({ where: { id: line.printer_id }, data: { status: "available", surat_tugas_aktif_id: null, tanggal_diperbarui: new Date() } });
        await auditUnit(tx, req, surat, before, after, "lepas_reservasi");
      } else if (surat.jenis_tugas === "repair" && surat.status === "progress" && before?.kondisi === "in_repair" && line.kondisi_sebelum) {
        const after = await tx.master_printer.update({ where: { id: line.printer_id }, data: { kondisi: line.kondisi_sebelum, tanggal_diperbarui: new Date() } });
        await auditUnit(tx, req, surat, before, after, "repair_dibatalkan");
      }
    }
    const after = await tx.surat_tugas.update({ where: { id: surat.id }, data: { status: "cancelled", tanggal_diperbarui: new Date() } });
    await auditSurat(tx, req, surat, after, "batalkan", "Surat tugas dibatalkan sebelum perpindahan barang.");
    return after;
  });
  return sukses(res, "Surat tugas dibatalkan.", result);
}));

module.exports = router;
