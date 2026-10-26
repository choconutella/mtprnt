const prisma = require("../config/prisma");
const { buatNomor } = require("../utils/nomor");
const { catatAudit } = require("./audit.service");

const DAY_MS = 24 * 60 * 60 * 1000;

function tanggalBangkok(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function tanggalSaja(value) {
  return value?.toISOString().slice(0, 10) || null;
}

function tambahBulan(tanggal, bulan) {
  const [tahun, nomorBulan, hari] = tanggal.split("-").map(Number);
  const awalBulan = new Date(Date.UTC(tahun, nomorBulan - 1 + bulan, 1));
  const akhirBulan = new Date(Date.UTC(awalBulan.getUTCFullYear(), awalBulan.getUTCMonth() + 1, 0)).getUTCDate();
  awalBulan.setUTCDate(Math.min(hari, akhirBulan));
  return tanggalSaja(awalBulan);
}

function jadwalBerikutnya(tanggal, intervalBulan, now = new Date()) {
  const hariIni = tanggalBangkok(now);
  let langkah = 1;
  let berikutnya = tambahBulan(tanggal, intervalBulan);
  while (berikutnya <= hariIni) {
    langkah += 1;
    berikutnya = tambahBulan(tanggal, intervalBulan * langkah);
  }
  return new Date(`${berikutnya}T00:00:00.000Z`);
}

async function buatSuratTugasMaintenance(now = new Date(), db = prisma) {
  const batas = new Date(`${tanggalBangkok(new Date(now.getTime() + 5 * DAY_MS))}T00:00:00.000Z`);
  const unit = await db.master_printer.findMany({
    where: {
      status: "installed",
      lokasi_jenis: "customer",
      account_id: { not: null },
      customer_id: { not: null },
      tanggal_maintenance_berikutnya: { lte: batas },
      interval_maintenance_bulan: { not: null }
    },
    select: { id: true }
  });
  let dibuat = 0;
  for (const candidate of unit) {
    try {
      const created = await db.$transaction(async (tx) => {
        const printer = await tx.master_printer.findUnique({ where: { id: candidate.id } });
        if (printer?.status !== "installed" || printer.lokasi_jenis !== "customer" || !printer.account_id || !printer.customer_id || !printer.tanggal_maintenance_berikutnya ||
          !printer.interval_maintenance_bulan || printer.tanggal_maintenance_berikutnya > batas) return null;
        const active = await tx.surat_tugas.findFirst({
          where: { printer_id: printer.id, jenis_pekerjaan: "maintenance", status: { notIn: ["solved", "cancelled"] } },
          select: { id: true }
        });
        if (active) return null;
        const due = tanggalSaja(printer.tanggal_maintenance_berikutnya);
        const surat = await tx.surat_tugas.create({ data: {
          nomor_surat_tugas: buatNomor("ST"),
          mp_no: printer.mp_no,
          account_id: printer.account_id,
          customer_id: printer.customer_id,
          printer_id: printer.id,
          tanggal_jadwal: new Date(`${due}T09:00:00+07:00`),
          tanggal_maintenance_otomatis: printer.tanggal_maintenance_berikutnya,
          jenis_tugas: "maintenance",
          jenis_pekerjaan: "maintenance",
          catatan_masalah: "Maintenance terjadwal",
          status: "pending",
          surat_tugas_printer: { create: { printer_id: printer.id, mp_no: printer.mp_no, model_id: printer.model_id, serial_number: printer.serial_number, peran: "utama" } }
        } });
        await catatAudit(tx, { pengguna: { nama: "Sistem" }, headers: {} }, {
          jenis_dokumen: "surat_tugas", nomor_dokumen: surat.nomor_surat_tugas,
          tabel_sumber: "surat_tugas", id_sumber: surat.id, aksi: "buat",
          status_sesudah: surat.status, data_sesudah: surat,
          keterangan: `Surat tugas maintenance otomatis dibuat untuk jadwal ${due}.`
        });
        return surat;
      });
      if (created) dibuat += 1;
    } catch (error) {
      if (error.code !== "P2002") throw error;
    }
  }
  return dibuat;
}

module.exports = { tanggalBangkok, tanggalSaja, tambahBulan, jadwalBerikutnya, buatSuratTugasMaintenance };
