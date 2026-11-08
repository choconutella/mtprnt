BEGIN;

-- Preserve the exact printer selected on older work orders before dropping its UUID.
UPDATE surat_tugas st SET mp_no = p.mp_no
FROM master_printer p WHERE st.printer_id = p.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM surat_tugas WHERE printer_id IS NOT NULL AND mp_no IS NULL)
    OR EXISTS (
      SELECT 1 FROM surat_tugas st
      WHERE st.mp_no IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM master_printer p WHERE p.mp_no = st.mp_no)
        AND NOT EXISTS (SELECT 1 FROM surat_tugas_printer line WHERE line.surat_tugas_id = st.id AND line.mp_no = st.mp_no)
    ) THEN
    RAISE EXCEPTION 'Ada MP No Surat Tugas yang tidak dapat dipetakan ke master_printer.';
  END IF;
END $$;

-- Incoming units are recorded on the ST line before master_printer is created.
UPDATE surat_tugas st SET mp_no = NULL
WHERE st.printer_id IS NULL AND st.mp_no IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_printer p WHERE p.mp_no = st.mp_no);

DROP INDEX uq_surat_maintenance_occurrence;
ALTER TABLE surat_tugas DROP CONSTRAINT surat_tugas_printer_id_fkey;
ALTER TABLE surat_tugas DROP COLUMN printer_id;
ALTER TABLE surat_tugas
  ADD CONSTRAINT surat_tugas_mp_no_fkey
  FOREIGN KEY (mp_no) REFERENCES master_printer(mp_no)
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX uq_surat_maintenance_occurrence
  ON surat_tugas(mp_no, tanggal_maintenance_otomatis);

COMMIT;
