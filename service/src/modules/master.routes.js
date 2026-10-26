const { z } = require("zod");
const { buatCrudRouter } = require("./crud");
const prisma = require("../config/prisma");

const boolOpsional = z.boolean().optional();
const teksOpsional = z.string().optional().nullable();
const stokTerisi = {
  OR: [
    { jumlah_tersedia: { not: 0 } },
    { jumlah_dicadangkan: { not: 0 } }
  ]
};
const hardDeleteToner = {
  hardDelete: true,
  relationChecks: [
    { model: "stok_toner", field: "toner_id", label: "Stok Toner", where: stokTerisi },
    { model: "detail_mutasi_stok", field: "toner_id", label: "Mutasi Stok" },
    { model: "pemakaian_barang_surat_tugas", field: "toner_id", label: "Item Surat Tugas" }
  ]
};
const hardDeleteSukuCadang = {
  hardDelete: true,
  relationChecks: [
    { model: "stok_suku_cadang", field: "suku_cadang_id", label: "Stok Sparepart", where: stokTerisi },
    { model: "detail_mutasi_stok", field: "suku_cadang_id", label: "Mutasi Stok" },
    { model: "pemakaian_barang_surat_tugas", field: "suku_cadang_id", label: "Item Surat Tugas" }
  ]
};
const hardDeleteGudang = {
  hardDelete: true,
  relationChecks: [
    { model: "master_printer", field: "gudang_id", label: "Printer" },
    { model: "stok_toner", field: "gudang_id", label: "Stok Toner" },
    { model: "stok_suku_cadang", field: "gudang_id", label: "Stok Sparepart" },
    { model: "mutasi_stok", field: "gudang_asal_id", label: "Mutasi Stok" },
    { model: "mutasi_stok", field: "gudang_tujuan_id", label: "Mutasi Stok" },
    { model: "pemakaian_barang_surat_tugas", field: "gudang_id", label: "Item Surat Tugas" }
  ]
};

async function hapusMasterDenganStokKosong(masterModel, stokModel, itemField, item, tx = prisma) {
  await tx[stokModel].deleteMany({
    where: { [itemField]: item.id, jumlah_tersedia: 0, jumlah_dicadangkan: 0 }
  });
  await tx[masterModel].delete({ where: { id: item.id } });
}

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

const kontrak = buatCrudRouter({
  model: "master_kontrak",
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
  })
});

const toner = buatCrudRouter({
  model: "master_toner",
  auditBarangJenis: "toner",
  ...hardDeleteToner,
  deleteItem: (item, req, tx) => hapusMasterDenganStokKosong("master_toner", "stok_toner", "toner_id", item, tx),
  roleLihat: ["admin", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"],
  staticRoleView: true,
  kolomCari: ["kode_toner", "nama_toner", "warna", "tipe"],
  skemaBuat: skemaToner,
  skemaUbah: skemaToner.partial()
});

const sukuCadang = buatCrudRouter({
  model: "master_suku_cadang",
  auditBarangJenis: "suku_cadang",
  ...hardDeleteSukuCadang,
  deleteItem: (item, req, tx) => hapusMasterDenganStokKosong("master_suku_cadang", "stok_suku_cadang", "suku_cadang_id", item, tx),
  roleLihat: ["admin", "kepala-teknisi", "teknisi", "warehouse"],
  staticRoleView: true,
  kolomCari: ["kode_suku_cadang", "nama_suku_cadang"],
  skemaBuat: skemaSukuCadang,
  skemaUbah: skemaSukuCadang.partial()
});

const gudang = buatCrudRouter({
  model: "master_gudang",
  ...hardDeleteGudang,
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
  })
});

module.exports = {
  kontrak,
  toner,
  sukuCadang,
  gudang
};
