const { z } = require("zod");

const itemField = {
  toner: "toner_id",
  suku_cadang: "suku_cadang_id"
};

const lineSchema = z.object({
  jenis_barang: z.enum(["toner", "suku_cadang"]),
  toner_id: z.string().min(1).optional().nullable(),
  printer_id: z.string().min(1).optional().nullable(),
  suku_cadang_id: z.string().min(1).optional().nullable(),
  jumlah: z.number().positive(),
  satuan: z.string().optional(),
  keterangan: z.string().optional().nullable()
}).superRefine((line, ctx) => {
  const expected = itemField[line.jenis_barang];
  if (!line[expected] || line.printer_id || Object.values(itemField).some((field) => field !== expected && line[field])) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pilih satu barang sesuai jenisnya.", path: [expected] });
  }
});

const mutasiSchema = z.object({
  nomor_mutasi: z.string().optional(),
  jenis_mutasi: z.enum(["masuk", "keluar", "transfer", "penyesuaian", "pemakaian"]),
  gudang_asal_id: z.string().min(1).optional().nullable(),
  gudang_tujuan_id: z.string().min(1).optional().nullable(),
  jenis_referensi: z.string().optional().nullable(),
  referensi_id: z.string().trim().min(1).max(100).optional().nullable(),
  keterangan: z.string().optional().nullable(),
  detail: z.array(lineSchema).min(1),
  langsung_posting: z.boolean().optional()
}).superRefine((body, ctx) => {
  if (body.referensi_id && body.jenis_referensi !== "surat_tugas" && !z.string().uuid().safeParse(body.referensi_id).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ID referensi harus UUID kecuali untuk Surat Tugas.", path: ["referensi_id"] });
  }
  const perluAsal = ["keluar", "transfer", "pemakaian"].includes(body.jenis_mutasi);
  const perluTujuan = ["masuk", "transfer"].includes(body.jenis_mutasi);
  if (perluAsal && !body.gudang_asal_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gudang asal wajib dipilih.", path: ["gudang_asal_id"] });
  }
  if (perluTujuan && !body.gudang_tujuan_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gudang tujuan wajib dipilih.", path: ["gudang_tujuan_id"] });
  }
  if (body.jenis_mutasi === "penyesuaian" && !body.gudang_asal_id && !body.gudang_tujuan_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pilih gudang untuk penyesuaian.", path: ["gudang_tujuan_id"] });
  }
  if (body.jenis_mutasi === "transfer" && body.gudang_asal_id === body.gudang_tujuan_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Gudang asal dan tujuan harus berbeda.", path: ["gudang_tujuan_id"] });
  }
});

module.exports = { mutasiSchema };
