const express = require("express");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses, gagal } = require("../utils/response");
const { buatNomor } = require("../utils/nomor");
const { autentikasi, izin } = require("../middlewares/auth");
const { terapkanMutasi } = require("./stok.service");
const { mutasiSchema } = require("./stok.schema");

const router = express.Router();

router.use(autentikasi);

router.get("/", izin("stock_data", "view", "warehouse", "kepala-teknisi", "teknisi"), asyncHandler(async (req, res) => {
  const [stokToner, stokSparepart, printerAvailable] = await Promise.all([
    prisma.stok_toner.findMany({ include: { master_gudang: true, master_toner: true } }),
    prisma.stok_suku_cadang.findMany({ include: { master_gudang: true, master_suku_cadang: true } }),
    prisma.master_printer.count({ where: { status: "available", lokasi_jenis: "gudang", kondisi: "ready" } })
  ]);

  return sukses(res, "Stok berhasil diambil.", {
    toner: stokToner,
    printer: [{ jumlah_tersedia: printerAvailable, jumlah_dicadangkan: 0 }],
    suku_cadang: stokSparepart
  });
}));

router.get("/mutasi", izin("stock_data", "view", "warehouse", "kepala-teknisi"), asyncHandler(async (req, res) => {
  const items = await prisma.mutasi_stok.findMany({
    orderBy: { tanggal_mutasi: "desc" },
    take: 100
  });
  return sukses(res, "Mutasi stok berhasil diambil.", items);
}));

router.post("/mutasi", izin("stock_data", "create", "warehouse"), asyncHandler(async (req, res) => {
  const body = mutasiSchema.parse(req.body);
  const hasil = await prisma.$transaction(async (tx) => {
    const [asal, tujuan] = await Promise.all([
      body.gudang_asal_id ? tx.master_gudang.findUnique({ where: { id: body.gudang_asal_id } }) : null,
      body.gudang_tujuan_id ? tx.master_gudang.findUnique({ where: { id: body.gudang_tujuan_id } }) : null
    ]);
    if ((body.gudang_asal_id && !asal) || (body.gudang_tujuan_id && !tujuan)) throw Object.assign(new Error("Gudang tidak ditemukan."), { statusCode: 422 });
    const detail = await Promise.all(body.detail.map(async (line) => {
      if (line.jenis_barang === "toner") {
        const item = await tx.master_toner.findUnique({ where: { id: line.toner_id }, select: { kode_toner: true } });
        if (!item) throw Object.assign(new Error("Toner tidak ditemukan."), { statusCode: 422 });
        return { ...line, toner_id: item.kode_toner };
      }
      const item = await tx.master_suku_cadang.findUnique({ where: { id: line.suku_cadang_id }, select: { kode_suku_cadang: true } });
      if (!item) throw Object.assign(new Error("Suku cadang tidak ditemukan."), { statusCode: 422 });
      return { ...line, suku_cadang_id: item.kode_suku_cadang };
    }));
    const mutasi = await tx.mutasi_stok.create({
      data: {
        nomor_mutasi: body.nomor_mutasi || buatNomor("MTS"),
        jenis_mutasi: body.jenis_mutasi,
        gudang_asal_id: asal?.kode_gudang || null,
        gudang_tujuan_id: tujuan?.kode_gudang || null,
        jenis_referensi: body.jenis_referensi || "manual",
        referensi_id: body.referensi_id || null,
        status: body.langsung_posting ? "terposting" : "draft",
        keterangan: body.keterangan || null,
        dibuat_oleh: req.pengguna.user_id,
        tanggal_terposting: body.langsung_posting ? new Date() : null
      }
    });

    await tx.detail_mutasi_stok.createMany({
      data: detail.map((line) => ({
        mutasi_stok_id: mutasi.id,
        ...line
      }))
    });

    if (body.langsung_posting) {
      await terapkanMutasi(tx, mutasi, detail, req);
    }

    return mutasi;
  });

  return sukses(res, "Mutasi stok berhasil dibuat.", hasil, 201);
}));

router.post("/mutasi/:id/posting", izin("stock_data", "workflow", "warehouse"), asyncHandler(async (req, res) => {
  const hasil = await prisma.$transaction(async (tx) => {
    const mutasi = await tx.mutasi_stok.findUnique({ where: { id: req.params.id } });
    if (!mutasi) return null;
    if (mutasi.status !== "draft") {
      throw Object.assign(new Error("Mutasi stok sudah diproses."), { statusCode: 409 });
    }

    const detail = await tx.detail_mutasi_stok.findMany({ where: { mutasi_stok_id: mutasi.id } });
    const claimed = await tx.mutasi_stok.updateMany({
      where: { id: mutasi.id, status: "draft" },
      data: { status: "terposting", tanggal_terposting: new Date() }
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("Mutasi stok sudah diproses."), { statusCode: 409 });
    }
    await terapkanMutasi(tx, mutasi, detail, req);

    return tx.mutasi_stok.findUnique({ where: { id: mutasi.id } });
  });

  if (!hasil) return gagal(res, "Mutasi stok tidak ditemukan.", 404);
  return sukses(res, "Mutasi stok berhasil diposting.", hasil);
}));

module.exports = router;
