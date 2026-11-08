const JENIS_TIKET = Object.freeze({
  delivery: {
    kontrak: ["kirim_kontrak", "terima_return"],
    trial: ["kirim_trial"],
    stand_by: ["kirim_stand_by"],
    event: ["kirim_event"],
    sell: ["kirim_sell"],
    toner_purchase: ["kirim_toner"]
  },
  komplain: {
    on_site_service: ["on_site_service"],
    back_up: ["kirim_back_up", "terima_return"]
  },
  internal: {
    repair: ["repair"],
    qc: ["qc"],
    internal_use: ["internal_use"]
  },
  inbound: {
    return: ["terima_return"],
    penerimaan_printer: ["terima_printer_baru"]
  },
  maintenance: {
    maintenance: ["maintenance"]
  }
});

const JENIS_ST = Object.freeze(Object.values(JENIS_TIKET).flatMap((group) => Object.values(group).flat()));
const PENGIRIMAN_PRINTER = Object.freeze(["kirim_kontrak", "kirim_trial", "kirim_stand_by", "kirim_event", "kirim_sell", "kirim_back_up", "internal_use"]);
const PENERIMAAN_PRINTER = Object.freeze(["terima_tukar", "terima_unit_rusak", "terima_return", "terima_printer_baru"]);
const HASIL_KONDISI = Object.freeze(["ready", "ready_with_condition", "need_repair", "unready", "kanibal"]);
const PEMILIK_TIKET = Object.freeze({ delivery: "sales_admin", komplain: "sales_admin", internal: "kepala_teknisi", inbound: "warehouse", maintenance: "kepala_teknisi" });

function kategoriUntukJenisSt(jenisTugas) {
  for (const [kategori, jenis] of Object.entries(JENIS_TIKET)) {
    for (const [subjenis, tugas] of Object.entries(jenis)) {
      if (tugas.includes(jenisTugas)) return { kategori, jenis: subjenis };
    }
  }
  return null;
}

function jenisStDiizinkan(kategori, jenis, jenisTugas, mode) {
  if (!JENIS_TIKET[kategori]?.[jenis]?.includes(jenisTugas)) return false;
  if (jenisTugas === "terima_tukar" && mode !== "tukar") return false;
  return true;
}

function tugasWajib(kategori, jenis, mode) {
  const allowed = JENIS_TIKET[kategori]?.[jenis] || [];
  return allowed.filter((value) => value !== "terima_tukar" || mode === "tukar");
}

module.exports = {
  JENIS_TIKET,
  JENIS_ST,
  PENGIRIMAN_PRINTER,
  PENERIMAAN_PRINTER,
  HASIL_KONDISI,
  PEMILIK_TIKET,
  kategoriUntukJenisSt,
  jenisStDiizinkan,
  tugasWajib
};
