const prisma = require("../config/prisma");
const { catatAudit } = require("./audit.service");

async function ambilSlaPendingJam() {
  const setting = await prisma.app_pengaturan.findUnique({ where: { kunci: "sla_pending_komplain" } });
  return Number(setting?.nilai?.pending_setelah_jam || 24);
}

async function terapkanSlaPendingKomplain() {
  const jam = await ambilSlaPendingJam();
  const batas = new Date(Date.now() - jam * 60 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const due = await tx.tiket.findMany({ where: { kategori: "komplain", status: "new", tanggal_transaksi: { lte: batas } } });
    let count = 0;
    for (const before of due) {
      const changed = await tx.tiket.updateMany({ where: { id: before.id, status: "new" }, data: { status: "pending", tanggal_diperbarui: new Date() } });
      if (!changed.count) continue;
      count += 1;
      await catatAudit(tx, { pengguna: { nama: "Sistem" }, headers: {} }, {
        jenis_dokumen: "tiket", nomor_dokumen: before.id, tabel_sumber: "tiket", id_sumber: before.id,
        aksi: "ubah_status", status_sebelum: "new", status_sesudah: "pending",
        data_sebelum: before, data_sesudah: { ...before, status: "pending" },
        keterangan: `SLA ${jam} jam terlampaui.`
      });
    }
    return { count };
  });
}

module.exports = { ambilSlaPendingJam, terapkanSlaPendingKomplain };
