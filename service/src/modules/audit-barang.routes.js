const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses } = require("../utils/response");
const { autentikasi, izin } = require("../middlewares/auth");
const { sumber } = require("./audit-barang.service");

const router = express.Router();
const lihat = izin("audit_trail", "view", "sales-admin", "kepala-teknisi", "warehouse");
const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const querySchema = z.object({
  jenis_barang: z.enum(["printer", "toner", "suku_cadang"]).optional(),
  barang: z.string().trim().max(150).optional(),
  barang_id: z.string().uuid().optional(),
  tanggal_mulai: tanggal,
  tanggal_selesai: tanggal,
  user: z.string().trim().max(150).optional(),
  event: z.string().trim().max(50).optional(),
  halaman: z.coerce.number().int().min(1).default(1),
  batas: z.coerce.number().int().min(1).max(100).default(20)
});

const eventNames = {
  snapshot_awal: "Snapshot Awal", buat: "Barang Dibuat", ubah: "Master Diperbarui",
  nonaktifkan: "Barang Dinonaktifkan", hapus_permanen: "Barang Dihapus",
  reservasi: "Unit Direservasi", lepas_reservasi: "Reservasi Dilepas",
  pindah_gudang: "Pindah Gudang", keluarkan: "Unit Dikeluarkan",
  retur_gudang: "Unit Kembali ke Gudang", keluar_gudang: "Unit Keluar Gudang",
  pasang_customer: "Unit Dipasang di Customer", masuk: "Stok Masuk",
  maintenance_mulai: "Maintenance Dimulai", maintenance_selesai: "Maintenance Selesai", maintenance_dibatalkan: "Maintenance Dibatalkan",
  keluar: "Stok Keluar", transfer: "Transfer Stok", penyesuaian: "Penyesuaian Stok",
  pemakaian: "Pemakaian Surat Tugas"
};

function lokasiStok(snapshot, gudangId) {
  return snapshot?.stok?.find((row) => row.gudang_id === gudangId) || null;
}

function format(item) {
  const jenis = Object.keys(sumber).find((key) => sumber[key].dokumen === item.jenis_dokumen);
  const sebelum = item.data_sebelum || {};
  const sesudah = item.data_sesudah || {};
  const perubahan = sesudah.perubahan || {};
  const asal = lokasiStok(sebelum, perubahan.gudang_asal_id);
  const tujuan = lokasiStok(sesudah, perubahan.gudang_tujuan_id);
  return {
    ...item,
    jenis_barang: jenis,
    barang_id: item.id_sumber,
    kode_barang: item.nomor_dokumen,
    event_nama: eventNames[item.aksi] || item.aksi,
    lokasi_asal: asal?.nama_gudang || sebelum.lokasi_nama || null,
    lokasi_tujuan: tujuan?.nama_gudang || sesudah.lokasi_nama || null,
    jumlah: perubahan.jumlah ?? null,
    saldo_sebelum: sebelum.stok || null,
    saldo_sesudah: sesudah.stok || null,
    referensi: sesudah.referensi || null
  };
}

async function whereDariQuery(query) {
  const where = {
    jenis_dokumen: query.jenis_barang ? sumber[query.jenis_barang].dokumen : { in: Object.values(sumber).map((item) => item.dokumen) }
  };
  if (query.barang_id) where.id_sumber = query.barang_id;
  if (query.event) where.aksi = query.event;
  if (query.user) where.nama_pengguna = { contains: query.user, mode: "insensitive" };
  if (query.tanggal_mulai || query.tanggal_selesai) {
    where.tanggal_audit = {
      ...(query.tanggal_mulai ? { gte: new Date(`${query.tanggal_mulai}T00:00:00+07:00`) } : {}),
      ...(query.tanggal_selesai ? { lt: new Date(new Date(`${query.tanggal_selesai}T00:00:00+07:00`).getTime() + 86400000) } : {})
    };
  }
  if (query.barang) {
    const keyword = query.barang;
    const [printer, toner, sparepart, historic] = await Promise.all([
      prisma.master_printer.findMany({ where: { OR: [{ mp_no: { contains: keyword, mode: "insensitive" } }, { serial_number: { contains: keyword, mode: "insensitive" } }] }, select: { id: true } }),
      prisma.master_toner.findMany({ where: { kode_toner: { contains: keyword, mode: "insensitive" } }, select: { id: true } }),
      prisma.master_suku_cadang.findMany({ where: { kode_suku_cadang: { contains: keyword, mode: "insensitive" } }, select: { id: true } }),
      prisma.riwayat_audit.findMany({ where: { jenis_dokumen: { in: Object.values(sumber).map((item) => item.dokumen) }, nomor_dokumen: { contains: keyword, mode: "insensitive" } }, select: { id_sumber: true }, distinct: ["id_sumber"] })
    ]);
    const ids = [...printer, ...toner, ...sparepart].map((row) => row.id).concat(historic.map((row) => row.id_sumber));
    if (!query.barang_id) where.id_sumber = { in: [...new Set(ids)] };
  }
  return where;
}

router.use(autentikasi, lihat);

router.get("/", asyncHandler(async (req, res) => {
  const query = querySchema.parse(req.query);
  if (!query.jenis_barang && !query.barang && !query.barang_id && !query.tanggal_mulai && !query.tanggal_selesai && !query.user && !query.event) {
    return sukses(res, "Pilih filter untuk menampilkan audit barang.", { items: [], meta: { halaman: query.halaman, batas: query.batas, total: 0 } });
  }
  const where = await whereDariQuery(query);
  const [total, items] = await Promise.all([
    prisma.riwayat_audit.count({ where }),
    prisma.riwayat_audit.findMany({ where, orderBy: [{ tanggal_audit: "desc" }, { id: "desc" }], skip: (query.halaman - 1) * query.batas, take: query.batas })
  ]);
  return sukses(res, "Audit barang berhasil diambil.", { items: items.map(format), meta: { halaman: query.halaman, batas: query.batas, total } });
}));

router.get("/:jenis/:id", asyncHandler(async (req, res) => {
  const { jenis, id } = z.object({ jenis: z.enum(["printer", "toner", "suku_cadang"]), id: z.string().uuid() }).parse(req.params);
  const { halaman, batas } = querySchema.pick({ halaman: true, batas: true }).parse(req.query);
  const where = { jenis_dokumen: sumber[jenis].dokumen, id_sumber: id };
  const [total, items] = await Promise.all([
    prisma.riwayat_audit.count({ where }),
    prisma.riwayat_audit.findMany({ where, orderBy: [{ tanggal_audit: "desc" }, { id: "desc" }], skip: (halaman - 1) * batas, take: batas })
  ]);
  return sukses(res, "Riwayat barang berhasil diambil.", { items: items.map(format), meta: { halaman, batas, total } });
}));

module.exports = router;
