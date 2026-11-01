const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses, gagal } = require("../utils/response");
const { autentikasi, izin, otorisasi } = require("../middlewares/auth");

const router = express.Router();
const lihat = otorisasi("sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse");
const teksOpsional = z.string().optional().nullable();
const skemaCustomer = z.object({
  kode_customer: z.string().trim().min(1).max(50),
  nama_customer: z.string().trim().min(1).max(200),
  alamat: z.string().trim().min(1),
  nama_pic: teksOpsional,
  telepon_pic: teksOpsional,
  email_pic: z.string().email().optional().nullable().or(z.literal("")),
  aktif: z.boolean().optional()
});
const skemaAccount = z.object({
  kode_account: z.string().trim().min(1).max(50),
  nama_account: z.string().trim().min(1).max(200),
  npwp: teksOpsional,
  telepon: teksOpsional,
  email: z.string().email().optional().nullable().or(z.literal("")),
  alamat_penagihan: teksOpsional,
  aktif: z.boolean().optional()
});
const daftarQuery = z.object({
  halaman: z.coerce.number().int().min(1).default(1),
  batas: z.coerce.number().int().min(1).max(100).default(20),
  cari: z.string().optional()
});

function konflik(pesan) {
  return Object.assign(new Error(pesan), { statusCode: 409 });
}

async function kunciAccount(tx, accountId) {
  const rows = await tx.$queryRaw`SELECT id FROM master_account WHERE id = ${accountId}::uuid FOR UPDATE`;
  if (!rows.length) throw Object.assign(new Error("Account tidak ditemukan."), { statusCode: 404 });
}

async function relasiCustomer(tx, customerId) {
  const [kontrak, printer, komplain, surat, tiket] = await Promise.all([
    tx.master_kontrak.count({ where: { customer_id: customerId } }),
    tx.master_printer.count({ where: { customer_id: customerId } }),
    tx.pengaduan.count({ where: { customer_id: customerId } }),
    tx.surat_tugas.count({ where: { customer_id: customerId } }),
    tx.tiket.count({ where: { customer_id: customerId } })
  ]);
  return kontrak + printer + komplain + surat + tiket;
}

async function daftarCustomer(tx, accountId) {
  const rows = await tx.master_customer.findMany({
    where: { account_id: accountId },
    orderBy: { tanggal_dibuat: "asc" }
  });
  return Promise.all(rows.map(async (row) => ({
    ...row,
    boleh_hapus_permanen: rows.length > 1 && !(await relasiCustomer(tx, row.id))
  })));
}

router.use(autentikasi);

router.get("/", lihat, asyncHandler(async (req, res) => {
  const query = daftarQuery.parse(req.query);
  const where = query.cari ? {
    OR: ["kode_account", "nama_account", "npwp", "telepon"].map((field) => ({
      [field]: { contains: query.cari, mode: "insensitive" }
    }))
  } : {};
  const [total, rows] = await Promise.all([
    prisma.master_account.count({ where }),
    prisma.master_account.findMany({
      where,
      include: { _count: { select: { master_customer: { where: { aktif: true } } } } },
      orderBy: { tanggal_dibuat: "desc" },
      skip: (query.halaman - 1) * query.batas,
      take: query.batas
    })
  ]);
  const items = await Promise.all(rows.map(async (row) => {
    const children = await prisma.master_customer.findMany({ where: { account_id: row.id }, select: { id: true } });
    const used = await Promise.all(children.map((child) => relasiCustomer(prisma, child.id)));
    return {
      ...row,
      jumlah_customer: row._count.master_customer,
      boleh_hapus_permanen: !used.some(Boolean)
    };
  }));
  return sukses(res, "Account berhasil diambil.", {
    items,
    meta: { halaman: query.halaman, batas: query.batas, total }
  });
}));

router.get("/lokasi-customer", lihat, asyncHandler(async (req, res) => {
  const query = daftarQuery.parse(req.query);
  const where = query.cari ? {
    OR: [
      ...["kode_customer", "nama_customer", "alamat"].map((field) => ({
        [field]: { contains: query.cari, mode: "insensitive" }
      })),
      { master_account: { nama_account: { contains: query.cari, mode: "insensitive" } } }
    ]
  } : {};
  const [total, rows] = await Promise.all([
    prisma.master_customer.count({ where }),
    prisma.master_customer.findMany({
      where,
      include: { master_account: { select: { id: true, kode_account: true, nama_account: true, aktif: true } } },
      orderBy: [{ master_account: { nama_account: "asc" } }, { nama_customer: "asc" }],
      skip: (query.halaman - 1) * query.batas,
      take: query.batas
    })
  ]);
  const items = await Promise.all(rows.map(async (row) => {
    const [totalAccount, activeAccount, relations] = await Promise.all([
      prisma.master_customer.count({ where: { account_id: row.account_id } }),
      prisma.master_customer.count({ where: { account_id: row.account_id, aktif: true } }),
      relasiCustomer(prisma, row.id)
    ]);
    return {
      ...row,
      boleh_nonaktifkan: row.aktif && activeAccount > 1,
      boleh_hapus_permanen: totalAccount > 1 && !relations
    };
  }));
  return sukses(res, "Lokasi customer berhasil diambil.", {
    items,
    meta: { halaman: query.halaman, batas: query.batas, total }
  });
}));

router.get("/:id", lihat, asyncHandler(async (req, res) => {
  const account = await prisma.master_account.findUnique({
    where: { id: req.params.id },
    include: { master_customer: { orderBy: { tanggal_dibuat: "asc" } } }
  });
  if (!account) return gagal(res, "Account tidak ditemukan.", 404);
  return sukses(res, "Account berhasil diambil.", account);
}));

router.post("/", izin("master_data", "create", "admin"), asyncHandler(async (req, res) => {
  const body = skemaAccount.extend({ customer_pertama: skemaCustomer.optional() }).parse(req.body);
  if (body.customer_pertama && (body.aktif === false || body.customer_pertama.aktif === false)) {
    return gagal(res, "Account dan Customer pertama harus aktif.", 422);
  }
  const { customer_pertama, ...accountData } = body;
  const item = await prisma.master_account.create({
    data: { ...accountData, ...(customer_pertama ? { master_customer: { create: customer_pertama } } : {}) },
    include: { master_customer: true }
  });
  return sukses(res, customer_pertama ? "Account dan Customer pertama berhasil dibuat." : "Account berhasil dibuat.", item, 201);
}));

router.put("/:id", izin("master_data", "update", "admin"), asyncHandler(async (req, res) => {
  const body = skemaAccount.partial().parse(req.body);
  const item = await prisma.master_account.update({ where: { id: req.params.id }, data: body });
  return sukses(res, "Account berhasil diperbarui.", item);
}));

router.delete("/:id/permanent", izin("master_data", "delete", "admin"), asyncHandler(async (req, res) => {
  await prisma.$transaction(async (tx) => {
    await kunciAccount(tx, req.params.id);
    const children = await tx.master_customer.findMany({ where: { account_id: req.params.id }, select: { id: true } });
    for (const child of children) {
      if (await relasiCustomer(tx, child.id)) throw konflik("Account masih dipakai oleh data lain.");
    }
    await tx.master_customer.deleteMany({ where: { account_id: req.params.id } });
    await tx.master_account.delete({ where: { id: req.params.id } });
  });
  return sukses(res, "Account berhasil dihapus permanen.");
}));

router.delete("/:id", izin("master_data", "delete", "admin"), asyncHandler(async (req, res) => {
  const item = await prisma.master_account.update({ where: { id: req.params.id }, data: { aktif: false } });
  return sukses(res, "Account berhasil dinonaktifkan.", item);
}));

router.get("/:id/customer", lihat, asyncHandler(async (req, res) => {
  const account = await prisma.master_account.findUnique({ where: { id: req.params.id } });
  if (!account) return gagal(res, "Account tidak ditemukan.", 404);
  return sukses(res, "Customer berhasil diambil.", { items: await daftarCustomer(prisma, account.id) });
}));

router.post("/:id/customer", izin("master_data", "create", "admin"), asyncHandler(async (req, res) => {
  const body = skemaCustomer.parse(req.body);
  const account = await prisma.master_account.findUnique({ where: { id: req.params.id } });
  if (!account?.aktif) return gagal(res, "Pilih Account aktif.", 422);
  const item = await prisma.master_customer.create({ data: { ...body, account_id: account.id } });
  return sukses(res, "Customer berhasil dibuat.", item, 201);
}));

router.put("/:id/customer/:customerId", izin("master_data", "update", "admin"), asyncHandler(async (req, res) => {
  const body = skemaCustomer.partial().parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    await kunciAccount(tx, req.params.id);
    const current = await tx.master_customer.findUnique({ where: { id: req.params.customerId } });
    if (!current) return null;
    const targetAccount = await tx.master_account.findUnique({ where: { id: req.params.id } });
    if (!targetAccount?.aktif) throw konflik("Pilih Billing aktif.");
    if (body.aktif === false && current.aktif) {
      const active = await tx.master_customer.count({ where: { account_id: current.account_id, aktif: true } });
      if (active <= 1) throw konflik("Customer aktif terakhir tidak dapat dinonaktifkan.");
    }
    return tx.master_customer.update({ where: { id: current.id }, data: { ...body, account_id: req.params.id } });
  });
  if (!item) return gagal(res, "Customer tidak ditemukan.", 404);
  return sukses(res, "Customer berhasil diperbarui.", item);
}));

router.delete("/:id/customer/:customerId/permanent", izin("master_data", "delete", "admin"), asyncHandler(async (req, res) => {
  await prisma.$transaction(async (tx) => {
    await kunciAccount(tx, req.params.id);
    const children = await tx.master_customer.findMany({ where: { account_id: req.params.id }, select: { id: true } });
    if (!children.some((child) => child.id === req.params.customerId)) {
      throw Object.assign(new Error("Customer tidak ditemukan."), { statusCode: 404 });
    }
    if (children.length <= 1) throw konflik("Customer terakhir pada Account tidak dapat dihapus.");
    if (await relasiCustomer(tx, req.params.customerId)) throw konflik("Customer masih dipakai oleh data lain.");
    await tx.master_customer.delete({ where: { id: req.params.customerId } });
  });
  return sukses(res, "Customer berhasil dihapus permanen.");
}));

router.delete("/:id/customer/:customerId", izin("master_data", "delete", "admin"), asyncHandler(async (req, res) => {
  const item = await prisma.$transaction(async (tx) => {
    await kunciAccount(tx, req.params.id);
    const current = await tx.master_customer.findFirst({ where: { id: req.params.customerId, account_id: req.params.id } });
    if (!current) return null;
    if (current.aktif) {
      const active = await tx.master_customer.count({ where: { account_id: req.params.id, aktif: true } });
      if (active <= 1) throw konflik("Customer aktif terakhir tidak dapat dinonaktifkan.");
    }
    return tx.master_customer.update({ where: { id: current.id }, data: { aktif: false } });
  });
  if (!item) return gagal(res, "Customer tidak ditemukan.", 404);
  return sukses(res, "Customer berhasil dinonaktifkan.", item);
}));

module.exports = router;
