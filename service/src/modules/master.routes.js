const { z } = require("zod");
const { buatCrudRouter } = require("./crud");
const prisma = require("../config/prisma");

const boolOpsional = z.boolean().optional();
const teksOpsional = z.string().optional().nullable();

const skemaToner = z.object({
  kode_toner: z.string().trim().min(1),
  nama_toner: z.string().trim().min(1),
  warna: z.string().trim().min(1),
  tipe: z.string().trim().min(1),
  aktif: boolOpsional
});

const skemaSukuCadang = z.object({
  kode_suku_cadang: z.string().trim().min(1),
  nama_suku_cadang: z.string().trim().min(1),
  aktif: boolOpsional
});

async function customerCode(customerId) {
  const row = await prisma.master_customer.findUnique({ where: { id: customerId }, select: { kode_customer: true } });
  if (!row) throw Object.assign(new Error("Customer tidak ditemukan."), { statusCode: 422 });
  return row.kode_customer;
}

async function userCode(userId) {
  if (!userId) return null;
  const row = await prisma.master_pengguna.findUnique({ where: { id: userId }, select: { user_id: true } });
  if (!row) throw Object.assign(new Error("Pengguna tidak ditemukan."), { statusCode: 422 });
  return row.user_id;
}

const kontrak = buatCrudRouter({
  model: "master_kontrak",
  businessKey: "nomor_kontrak",
  roleLihat: ["admin", "sales-admin", "kepala-teknisi", "warehouse"],
  staticRoleView: true,
  kolomCari: ["nomor_kontrak", "jenis_layanan", "status"],
  skemaBuat: z.object({
    customer_id: z.string().uuid(),
    nomor_kontrak: z.string().min(1),
    tanggal_mulai: z.string().min(1),
    tanggal_selesai: z.string().min(1),
    jenis_layanan: z.string().min(1),
    sla_respon_jam: z.number().int().min(0).optional(),
    sla_penyelesaian_jam: z.number().int().min(0).optional(),
    status: z.string().optional(),
    keterangan: teksOpsional
  }),
  beforeCreate: async (data) => { data.customer_id = await customerCode(data.customer_id); },
  beforeUpdate: async (data) => { if (data.customer_id) data.customer_id = await customerCode(data.customer_id); }
});

const toner = buatCrudRouter({
  model: "master_toner",
  businessKey: "kode_toner",
  auditBarangJenis: "toner",
  deleteEnabled: false,
  roleLihat: ["admin", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"],
  staticRoleView: true,
  kolomCari: ["kode_toner", "nama_toner", "warna", "tipe"],
  skemaBuat: skemaToner,
  skemaUbah: skemaToner.partial()
});

const sukuCadang = buatCrudRouter({
  model: "master_suku_cadang",
  businessKey: "kode_suku_cadang",
  auditBarangJenis: "suku_cadang",
  deleteEnabled: false,
  roleLihat: ["admin", "kepala-teknisi", "teknisi", "warehouse"],
  staticRoleView: true,
  kolomCari: ["kode_suku_cadang", "nama_suku_cadang"],
  skemaBuat: skemaSukuCadang,
  skemaUbah: skemaSukuCadang.partial()
});

const gudang = buatCrudRouter({
  model: "master_gudang",
  businessKey: "kode_gudang",
  deleteEnabled: false,
  kolomCari: ["kode_gudang", "nama_gudang", "alamat"],
  roleLihat: ["admin", "kepala-teknisi", "teknisi", "warehouse"],
  staticRoleView: true,
  roleTulis: ["admin", "warehouse"],
  skemaBuat: z.object({
    kode_gudang: z.string().min(1),
    nama_gudang: z.string().min(1),
    jenis_gudang: z.enum(["utama", "cabang", "teknisi"]),
    teknisi_id: z.string().uuid().optional().nullable(),
    alamat: teksOpsional,
    aktif: boolOpsional
  }),
  beforeCreate: async (data) => { data.teknisi_id = await userCode(data.teknisi_id); },
  beforeUpdate: async (data) => { if (data.teknisi_id !== undefined) data.teknisi_id = await userCode(data.teknisi_id); }
});

module.exports = {
  kontrak,
  toner,
  sukuCadang,
  gudang
};
