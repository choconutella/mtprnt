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
const { suratTugasApi } = require("./surat-tugas-identitas");
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
  tiket_asal_id: z.string().trim().min(1).max(100).optional().nullable(),
  owner: z.string().uuid().optional().nullable(),
  sales_id: z.string().uuid().optional().nullable(),
  tanggal_transaksi: z.string().datetime({ offset: true }).optional(),
  tanggal_akhir: z.string().datetime({ offset: true }).optional().nullable(),
  mode: z.enum(["baru", "tukar", "sementara", "permanen"]).optional().nullable(),
  lokasi_internal: z.string().trim().optional().nullable(),
  alasan: z.string().trim().optional().nullable(),
  deskripsi: z.string().trim().optional().nullable(),
  hasil: z.string().trim().optional().nullable(),
  mp_no: z.string().trim().min(1).max(150).optional().nullable(),
  printer: z.array(printerSchema).default([])
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
  master_pengguna_owner: true,
  master_pengguna_dibuat: true,
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

function tiketApi(item) {
  if (!item) return item;
  return {
    ...item,
    id: item.id,
    nomor_tiket: item.id,
    account_id: item.master_account?.id || item.account_id,
    customer_id: item.master_customer?.id || item.customer_id,
    owner: item.master_pengguna_owner?.id || item.owner,
    sales_id: item.master_pengguna_owner?.id || item.owner
  };
}

function bolehLihat(req, tiket) {
  const current = role(req);
  if (["admin", "sales_admin", "kepala_teknisi", "warehouse"].includes(current)) return true;
  if (current === "sales") return tiket.master_pengguna_owner?.id === req.pengguna.id || tiket.master_pengguna_dibuat?.id === req.pengguna.id;
  if (current === "teknisi") return tiket.surat_tugas?.some((surat) => surat.teknisi_surat_tugas?.some((pic) => pic.teknisi_id === req.pengguna.user_id));
  return false;
}

async function validasiPrinter(tx, body) {
  const { kategori, jenis, printer, customer_id: customerId } = body;
  if (!jenis) return;
  if (jenis !== "toner_purchase" && !body.mp_no && !printer.length) reject("Pilih satu MP No objek.");
  if (printer.length > 1) reject("Satu Tiket hanya mencatat satu printer objek.");
  if (["on_site_service", "repair"].includes(jenis) && !body.mp_no && printer.length !== 1) reject("Jenis ini membutuhkan tepat satu printer.");
  if (jenis === "back_up" && printer.length && printer[0].peran !== "utama") reject("Pilih unit bermasalah sebagai objek Tiket.");
  if (jenis === "kontrak" && body.mode === "tukar" && printer.length && printer[0].peran !== "unit_lama") reject("Pilih unit lama sebagai objek Tiket.");
  if (new Set(printer.map((p) => p.mp_no.toLowerCase())).size !== printer.length) reject("MP No tidak boleh berulang dalam satu tiket.");
  if (body.mp_no && printer.length && body.mp_no !== printer[0].mp_no) reject("MP No dan printer objek tidak cocok.");
  const directUnit = body.mp_no && !printer.length && jenis !== "penerimaan_printer" && jenis !== "toner_purchase"
    ? await tx.master_printer.findUnique({ where: { mp_no: body.mp_no } }) : null;
  if (body.mp_no && !printer.length && jenis !== "penerimaan_printer" && jenis !== "toner_purchase" && !directUnit) reject("MP No objek tidak ditemukan.");
  if (jenis === "penerimaan_printer" && body.mp_no && await tx.master_printer.count({ where: { mp_no: body.mp_no } })) reject(`MP No ${body.mp_no} sudah ada.`, 409);

  const lines = directUnit ? [{ printer_id: directUnit.id, mp_no: directUnit.mp_no, peran: jenis === "kontrak" && body.mode === "tukar" ? "unit_lama" : "utama" }] : printer;
  for (const line of lines) {
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
      const fromTrial = await tx.tiket.findUnique({ where: { id: body.tiket_asal_id }, select: { mp_no: true } });
      if (fromTrial?.mp_no !== unit.mp_no || unit.customer_id !== customerId || unit.penempatan !== "trial") reject("Unit KONTRAK harus berasal dari Tiket TRIAL pada customer yang sama.");
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
  if (body.kategori === "delivery" && (body.mp_no || body.printer.length)) reject("Tiket Delivery tidak menggunakan Unit Printer.", 422);
  if (["delivery", "komplain", "maintenance"].includes(body.kategori) || body.jenis === "return") {
    if (!body.account_id || !body.customer_id) reject("Account dan Customer wajib dipilih.");
  }
  if (body.customer_id || body.account_id) await pastikanCustomerAccount(tx, body.account_id, body.customer_id);
  const ownerId = body.owner || body.sales_id;
  if (["delivery", "komplain"].includes(body.kategori) && !ownerId) reject("Owner wajib dipilih.");
  if (ownerId) {
    const owner = await tx.master_pengguna.findUnique({ where: { id: ownerId } });
    if (!owner?.aktif) reject("Owner harus user aktif.");
  }
  if (body.jenis) {
    if (["trial", "event"].includes(body.jenis) && !body.tanggal_akhir) reject("Tanggal akhir wajib diisi.");
    if (body.jenis === "return" && !body.alasan) reject("Alasan Return wajib diisi.");
    if (body.jenis === "internal_use" && !body.lokasi_internal) reject("Divisi/lokasi internal wajib diisi.");
    if (body.jenis === "back_up" && !["sementara", "permanen"].includes(body.mode)) reject("Pilih mode BACK-UP sementara atau permanen.");
    if (body.jenis === "kontrak" && !["baru", "tukar"].includes(body.mode)) reject("Pilih mode KONTRAK baru atau tukar.");
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
      { id: { contains: query.cari, mode: "insensitive" } },
      { deskripsi: { contains: query.cari, mode: "insensitive" } }
    ] } : {})
  };
  if (role(req) === "sales") where.AND = [{ OR: [{ owner: req.pengguna.user_id }, { dibuat_oleh: req.pengguna.user_id }] }];
  if (role(req) === "teknisi") where.surat_tugas = { some: { teknisi_surat_tugas: { some: { teknisi_id: req.pengguna.user_id } } } };
  const [total, items] = await Promise.all([
    prisma.tiket.count({ where }),
    prisma.tiket.findMany({ where, include, orderBy: { tanggal_dibuat: "desc" }, skip: (query.halaman - 1) * query.batas, take: query.batas })
  ]);
  const itemsApi = await Promise.all(items.map(async (item) => ({
    ...tiketApi(item),
    surat_tugas: await Promise.all(item.surat_tugas.map((surat) => suratTugasApi(prisma, surat)))
  })));
  return sukses(res, "Tiket berhasil diambil.", { items: itemsApi, meta: { halaman: query.halaman, batas: query.batas, total } });
}));

router.get("/:id", izin("tiket", "view", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  await terapkanSlaPendingKomplain();
  const item = await prisma.tiket.findUnique({ where: { id: req.params.id }, include: { ...include, master_pengguna_owner: true, master_pengguna_dibuat: true, surat_tugas: { include: { teknisi_surat_tugas: true }, orderBy: { tanggal_dibuat: "desc" } } } });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  if (!bolehLihat(req, item)) return gagal(res, "Anda tidak memiliki akses ke tiket ini.", 403);
  return sukses(res, "Tiket berhasil diambil.", {
    ...tiketApi(item),
    surat_tugas: await Promise.all(item.surat_tugas.map((surat) => suratTugasApi(prisma, surat)))
  });
}));

router.post("/", izin("tiket", "create", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const body = bodySchema.parse(req.body);
  assertOwner(req, body.kategori);
  const created = await prisma.$transaction(async (tx) => {
    await validasiBody(tx, body);
    let kontrakId = body.kontrak_id || null;
    if (body.jenis === "back_up" && body.mode === "permanen") {
      const original = body.printer[0];
      const unit = original?.printer_id
        ? await tx.master_printer.findUnique({ where: { id: original.printer_id } })
        : await tx.master_printer.findUnique({ where: { mp_no: body.mp_no || "" } });
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
    const { printer, ...data } = body;
    const objectLine = printer.find((line) => line.peran === (body.jenis === "kontrak" && body.mode === "tukar" ? "unit_lama" : "utama")) || printer[0];
    const account = body.account_id ? await tx.master_account.findUnique({ where: { id: body.account_id }, select: { kode_account: true } }) : null;
    const customer = body.customer_id ? await tx.master_customer.findUnique({ where: { id: body.customer_id }, select: { kode_customer: true } }) : null;
    const ownerId = body.owner || body.sales_id;
    const owner = ownerId ? await tx.master_pengguna.findUnique({ where: { id: ownerId }, select: { user_id: true } }) : null;
    const item = await tx.tiket.create({ data: {
      ...data,
      account_id: account?.kode_account || null,
      customer_id: customer?.kode_customer || null,
      owner: owner?.user_id || null,
      kontrak_id: kontrakId,
      tanggal_transaksi: body.tanggal_transaksi ? new Date(body.tanggal_transaksi) : new Date(),
      tanggal_akhir: body.tanggal_akhir ? new Date(body.tanggal_akhir) : null,
      id: buatNomor("TKT"),
      jenis: body.jenis || "",
      mp_no: body.mp_no || objectLine?.mp_no || null,
      dibuat_oleh: req.pengguna.user_id,
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
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: item.id, tabel_sumber: "tiket", id_sumber: item.id, aksi: "buat", status_sesudah: "new", data_sesudah: { ...item, kontrak_id: kontrakId, printer }, keterangan: "Tiket dibuat." });
    return tx.tiket.findUnique({ where: { id: item.id }, include: { ...include, master_pengguna_owner: true, master_pengguna_dibuat: true } });
  });
  return sukses(res, "Tiket berhasil dibuat.", tiketApi(created), 201);
}));

router.put("/:id", izin("tiket", "update", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  if (req.body?.printer_ids !== undefined) reject("Unit Printer pada Tiket tidak dapat diubah.");
  const body = z.object({ deskripsi: z.string().optional().nullable(), tanggal_akhir: z.string().datetime({ offset: true }).optional().nullable(), alasan: z.string().optional().nullable(), hasil: z.string().optional().nullable(), lokasi_internal: z.string().optional().nullable(), owner: z.string().uuid().optional(), sales_id: z.string().uuid().optional(), tanggal_transaksi: z.string().datetime({ offset: true }).optional() }).parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const before = await tx.tiket.findUnique({ where: { id: req.params.id } });
    if (!before) return null;
    assertOwner(req, before.kategori);
    if (["solved", "cancelled"].includes(before.status)) reject("Tiket selesai tidak dapat diedit.", 409);
    const ownerId = body.owner || body.sales_id;
    if (ownerId) {
      const owner = await tx.master_pengguna.findUnique({ where: { id: ownerId } });
      if (!owner?.aktif) reject("Owner harus user aktif.");
    }
    const owner = ownerId ? await tx.master_pengguna.findUnique({ where: { id: ownerId }, select: { user_id: true } }) : null;
    const { sales_id, owner: ownerInput, ...rest } = body;
    const after = await tx.tiket.update({ where: { id: before.id }, data: { ...rest, ...(ownerId ? { owner: owner?.user_id } : {}), ...(body.tanggal_transaksi ? { tanggal_transaksi: new Date(body.tanggal_transaksi) } : {}), ...(body.tanggal_akhir !== undefined ? { tanggal_akhir: body.tanggal_akhir ? new Date(body.tanggal_akhir) : null } : {}), tanggal_diperbarui: new Date() } });
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: after.id, tabel_sumber: "tiket", id_sumber: after.id, aksi: "ubah", data_sebelum: before, data_sesudah: after, keterangan: "Tiket diperbarui." });
    return after;
  });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  return sukses(res, "Tiket diperbarui.", tiketApi(item));
}));

router.post("/:id/resolve", izin("tiket", "resolve", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const item = await prisma.$transaction(async (tx) => {
    const before = await tx.tiket.findUnique({ where: { id: req.params.id }, include: { surat_tugas: true } });
    if (!before) return null;
    if (role(req) !== "admin") reject("Penutupan Tiket sementara hanya dapat dilakukan oleh admin.", 403);
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
      const replacementLine = await tx.surat_tugas_printer.findFirst({ where: { peran: "pengganti", surat_tugas: { tiket_id: before.id, jenis_tugas: "kirim_back_up", status: "solved" } }, orderBy: { disetujui_kepala_pada: "desc" } });
      const beforeReplacement = replacementLine ? await tx.master_printer.findUnique({ where: { mp_no: replacementLine.mp_no } }) : null;
      const originalNow = before.mp_no ? await tx.master_printer.findUnique({ where: { mp_no: before.mp_no } }) : null;
      if (beforeReplacement?.penempatan !== "back_up" || beforeReplacement.customer_id !== before.customer_id || originalNow?.kondisi !== "checking" || originalNow.lokasi_jenis !== "gudang") reject("Pengganti harus sudah diserahkan dan unit lama diterima Warehouse.", 409);
      const afterReplacement = await tx.master_printer.update({ where: { id: beforeReplacement.id }, data: { penempatan: "kontrak", kontrak_id: before.kontrak_id, tanggal_diperbarui: new Date() } });
      await catatAuditBarang(tx, req, { jenis_barang: "printer", aksi: "backup_permanen", sebelum: beforeReplacement, sesudah: afterReplacement, referensi: { jenis: "tiket", id: before.id, nomor: before.id }, keterangan: "Unit BACK-UP permanen menjadi KONTRAK." });
    }
    const after = await tx.tiket.findUnique({ where: { id: before.id } });
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: after.id, tabel_sumber: "tiket", id_sumber: after.id, aksi: "resolve", status_sebelum: before.status, status_sesudah: "solved", data_sebelum: before, data_sesudah: after, keterangan: "Tiket diselesaikan." });
    return after;
  });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  return sukses(res, "Tiket selesai.", tiketApi(item));
}));

router.post("/:id/cancel", izin("tiket", "update", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const item = await prisma.$transaction(async (tx) => {
    const before = await tx.tiket.findUnique({ where: { id: req.params.id }, include: { surat_tugas: true } });
    if (!before) return null;
    assertOwner(req, before.kategori);
    if (["solved", "cancelled"].includes(before.status)) reject("Tiket sudah ditutup.", 409);
    if (before.surat_tugas.some((st) => st.status !== "cancelled")) reject("Batalkan seluruh ST terkait terlebih dahulu.", 409);
    const claimed = await tx.tiket.updateMany({ where: { id: before.id, status: before.status }, data: { status: "cancelled", tanggal_diperbarui: new Date() } });
    if (claimed.count !== 1) reject("Tiket sudah berubah; muat ulang sebelum mencoba lagi.", 409);
    const after = await tx.tiket.findUnique({ where: { id: before.id } });
    if (before.jenis === "kontrak" && before.mode === "baru" && before.kontrak_id) {
      await tx.master_kontrak.updateMany({ where: { id: before.kontrak_id, status: "draft" }, data: { status: "dibatalkan" } });
    }
    await catatAudit(tx, req, { jenis_dokumen: "tiket", nomor_dokumen: after.id, tabel_sumber: "tiket", id_sumber: after.id, aksi: "batalkan", status_sebelum: before.status, status_sesudah: "cancelled", data_sebelum: before, data_sesudah: after, keterangan: "Tiket dibatalkan." });
    return after;
  });
  if (!item) return gagal(res, "Tiket tidak ditemukan.", 404);
  return sukses(res, "Tiket dibatalkan.", tiketApi(item));
}));

module.exports = router;
