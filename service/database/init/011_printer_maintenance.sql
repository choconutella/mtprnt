BEGIN;

ALTER TABLE master_printer
  ADD COLUMN IF NOT EXISTS tanggal_pembelian DATE,
  ADD COLUMN IF NOT EXISTS tanggal_maintenance_berikutnya DATE,
  ADD COLUMN IF NOT EXISTS interval_maintenance_bulan INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_printer_maintenance_schedule') THEN
    ALTER TABLE master_printer
      ADD CONSTRAINT ck_printer_maintenance_schedule CHECK (
        (tanggal_maintenance_berikutnya IS NULL AND interval_maintenance_bulan IS NULL)
        OR (tanggal_maintenance_berikutnya IS NOT NULL AND interval_maintenance_bulan BETWEEN 1 AND 120)
      );
  END IF;
END $$;

ALTER TABLE surat_tugas
  ADD COLUMN IF NOT EXISTS tanggal_maintenance_otomatis DATE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_surat_maintenance_occurrence
  ON surat_tugas(printer_id, tanggal_maintenance_otomatis);

COMMIT;
