const REFERENCES = {
  account_id: { model: "master_account", code: "kode_account", relation: "master_account" },
  customer_id: { model: "master_customer", code: "kode_customer", relation: "master_customer" },
  tiket_id: { model: "tiket", code: "id", relation: "tiket" },
  gudang_id: { model: "master_gudang", code: "kode_gudang", relation: "master_gudang_baru" }
};

function invalidReference(field) {
  throw Object.assign(new Error(`Referensi ${field} tidak ditemukan.`), { statusCode: 422 });
}

async function kodeSuratTugas(tx, data) {
  const result = { ...data };
  if ("printer_id" in result) {
    const printerId = result.printer_id;
    delete result.printer_id;
    if (printerId) {
      const printer = await tx.master_printer.findUnique({ where: { id: printerId }, select: { mp_no: true } });
      if (!printer) invalidReference("printer_id");
      result.mp_no = printer.mp_no;
    } else if (printerId === null) {
      result.mp_no = null;
    }
  }
  if ("mp_no" in result && result.mp_no) {
    const printer = await tx.master_printer.findUnique({ where: { mp_no: result.mp_no }, select: { id: true } });
    if (!printer) invalidReference("mp_no");
  } else if (result.mp_no === "") {
    result.mp_no = null;
  }
  await Promise.all(Object.entries(REFERENCES).map(async ([field, config]) => {
    if (!(field in data) || data[field] == null) return;
    const where = ["account_id", "customer_id"].includes(field)
      ? { [config.code]: data[field] }
      : { id: data[field] };
    const row = await tx[config.model].findUnique({ where, select: { [config.code]: true } });
    if (!row) invalidReference(field);
    result[field] = row[config.code];
  }));
  return result;
}

async function suratTugasApi(tx, surat) {
  if (!surat) return null;
  const result = { ...surat, nomor_surat_tugas: surat.id };
  if ("mp_no" in surat) {
    const printer = surat.master_printer || (surat.mp_no && await tx.master_printer.findUnique({ where: { mp_no: surat.mp_no }, select: { id: true } }));
    result.printer_id = printer?.id || null;
    if (!surat.mp_no && surat.id) {
      const line = surat.surat_tugas_printer?.[0] || await tx.surat_tugas_printer.findFirst({
        where: { surat_tugas_id: surat.id }, orderBy: { mp_no: "asc" }, select: { mp_no: true }
      });
      if (line) result.mp_no = line.mp_no;
    }
  }
  if (surat.surat_tugas_printer) {
    result.surat_tugas_printer = await Promise.all(surat.surat_tugas_printer.map(async (line) => {
      const printer = line.master_printer || await tx.master_printer.findUnique({ where: { mp_no: line.mp_no }, select: { id: true } });
      const model = line.model_id && (line.master_printer_model || await tx.master_printer_model.findUnique({ where: { kode_model: line.model_id }, select: { id: true } }));
      return { ...line, printer_id: printer?.id || null, model_id: model?.id || null };
    }));
  }
  await Promise.all(Object.entries(REFERENCES).map(async ([field, config]) => {
    if (!(field in surat) || surat[field] == null) return;
    const row = surat[config.relation] || await tx[config.model].findUnique({
      where: { [config.code]: surat[field] }, select: { id: true }
    });
    if (!row) invalidReference(field);
    result[field] = ["account_id", "customer_id"].includes(field) ? row[config.code] : row.id;
  }));
  return result;
}

async function bacaSuratTugas(tx, args) {
  return suratTugasApi(tx, await tx.surat_tugas.findUnique(args));
}

module.exports = { kodeSuratTugas, suratTugasApi, bacaSuratTugas };
