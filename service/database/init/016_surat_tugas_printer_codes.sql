BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM surat_tugas_printer line
    WHERE NOT EXISTS (SELECT 1 FROM master_printer p WHERE p.mp_no = line.mp_no)
  ) OR EXISTS (
    SELECT 1 FROM surat_tugas_printer line
    WHERE line.model_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM master_printer_model m WHERE m.id = line.model_id)
  ) THEN
    RAISE EXCEPTION 'Ada referensi printer/model ST yang belum tersedia di master.';
  END IF;
END $$;

ALTER TABLE surat_tugas_printer DROP CONSTRAINT surat_tugas_printer_printer_id_fkey;
ALTER TABLE surat_tugas_printer DROP CONSTRAINT surat_tugas_printer_model_id_fkey;
DROP INDEX idx_surat_tugas_printer_unit;
ALTER TABLE surat_tugas_printer DROP COLUMN printer_id;
ALTER TABLE surat_tugas_printer ADD COLUMN model_kode VARCHAR(50);
UPDATE surat_tugas_printer line SET model_kode = m.kode_model
FROM master_printer_model m WHERE line.model_id = m.id;
ALTER TABLE surat_tugas_printer DROP COLUMN model_id;
ALTER TABLE surat_tugas_printer RENAME COLUMN model_kode TO model_id;
ALTER TABLE surat_tugas_printer
  ADD CONSTRAINT surat_tugas_printer_mp_no_fkey
  FOREIGN KEY (mp_no) REFERENCES master_printer(mp_no) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE surat_tugas_printer
  ADD CONSTRAINT surat_tugas_printer_model_id_fkey
  FOREIGN KEY (model_id) REFERENCES master_printer_model(kode_model) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX idx_surat_tugas_printer_unit ON surat_tugas_printer(mp_no);

COMMIT;
