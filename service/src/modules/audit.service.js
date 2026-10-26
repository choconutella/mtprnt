function ambilIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function bersihkanJson(data) {
  if (!data) return null;
  return JSON.parse(JSON.stringify(data));
}

function aksiDariStatus(sebelum, sesudah, defaultAksi = "ubah") {
  if (sebelum?.status !== sesudah?.status) {
    if (["dibatalkan", "cancelled"].includes(sesudah?.status)) return "batalkan";
    return "ubah_status";
  }
  return defaultAksi;
}

async function catatAudit(tx, req, input) {
  return tx.riwayat_audit.create({
    data: {
      jenis_dokumen: input.jenis_dokumen,
      nomor_dokumen: input.nomor_dokumen,
      tabel_sumber: input.tabel_sumber,
      id_sumber: input.id_sumber,
      aksi: input.aksi,
      status_sebelum: input.status_sebelum || null,
      status_sesudah: input.status_sesudah || null,
      data_sebelum: bersihkanJson(input.data_sebelum),
      data_sesudah: bersihkanJson(input.data_sesudah),
      keterangan: input.keterangan || null,
      pengguna_id: req.pengguna?.id || null,
      nama_pengguna: req.pengguna?.name || req.pengguna?.nama || req.pengguna?.user_id || null,
      ip_address: ambilIp(req),
      user_agent: req.headers["user-agent"] || null
    }
  });
}

module.exports = { aksiDariStatus, catatAudit };
