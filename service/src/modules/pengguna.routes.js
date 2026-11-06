const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses, gagal } = require("../utils/response");
const { autentikasi, izin, otorisasi } = require("../middlewares/auth");
const { ROLE_VALUES, normalisasiRole, tampilkanRole } = require("../utils/roles");

const router = express.Router();

const buatSchema = z.object({
  user_id: z.string().min(1).max(20),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().transform(normalisasiRole).pipe(z.enum(ROLE_VALUES)),
  password: z.string().min(6),
  active: z.boolean().optional()
});

const ubahSchema = buatSchema.partial();

function bersihkan(pengguna) {
  const { kata_sandi_hash, ...data } = pengguna;
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.nama,
    email: data.email,
    role: tampilkanRole(data.peran),
    active: data.aktif,
    tanggal_dibuat: data.tanggal_dibuat,
    tanggal_diperbarui: data.tanggal_diperbarui
  };
}

function toPrismaData(body) {
  return {
    ...(body.user_id !== undefined ? { user_id: body.user_id } : {}),
    ...(body.name !== undefined ? { nama: body.name } : {}),
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.role !== undefined ? { peran: body.role } : {}),
    ...(body.active !== undefined ? { aktif: body.active } : {})
  };
}

router.use(autentikasi);

router.get("/", otorisasi("sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  if (req.query.halaman !== undefined || req.query.batas !== undefined || req.query.cari !== undefined) {
    const query = z.object({ halaman: z.coerce.number().int().min(1).default(1), batas: z.coerce.number().int().min(1).max(100).default(20), cari: z.string().optional() }).parse(req.query);
    const where = { aktif: true, ...(query.cari?.trim() ? { OR: [
      { nama: { contains: query.cari.trim(), mode: "insensitive" } },
      { user_id: { contains: query.cari.trim(), mode: "insensitive" } }
    ] } : {}) };
    const [total, items] = await Promise.all([
      prisma.master_pengguna.count({ where }),
      prisma.master_pengguna.findMany({ where, orderBy: { tanggal_dibuat: "desc" }, skip: (query.halaman - 1) * query.batas, take: query.batas })
    ]);
    return sukses(res, "Data pengguna berhasil diambil.", { items: items.map(bersihkan), meta: { halaman: query.halaman, batas: query.batas, total } });
  }
  const items = await prisma.master_pengguna.findMany({
    orderBy: { tanggal_dibuat: "desc" }
  });
  return sukses(res, "Data pengguna berhasil diambil.", items.map(bersihkan));
}));

router.get("/:id", otorisasi("sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"), asyncHandler(async (req, res) => {
  const item = await prisma.master_pengguna.findUnique({ where: { id: req.params.id } });
  if (!item) return gagal(res, "Pengguna tidak ditemukan.", 404);
  return sukses(res, "Data pengguna berhasil diambil.", bersihkan(item));
}));

router.post("/", izin("master_data", "create", "admin"), asyncHandler(async (req, res) => {
  const body = buatSchema.parse(req.body);
  const item = await prisma.master_pengguna.create({
    data: {
      ...toPrismaData(body),
      kata_sandi_hash: await bcrypt.hash(body.password, 10)
    }
  });
  return sukses(res, "Pengguna berhasil dibuat.", bersihkan(item), 201);
}));

router.put("/:id", izin("master_data", "update", "admin"), asyncHandler(async (req, res) => {
  const body = ubahSchema.parse(req.body);
  const item = await prisma.master_pengguna.update({
    where: { id: req.params.id },
    data: {
      ...toPrismaData(body),
      ...(body.password ? { kata_sandi_hash: await bcrypt.hash(body.password, 10) } : {})
    }
  });
  return sukses(res, "Pengguna berhasil diperbarui.", bersihkan(item));
}));

router.delete("/:id", izin("master_data", "delete", "admin"), asyncHandler(async (req, res) => {
  const item = await prisma.master_pengguna.update({
    where: { id: req.params.id },
    data: { aktif: false }
  });
  return sukses(res, "Pengguna berhasil dinonaktifkan.", bersihkan(item));
}));

module.exports = router;
