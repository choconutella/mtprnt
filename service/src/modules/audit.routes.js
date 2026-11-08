const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses } = require("../utils/response");
const { autentikasi, izin } = require("../middlewares/auth");

const router = express.Router();

router.use(autentikasi);

const querySchema = z.object({
  tanggal_mulai: z.string().optional(),
  tanggal_selesai: z.string().optional(),
  user: z.string().optional(),
  nomor_tiket: z.string().optional(),
  nomor_surat_tugas: z.string().optional(),
  batas: z.coerce.number().int().min(1).max(200).default(100)
});

const eventWorkflow = [
  { kode: "A01", dokumen: "tiket", aksi: "buat", nama: "Tiket Dibuat" },
  { kode: "A02", dokumen: "tiket", aksi: "ubah", nama: "Tiket Diperbarui" },
  { kode: "A03", dokumen: "tiket", aksi: "ubah_status", nama: "Status Tiket Berubah" },
  { kode: "A04", dokumen: "tiket", aksi: "resolve", nama: "Tiket Diselesaikan" },
  { kode: "A05", dokumen: "tiket", aksi: "batalkan", nama: "Tiket Dibatalkan" },
  { kode: "B01", dokumen: "surat_tugas", aksi: "buat", nama: "Surat Tugas Baru Dibuat" },
  { kode: "B02", dokumen: "surat_tugas", aksi: "assign_teknisi", nama: "Teknisi Ditugaskan" },
  { kode: "B03", dokumen: "surat_tugas", aksi: "start", nama: "Surat Tugas Dimulai" },
  { kode: "B04", dokumen: "surat_tugas", aksi: "tambah_item", nama: "Item Surat Tugas Ditambahkan" },
  { kode: "B05", dokumen: "surat_tugas", aksi: "hapus_item", nama: "Item Surat Tugas Dihapus" },
  { kode: "B07", dokumen: "surat_tugas", aksi: "selesai_teknisi", nama: "Pekerjaan Teknisi Selesai" },
  { kode: "B08", dokumen: "surat_tugas", aksi: "validasi_warehouse", nama: "Validasi Warehouse" },
  { kode: "B09", dokumen: "surat_tugas", aksi: "resolve", nama: "Validasi Kepala Teknisi" },
  { kode: "B10", dokumen: "surat_tugas", aksi: "batalkan", nama: "Surat Tugas Dibatalkan" },
  { kode: "B11", dokumen: "surat_tugas", aksi: "keluar_gudang", nama: "Barang Keluar Gudang" },
  { kode: "B12", dokumen: "surat_tugas", aksi: "serah_terima", nama: "Serah Terima Unit" },
  { kode: "B13", dokumen: "surat_tugas", aksi: "terima_gudang", nama: "Unit Diterima Gudang" },
  { kode: "B14", dokumen: "surat_tugas", aksi: "hasil_unit", nama: "Hasil Unit Dicatat" },
  { kode: "B15", dokumen: "surat_tugas", aksi: "selesai_pekerjaan", nama: "Pekerjaan Selesai" }
];

function eventDariAudit(item) {
  const dokumen = item.jenis_dokumen;
  const event = eventWorkflow.find((row) => row.dokumen === dokumen && row.aksi === item.aksi);
  return event || {
    kode: "Z99",
    nama: item.aksi || "Event Lain"
  };
}

function formatAudit(item) {
  const event = eventDariAudit(item);
  const statusText = item.status_sesudah && item.status_sebelum
    ? ` (${item.status_sebelum} -> ${item.status_sesudah})`
    : item.status_sesudah
      ? ` (${item.status_sesudah})`
      : "";
  return {
    ...item,
    event_kode: event.kode,
    event_nama: event.nama,
    event_label: event.nama,
    tabel_keterangan: `${dokumen} ${item.nomor_dokumen}: ${item.keterangan || event.nama}${statusText}`
  };
}

router.get("/", izin("audit_trail", "view", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const query = querySchema.parse(req.query);
  const where = {};
  const OR = [];

  const adaTanggal = Boolean(query.tanggal_mulai || query.tanggal_selesai);
  const adaTarget = Boolean(query.user || query.nomor_tiket || query.nomor_surat_tugas);
  if (!adaTanggal || !adaTarget) {
    return sukses(res, "Lengkapi filter tanggal dan user/surat tugas/tiket untuk menampilkan audit.", []);
  }

  if (query.tanggal_mulai || query.tanggal_selesai) {
    where.tanggal_audit = {};
    if (query.tanggal_mulai) where.tanggal_audit.gte = new Date(`${query.tanggal_mulai}T00:00:00`);
    if (query.tanggal_selesai) where.tanggal_audit.lte = new Date(`${query.tanggal_selesai}T23:59:59.999`);
  }

  if (query.nomor_tiket) {
    OR.push({
      jenis_dokumen: { in: ["tiket"] },
      nomor_dokumen: { contains: query.nomor_tiket, mode: "insensitive" }
    });
  }

  if (query.nomor_surat_tugas) {
    OR.push({
      jenis_dokumen: "surat_tugas",
      nomor_dokumen: { contains: query.nomor_surat_tugas, mode: "insensitive" }
    });
  }

  if (OR.length) where.OR = OR;
  if (query.user) {
    where.nama_pengguna = { contains: query.user, mode: "insensitive" };
  }

  const items = await prisma.riwayat_audit.findMany({
    where,
    orderBy: { tanggal_audit: "desc" },
    take: query.batas
  });

  return sukses(res, "Riwayat audit berhasil diambil.", items.map(formatAudit));
}));

router.get("/tiket/:nomor_tiket", izin("audit_trail", "view", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const items = await prisma.riwayat_audit.findMany({
    where: {
      jenis_dokumen: { in: ["tiket"] },
      nomor_dokumen: req.params.nomor_tiket
    },
    orderBy: { tanggal_audit: "asc" }
  });

  return sukses(res, "Riwayat audit tiket berhasil diambil.", items.map(formatAudit));
}));

router.get("/surat-tugas/:nomor_surat_tugas", izin("audit_trail", "view", "sales-admin", "kepala-teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const items = await prisma.riwayat_audit.findMany({
    where: {
      jenis_dokumen: "surat_tugas",
      nomor_dokumen: req.params.nomor_surat_tugas
    },
    orderBy: { tanggal_audit: "asc" }
  });

  return sukses(res, "Riwayat audit surat tugas berhasil diambil.", items.map(formatAudit));
}));

module.exports = router;
