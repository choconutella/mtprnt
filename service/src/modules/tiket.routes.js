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
const { terapkanSlaPendingKomplain } = require("./sla.service");
const { JENIS_TIKET, PEMILIK_TIKET, tugasWajib } = require("./tiket.catalog");

const router = express.Router();
router.use(autentikasi);

const printerSchema = z.object({
  printer_id: z.string().uuid().optional().nullable(),
  mp_no: z.string().trim().min(1).max(150),
  model_id: z.string().uuid().optional().nullable(),
  serial_number: z.string().trim().optional().nullable(),
  sumber: z.string().trim().optional().nullable(),
  peran: z.enum(["utama", "pengganti", "unit_lama"]).default("utama")
});
const bodySchema = z.object({
  kategori: z.enum(Object.keys(JENIS_TIKET)),
  jenis: z.string().trim().min(1).optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  kontrak_id: z.string().uuid().optional().nullable(),
  tiket_asal_id: z.string().uuid().optional().nullable(),
  sales_id: z.string().uuid().optional().nullable(),
  tanggal_transaksi: z.string().datetime({ offset: true }).optional(),
  tanggal_akhir: z.string().datetime({ offset: true }).optional().nullable(),
  mode: z.enum(["baru", "tukar", "sementara", "permanen"]).optional().nullable(),
  lokasi_internal: z.string().trim().optional().nullable(),
  alasan: z.string().trim().optional().nullable(),
  deskripsi: z.string().trim().optional().nullable(),
  hasil: z.string().trim().optional().nullable(),
  printer: z.array(printerSchema).default([]),
  toner: z.array(z.object({ toner_id: z.string().uuid(), jumlah: z.number().positive() })).default([])
});
const querySchema = z.object({
  halaman: z.coerce.number().int().min(1).default(1),
  batas: z.coerce.number().int().min(1).max(100).default(20),
  cari: z.string().optional(),
  kategori: z.enum(Object.keys(JENIS_TIKET)).optional(),
  jenis: z.string().optional(),
  status: z.enum(["new", "pending", "progress", "solved", "cancelled"]).optional()
});
const include = {
  master_account: true,
  master_customer: true,
  master_kontrak: true,
  tiket_printer: { include: { master_printer: true, master_printer_model: true } },
  tiket_barang: { include: { master_toner: true } },
  surat_tugas: { orderBy: { tanggal_dibuat: "desc" } }
};

function reject(message, statusCode = 422) {
  throw Object.assign(new Error(message), { statusCode });
}

function role(req) {
  return normalisasiRole(req.pengguna.peran);
}

function assertOwner(req, kategori) {
  if (role(req) !== "admin" && role(req) !== PEMILIK_TIKET[kategori]) reject("Role Anda tidak boleh mengubah kategori tiket ini.", 403);
}

function bolehLihat(req, tiket) {
  const current = role(req);
  if (["admin", "sales_admin", "kepala_teknisi", "warehouse"].includes(current)) return true;
  if (current === "sales") return tiket.sales_id === req.pengguna.id || tiket.dibuat_oleh === req.pengguna.id;
  if (current === "teknisi") return tiket.surat_tugas?.some((surat) => surat.teknisi_surat_tugas?.some((pic) => pic.teknisi_id === req.pengguna.id));
  return false;
}

async function validasiPrinter(tx, body) {
  const { kategori, jenis, printer, customer_id: customerId } = body;
  if (!jenis) return;
  if (jenis !== "toner_purchase" && !printer.length) reject("Pilih minimal satu printer.");
  if (["on_site_service", "repair"].includes(jenis) && printer.length !== 1) reject("Jenis ini membutuhkan tepat satu printer.");
  if (jenis === "back_up" && (printer.length !== 2 || !printer.some((p) => p.peran === "utama") || !printer.some((p) => p.peran === "pengganti"))) reject("BACK-UP membutuhkan unit utama dan pengganti.");
  if (jenis === "kontrak" && body.mode === "tukar" && (!printer.some((p) => p.peran === "unit_lama") || !printer.some((p) => p.peran === "utama"))) reject("Mode TUKAR membutuhkan unit baru dan unit lama.");
  if (new Set(printer.map((p) => p.mp_no.toLowerCase())).size !== printer.length) reject("MP No tidak boleh berulang dalam satu tiket.");

  for (const line of printer) {
    if (jenis === "penerimaan_printer") {
      if (line.printer_id || !line.model_id || !line.sumber) reject("Setiap printer baru membutuhkan MP No, Model, dan Sumber.");
      if (await tx.master_printer.count({ where: { mp_no: line.mp_no } })) reject(`MP No ${line.mp_no} sudah ada.`, 409);
      continue;
    }
    if (!line.printer_id) reject(`Pilih unit untuk ${line.mp_no}.`);
    const unit = await tx.master_printer.findUnique({ where: { id: line.printer_id } });
    if (!unit || unit.mp_no !== line.mp_no) reject("MP No dan unit printer tidak cocok.");
    if (jenis === "kontrak" && line.peran === "unit_lama" && (unit.lokasi_jenis !== "customer" || unit.customer_id !== customerId || unit.kontrak_id !== body.kontrak_id)) reject("Unit lama harus berada pada customer dan kontrak yang dipilih.");
    if (jenis === "kontrak" && body.tiket_asal_id && line.peran === "utama") {
      const fromTrial = await tx.tiket_printer.count({ where: { tiket_id: body.tiket_asal_id, printer_id: unit.id } });
      if (!fromTrial || unit.customer_id !== customerId || unit.penempatan !== "trial") reject("Unit KONTRAK harus berasal dari Tiket TRIAL pada customer yang sama.");
    }
    if (kategori === "delivery" && jenis !== "toner_purchase" && !(jenis === "kontrak" && body.tiket_asal_id && unit.penempatan === "trial")) {
      if (line.peran !== "unit_lama" && (unit.lokasi_jenis !== "gudang" || unit.kondisi !== "ready" || unit.surat_tugas_aktif_id)) reject(`Unit ${unit.mp_no} tidak tersedia untuk dikirim.`, 409);
    }
    if (jenis === "back_up" && line.peran === "pengganti" && (unit.lokasi_jenis !== "gudang" || unit.kondisi !== "ready" || unit.surat_tugas_aktif_id)) reject("Unit pengganti harus READY di gudang.", 409);
    if (["on_site_service", "maintenance"].includes(jenis) || (jenis === "back_up" && line.peran === "utama")) {
      if (unit.lokasi_jenis !== "customer" || unit.customer_id !== customerId) reject(`Unit ${unit.mp_no} harus berada di customer terpilih.`);
    }
    if (["repair", "qc"].includes(jenis) && unit.lokasi_jenis !== "gudang") reject(`Unit ${unit.mp_no} harus sudah diterima di gudang.`);
    if (jenis === "return" && (unit.lokasi_jenis !== "customer" || body.customer_id && unit.customer_id !== customerId)) reject(`Unit ${unit.mp_no} belum berada pada customer yang akan melakukan Return.`);
  }
}

async function validasiBody(tx, body) {
  if (body.jenis && !JENIS_TIKET[body.kategori]?.[body.jenis]) reject("Jenis tiket tidak sesuai kategori.");
  if (["delivery", "komplain", "maintenance"].includes(body.kategori) || body.jenis === "return") {
    if (!body.account_id || !body.customer_id) reject("Account dan Customer wajib dipilih.");
  }
  if (body.customer_id || body.account_id) await pastikanCustomerAccount(tx, body.account_id, body.customer_id);
  if (["delivery", "komplain"].includes(body.kategori) && !body.sales_id) reject("Owner wajib dipilih.");
  if (body.sales_id) {
    const owner = await tx.master_pengguna.findUnique({ where: { id: body.sales_id } });
    if (!owner?.aktif) reject("Owner harus user aktif.");
  }
  if (body.jenis) {
    if (["trial", "event"].includes(body.jenis) && !body.tanggal_akhir) reject("Tanggal akhir wajib diisi.");
    if (body.jenis === "toner_purchase" && !body.toner.length) reject("Pilih toner dan jumlah yang dipesan.");
    if (body.jenis === "return" && !body.alasan) reject("Alasan Return wajib diisi.");
    if (body.jenis === "internal_use" && !body.lokasi_internal) reject("Divisi/lokasi internal wajib diisi.");
    if (body.jenis !== "toner_purchase" && body.toner.length) reject("Item toner pesanan hanya untuk TONER PURCHASE.");
    if (body.jenis === "back_up" && !["sementara", "permanen"].includes(body.mode)) reject("Pilih mode BACK-UP sementara atau permanen.");
    if (body.jenis === "kontrak" && !["baru", "tukar"].includes(body.mode)) reject("Pilih mode KONTRAK baru atau tukar.");
  } else if (body.toner.length) {
    reject("Toner dipilih pada Surat Tugas setelah jenis pekerjaan ditentukan.");
  }
  await validasiPrinter(tx, body);
}

router.get("/catalog", izin("tiket", "view", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), (req, res) => sukses(res, "Katalog tiket.", JENIS_TIKET));

router.get("/", izin("tiket", "view", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  await terapkanSlaPendingKomplain();
  const query = querySchema.parse(req.query);
  const where = {
    ...(query.kategori ? { kategori: query.kategori } : {}),
    ...(query.jenis ? { jenis: query.jenis } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.cari ? { OR: [
      { nomor_tiket: { contains: query.cari, mode: "insensitive" } },
      { deskripsi: { contains: query.cari, mode: "insensitive" } }
    ] } : {})
  };
  if (role(req) === "sales") where.AND = [{ OR: [{ sales_id: req.pengguna.id }, { dibuat_oleh: req.pengguna.id }] }];
  if (role(req) === "teknisi") where.surat_tugas = { some: { teknisi_surat_tugas: { some: { teknisi_id: req.pengguna.id } } } };
  const [total, items] = await Promise.all([
    prisma.tiket.count({ where }),
    prisma.tiket.findMany({ where, include, orderBy: { tanggal_dibuat: "desc" }, skip: (query.halaman - 1) * query.batas, take: query.batas })
  ]);
  return sukses(res, "Tiket berhasil diambil.", { items, meta: { halaman: query.halaman, batas: query.batas, total } });
}));

router.get("/:id", izin("tiket", "view", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  await terapkanSlaPendingKomplain();
  const item = await prisma.tiket.findUnique({ where: { id: req.params.id }, include: { ...include, surat_tugas: { include: { teknisi_surat_tugas: true }, orderBy: { tanggal_dibuat: "desc" } } } });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  if (!bolehLihat(req, item)) return gagal(res, "Anda tidak memiliki akses ke tiket ini.", 403);
  return sukses(res, "Tiket berhasil diambil.", item);
}));

router.post("/", izin("tiket", "create", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const body = bodySchema.parse(req.body);
  assertOwner(req, body.kategori);
  const created = await prisma.$transaction(async (tx) => {
    await validasiBody(tx, body);
    let kontrakId = body.kontrak_id || null;
    if (body.jenis === "back_up" && body.mode === "permanen") {
      const original = body.printer.find((line) => line.peran === "utama");
      const unit = await tx.master_printer.findUnique({ where: { id: original.printer_id } });
      if (!unit?.kontrak_id) reject("BACK-UP permanen memerlukan unit bermasalah yang terikat kontrak aktif.");
      kontrakId = unit.kontrak_id;
    }
    if (body.jenis === "kontrak" && body.mode === "tukar") {
      const kontrak = await tx.master_kontrak.findUnique({ where: { id: kontrakId || "00000000-0000-0000-0000-000000000000" } });
      if (!kontrak || kontrak.customer_id !== body.customer_id || kontrak.status !== "aktif") reject("TUKAR harus memakai kontrak aktif milik customer.");
    }
    if (body.jenis === "kontrak" && body.mode === "baru" && kontrakId) reject("Kontrak baru akan dibuat otomatis; jangan pilih kontrak lama.");
    if (body.tiket_asal_id) {
      const asal = await tx.tiket.findUnique({ where: { id: body.tiket_asal_id } });
      if (!asal || asal.status !== "solved") reject("Tiket asal harus sudah selesai.");
      if (body.jenis === "kontrak" && (asal.jenis !== "trial" || asal.hasil !== "berhasil" || asal.customer_id !== body.customer_id)) reject("Konversi KONTRAK hanya boleh dari TRIAL berhasil pada customer yang sama.");
    }
    const { printer, toner, ...data } = body;
    const item = await tx.tiket.create({ data: {
      ...data,
      kontrak_id: kontrakId,
      tanggal_transaksi: body.tanggal_transaksi ? new Date(body.tanggal_transaksi) : new Date(),
      tanggal_akhir: body.tanggal_akhir ? new Date(body.tanggal_akhir) : null,
      nomor_tiket: buatNomor("TKT"),
      jenis: body.jenis || "",
      dibuat_oleh: req.pengguna.id,
      tiket_printer: { create: printer.map((line) => ({ ...line, serial_number: line.serial_number || null })) },
      tiket_barang: { create: toner }
    } });
    if (body.jenis === "kontrak" && body.mode === "baru") {
      const kontrak = await tx.master_kontrak.create({ data: {
        customer_id: body.customer_id,
        nomor_kontrak: buatNomor("KTR"),
        tanggal_mulai: new Date(body.tanggal_transaksi || Date.now()),
        tanggal_selesai: body.tanggal_akhir ? new Date(body.tanggal_akhir) : null,
        jenis_layanan: "printer",
        status: "draft",
        tiket_id: item.id
      } });
      kontrakId = kontrak.id;
      await tx.tiket.update({ where: { id: item.id }, data: { kontrak_id: kontrak.id } });
    }
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: item.nomor_tiket, tabel_sumber: "tiket", id_sumber: item.id, aksi: "buat", status_sesudah: "new", data_sesudah: { ...item, kontrak_id: kontrakId, printer }, keterangan: "Tiket dibuat." });
    return tx.tiket.findUnique({ where: { id: item.id }, include });
  });
  return sukses(res, "Tiket berhasil dibuat.", created, 201);
}));

router.put("/:id", izin("tiket", "update", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  if (req.body?.printer_ids !== undefined) reject("Unit Printer pada Tiket tidak dapat diubah.");
  const body = z.object({ deskripsi: z.string().optional().nullable(), tanggal_akhir: z.string().datetime({ offset: true }).optional().nullable(), alasan: z.string().optional().nullable(), hasil: z.string().optional().nullable(), lokasi_internal: z.string().optional().nullable(), sales_id: z.string().uuid().optional(), tanggal_transaksi: z.string().datetime({ offset: true }).optional() }).parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const before = await tx.tiket.findUnique({ where: { id: req.params.id } });
    if (!before) return null;
    if (before.pengaduan_lama_id) reject("Tiket arsip disunting melalui alur Komplain lama.", 409);
    assertOwner(req, before.kategori);
    if (["solved", "cancelled"].includes(before.status)) reject("Tiket selesai tidak dapat diedit.", 409);
    if (body.sales_id) {
      const owner = await tx.master_pengguna.findUnique({ where: { id: body.sales_id } });
      if (!owner?.aktif) reject("Owner harus user aktif.");
    }
    const after = await tx.tiket.update({ where: { id: before.id }, data: { ...body, ...(body.tanggal_transaksi ? { tanggal_transaksi: new Date(body.tanggal_transaksi) } : {}), ...(body.tanggal_akhir !== undefined ? { tanggal_akhir: body.tanggal_akhir ? new Date(body.tanggal_akhir) : null } : {}), tanggal_diperbarui: new Date() } });
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: after.nomor_tiket, tabel_sumber: "tiket", id_sumber: after.id, aksi: "ubah", data_sebelum: before, data_sesudah: after, keterangan: "Tiket diperbarui." });
    return after;
  });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  return sukses(res, "Tiket diperbarui.", item);
}));

router.post("/:id/resolve", izin("tiket", "resolve", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const item = await prisma.$transaction(async (tx) => {
    const before = await tx.tiket.findUnique({ where: { id: req.params.id }, include: { surat_tugas: true } });
    if (!before) return null;
    if (role(req) !== "admin") reject("Penutupan Tiket sementara hanya dapat dilakukan oleh admin.", 403);
    if (before.pengaduan_lama_id) reject("Tiket arsip diselesaikan melalui alur Komplain lama.", 409);
    assertOwner(req, before.kategori);
    if (["solved", "cancelled"].includes(before.status)) reject("Tiket sudah ditutup.", 409);
    const required = tugasWajib(before.kategori, before.jenis, before.mode);
    if (required.some((jenis) => !before.surat_tugas.some((st) => st.jenis_tugas === jenis && st.status === "solved"))) reject("Seluruh jenis ST wajib harus selesai sebelum tiket ditutup.", 409);
    if (!before.surat_tugas.some((st) => st.status === "solved")) reject("Minimal satu Surat Tugas harus selesai sebelum tiket ditutup.", 409);
    if (before.surat_tugas.some((st) => st.status !== "solved" && st.status !== "cancelled")) reject("Masih ada ST yang berjalan.", 409);
    if (before.jenis === "trial" && !["berhasil", "gagal", "batal"].includes(before.hasil)) reject("Hasil TRIAL harus dicatat sebelum ditutup.", 409);
    const claimed = await tx.tiket.updateMany({
      where: { id: before.id, status: before.status },
      data: { status: "solved", tanggal_diselesaikan: new Date(), ringkasan_penyelesaian: req.body?.ringkasan_penyelesaian || before.ringkasan_penyelesaian }
    });
    if (claimed.count !== 1) reject("Tiket sudah berubah; muat ulang sebelum mencoba lagi.", 409);
    if (before.jenis === "back_up" && before.mode === "permanen") {
      const lines = await tx.tiket_printer.findMany({ where: { tiket_id: before.id } });
      const replacement = lines.find((line) => line.peran === "pengganti");
      const original = lines.find((line) => line.peran === "utama");
      const beforeReplacement = await tx.master_printer.findUnique({ where: { id: replacement.printer_id } });
      const originalNow = await tx.master_printer.findUnique({ where: { id: original.printer_id } });
      if (beforeReplacement?.penempatan !== "back_up" || beforeReplacement.customer_id !== before.customer_id || originalNow?.kondisi !== "checking" || originalNow.lokasi_jenis !== "gudang") reject("Pengganti harus sudah diserahkan dan unit lama diterima Warehouse.", 409);
      const afterReplacement = await tx.master_printer.update({ where: { id: replacement.printer_id }, data: { penempatan: "kontrak", kontrak_id: before.kontrak_id, tanggal_diperbarui: new Date() } });
      await catatAuditBarang(tx, req, { jenis_barang: "printer", aksi: "backup_permanen", sebelum: beforeReplacement, sesudah: afterReplacement, referensi: { jenis: "tiket", id: before.id, nomor: before.nomor_tiket }, keterangan: "Unit BACK-UP permanen menjadi KONTRAK." });
    }
    const after = await tx.tiket.findUnique({ where: { id: before.id } });
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: after.nomor_tiket, tabel_sumber: "tiket", id_sumber: after.id, aksi: "resolve", status_sebelum: before.status, status_sesudah: "solved", data_sebelum: before, data_sesudah: after, keterangan: "Tiket diselesaikan." });
    return after;
  });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  return sukses(res, "Tiket selesai.", item);
}));

router.post("/:id/cancel", izin("tiket", "update", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const item = await prisma.$transaction(async (tx) => {
    const before = await tx.tiket.findUnique({ where: { id: req.params.id }, include: { surat_tugas: true } });
    if (!before) return null;
    if (before.pengaduan_lama_id) reject("Tiket arsip dibatalkan melalui alur Komplain lama.", 409);
    assertOwner(req, before.kategori);
    if (["solved", "cancelled"].includes(before.status)) reject("Tiket sudah ditutup.", 409);
    if (before.surat_tugas.some((st) => st.status !== "cancelled")) reject("Batalkan seluruh ST terkait terlebih dahulu.", 409);
    const claimed = await tx.tiket.updateMany({ where: { id: before.id, status: before.status }, data: { status: "cancelled", tanggal_diperbarui: new Date() } });
    if (claimed.count !== 1) reject("Tiket sudah berubah; muat ulang sebelum mencoba lagi.", 409);
    const after = await tx.tiket.findUnique({ where: { id: before.id } });
    if (before.jenis === "kontrak" && before.mode === "baru" && before.kontrak_id) {
      await tx.master_kontrak.updateMany({ where: { id: before.kontrak_id, status: "draft" }, data: { status: "dibatalkan" } });
    }
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: after.nomor_tiket, tabel_sumber: "tiket", id_sumber: after.id, aksi: "batalkan", status_sebelum: before.status, status_sesudah: "cancelled", data_sebelum: before, data_sesudah: after, keterangan: "Tiket dibatalkan." });
    return after;
  });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  return sukses(res, "Tiket dibatalkan.", item);
}));

module.exports = router;
