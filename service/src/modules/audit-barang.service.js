const { catatAudit } = require("./audit.service");

const sumber = {
  printer: { dokumen: "barang_printer", tabel: "master_printer", kode: "mp_no" },
  toner: { dokumen: "barang_toner", tabel: "master_toner", kode: "kode_toner" },
  suku_cadang: { dokumen: "barang_suku_cadang", tabel: "master_suku_cadang", kode: "kode_suku_cadang" }
};

async function potretLokasi(tx, row) {
  if (!row) return null;
  const [gudang, account, customer] = await Promise.all([
    row.gudang_id ? tx.master_gudang.findUnique({ where: { kode_gudang: row.gudang_id }, select: { nama_gudang: true } }) : null,
    row.account_id ? tx.master_account.findUnique({ where: { kode_account: row.account_id }, select: { nama_account: true } }) : null,
    row.customer_id ? tx.master_customer.findUnique({ where: { kode_customer: row.customer_id }, select: { nama_customer: true } }) : null
  ]);
  return {
    ...row,
    lokasi_nama: row.lokasi_jenis === "transit" ? "Dalam pengiriman" : row.lokasi_jenis === "internal" ? row.lokasi_internal || "Internal" : row.lokasi_jenis === "keluar" ? "Dikeluarkan" : customer?.nama_customer || gudang?.nama_gudang || null,
    account_nama: account?.nama_account || null
  };
}

async function catatAuditBarang(tx, req, input) {
  const config = sumber[input.jenis_barang];
  if (!config) throw new Error("Jenis barang audit tidak dikenal.");
  const row = input.sesudah || input.sebelum;
  const sebelum = input.jenis_barang === "printer" ? await potretLokasi(tx, input.sebelum) : input.sebelum;
  const sesudah = input.jenis_barang === "printer" ? await potretLokasi(tx, input.sesudah) : input.sesudah;
  return catatAudit(tx, req, {
    jenis_dokumen: config.dokumen,
    nomor_dokumen: row[config.kode],
    tabel_sumber: config.tabel,
    id_sumber: row.id,
    aksi: input.aksi,
    status_sebelum: input.sebelum?.status || (input.sebelum?.aktif === false ? "nonaktif" : input.sebelum?.aktif === true ? "aktif" : null),
    status_sesudah: input.sesudah?.status || (input.sesudah?.aktif === false ? "nonaktif" : input.sesudah?.aktif === true ? "aktif" : null),
    data_sebelum: sebelum,
    data_sesudah: sesudah ? { ...sesudah, perubahan: input.perubahan || null, referensi: input.referensi || null } : null,
    keterangan: input.keterangan || null
  });
}

module.exports = { catatAuditBarang, sumber };
