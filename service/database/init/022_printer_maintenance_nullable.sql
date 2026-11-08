BEGIN;

ALTER TABLE master_printer
  DROP CONSTRAINT IF EXISTS ck_printer_maintenance_schedule;

ALTER TABLE master_printer
  ADD CONSTRAINT ck_printer_maintenance_interval
  CHECK (interval_maintenance_bulan IS NULL OR interval_maintenance_bulan BETWEEN 1 AND 120);

UPDATE master_printer AS printer
SET tanggal_maintenance_berikutnya = (
  SELECT ((COALESCE(st.validasi_kepala_teknisi_pada, st.tanggal_diperbarui) AT TIME ZONE 'Asia/Bangkok')::date
         + make_interval(months => printer.interval_maintenance_bulan))::date
  FROM surat_tugas AS st
  WHERE st.mp_no = printer.mp_no
    AND st.jenis_tugas = 'maintenance'
    AND st.status = 'solved'
  ORDER BY COALESCE(st.validasi_kepala_teknisi_pada, st.tanggal_diperbarui) DESC
  LIMIT 1
)
WHERE printer.interval_maintenance_bulan IS NOT NULL;

UPDATE master_printer
SET tanggal_maintenance_berikutnya = NULL
WHERE interval_maintenance_bulan IS NULL;

COMMIT;
