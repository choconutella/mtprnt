BEGIN;

-- Abort before changing keys if customer codes are ambiguous.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM master_customer GROUP BY kode_customer HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'kode_customer harus unik secara global sebelum migrasi Surat Tugas.';
  END IF;
END $$;
ALTER TABLE master_customer ADD CONSTRAINT uq_master_customer_kode_global UNIQUE (kode_customer);

-- Keep the four dependent relations while their UUID references become ST numbers.
ALTER TABLE master_printer ADD COLUMN surat_tugas_nomor VARCHAR(100);
UPDATE master_printer p SET surat_tugas_nomor = st.nomor_surat_tugas
FROM surat_tugas st WHERE p.surat_tugas_aktif_id = st.id;

ALTER TABLE teknisi_surat_tugas ADD COLUMN surat_tugas_nomor VARCHAR(100);
UPDATE teknisi_surat_tugas child SET surat_tugas_nomor = st.nomor_surat_tugas
FROM surat_tugas st WHERE child.surat_tugas_id = st.id;

ALTER TABLE surat_tugas_item ADD COLUMN surat_tugas_nomor VARCHAR(100);
UPDATE surat_tugas_item child SET surat_tugas_nomor = st.nomor_surat_tugas
FROM surat_tugas st WHERE child.surat_tugas_id = st.id;

ALTER TABLE surat_tugas_printer ADD COLUMN surat_tugas_nomor VARCHAR(100);
UPDATE surat_tugas_printer child SET surat_tugas_nomor = st.nomor_surat_tugas
FROM surat_tugas st WHERE child.surat_tugas_id = st.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM master_printer WHERE surat_tugas_aktif_id IS NOT NULL AND surat_tugas_nomor IS NULL)
    OR EXISTS (SELECT 1 FROM teknisi_surat_tugas WHERE surat_tugas_nomor IS NULL)
    OR EXISTS (SELECT 1 FROM surat_tugas_item WHERE surat_tugas_nomor IS NULL)
    OR EXISTS (SELECT 1 FROM surat_tugas_printer WHERE surat_tugas_nomor IS NULL) THEN
    RAISE EXCEPTION 'Ada referensi Surat Tugas yang tidak dapat dipindahkan.';
  END IF;
END $$;

ALTER TABLE master_printer DROP CONSTRAINT master_printer_surat_tugas_aktif_id_fkey;
ALTER TABLE teknisi_surat_tugas DROP CONSTRAINT teknisi_surat_tugas_surat_tugas_id_fkey;
ALTER TABLE surat_tugas_item DROP CONSTRAINT pemakaian_barang_surat_tugas_surat_tugas_id_fkey;
ALTER TABLE surat_tugas_printer DROP CONSTRAINT surat_tugas_printer_surat_tugas_id_fkey;

ALTER TABLE master_printer DROP COLUMN surat_tugas_aktif_id;
ALTER TABLE master_printer RENAME COLUMN surat_tugas_nomor TO surat_tugas_aktif_id;
ALTER TABLE teknisi_surat_tugas DROP COLUMN surat_tugas_id;
ALTER TABLE teknisi_surat_tugas RENAME COLUMN surat_tugas_nomor TO surat_tugas_id;
ALTER TABLE surat_tugas_item DROP COLUMN surat_tugas_id;
ALTER TABLE surat_tugas_item RENAME COLUMN surat_tugas_nomor TO surat_tugas_id;
ALTER TABLE surat_tugas_printer DROP COLUMN surat_tugas_id;
ALTER TABLE surat_tugas_printer RENAME COLUMN surat_tugas_nomor TO surat_tugas_id;

ALTER TABLE surat_tugas RENAME COLUMN id TO slug;
ALTER TABLE surat_tugas RENAME COLUMN nomor_surat_tugas TO id;
ALTER TABLE surat_tugas DROP CONSTRAINT surat_tugas_pkey;
ALTER TABLE surat_tugas DROP CONSTRAINT surat_tugas_nomor_surat_tugas_key;
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX idx_surat_tugas_slug ON surat_tugas(slug);

ALTER TABLE master_printer
  ADD CONSTRAINT master_printer_surat_tugas_aktif_id_fkey
  FOREIGN KEY (surat_tugas_aktif_id) REFERENCES surat_tugas(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE teknisi_surat_tugas ALTER COLUMN surat_tugas_id SET NOT NULL;
ALTER TABLE teknisi_surat_tugas
  ADD CONSTRAINT teknisi_surat_tugas_surat_tugas_id_fkey
  FOREIGN KEY (surat_tugas_id) REFERENCES surat_tugas(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE surat_tugas_item ALTER COLUMN surat_tugas_id SET NOT NULL;
ALTER TABLE surat_tugas_item
  ADD CONSTRAINT pemakaian_barang_surat_tugas_surat_tugas_id_fkey
  FOREIGN KEY (surat_tugas_id) REFERENCES surat_tugas(id) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX idx_pemakaian_surat_tugas ON surat_tugas_item(surat_tugas_id);
ALTER TABLE surat_tugas_printer ALTER COLUMN surat_tugas_id SET NOT NULL;
ALTER TABLE surat_tugas_printer
  ADD CONSTRAINT surat_tugas_printer_surat_tugas_id_fkey
  FOREIGN KEY (surat_tugas_id) REFERENCES surat_tugas(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE teknisi_surat_tugas
  ADD CONSTRAINT uq_teknisi_surat_tugas UNIQUE (surat_tugas_id, teknisi_id);
ALTER TABLE surat_tugas_printer
  ADD CONSTRAINT surat_tugas_printer_surat_tugas_id_mp_no_peran_key UNIQUE (surat_tugas_id, mp_no, peran);

-- Business codes become the physical references on Surat Tugas.
ALTER TABLE surat_tugas
  DROP CONSTRAINT surat_tugas_account_id_fkey,
  DROP CONSTRAINT surat_tugas_customer_id_fkey,
  DROP CONSTRAINT surat_tugas_tiket_id_fkey,
  DROP CONSTRAINT surat_tugas_gudang_id_fkey;
DROP INDEX idx_surat_tugas_customer_status;
DROP INDEX idx_surat_tugas_tiket;
ALTER TABLE surat_tugas
  RENAME COLUMN account_id TO account_uuid;
ALTER TABLE surat_tugas RENAME COLUMN customer_id TO customer_uuid;
ALTER TABLE surat_tugas RENAME COLUMN tiket_id TO tiket_uuid;
ALTER TABLE surat_tugas RENAME COLUMN gudang_id TO gudang_uuid;
ALTER TABLE surat_tugas
  ADD COLUMN account_id VARCHAR(50),
  ADD COLUMN customer_id VARCHAR(50),
  ADD COLUMN tiket_id VARCHAR(100),
  ADD COLUMN gudang_id VARCHAR(50);
UPDATE surat_tugas st SET account_id = a.kode_account
FROM master_account a WHERE st.account_uuid = a.id;
UPDATE surat_tugas st SET customer_id = c.kode_customer
FROM master_customer c WHERE st.customer_uuid = c.id;
UPDATE surat_tugas st SET tiket_id = t.nomor_tiket
FROM tiket t WHERE st.tiket_uuid = t.id;
UPDATE surat_tugas st SET gudang_id = g.kode_gudang
FROM master_gudang g WHERE st.gudang_uuid = g.id;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM surat_tugas WHERE account_uuid IS NOT NULL AND account_id IS NULL)
    OR EXISTS (SELECT 1 FROM surat_tugas WHERE customer_uuid IS NOT NULL AND customer_id IS NULL)
    OR EXISTS (SELECT 1 FROM surat_tugas WHERE tiket_uuid IS NOT NULL AND tiket_id IS NULL)
    OR EXISTS (SELECT 1 FROM surat_tugas WHERE gudang_uuid IS NOT NULL AND gudang_id IS NULL) THEN
    RAISE EXCEPTION 'Ada kode referensi Surat Tugas yang tidak dapat dipindahkan.';
  END IF;
END $$;
ALTER TABLE surat_tugas
  DROP COLUMN account_uuid,
  DROP COLUMN customer_uuid,
  DROP COLUMN tiket_uuid,
  DROP COLUMN gudang_uuid;
ALTER TABLE surat_tugas
  ADD CONSTRAINT surat_tugas_account_id_fkey FOREIGN KEY (account_id) REFERENCES master_account(kode_account) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT surat_tugas_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES master_customer(kode_customer) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT surat_tugas_tiket_id_fkey FOREIGN KEY (tiket_id) REFERENCES tiket(nomor_tiket) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT surat_tugas_gudang_id_fkey FOREIGN KEY (gudang_id) REFERENCES master_gudang(kode_gudang) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX idx_surat_tugas_customer_status ON surat_tugas(customer_id, status);
CREATE INDEX idx_surat_tugas_tiket ON surat_tugas(tiket_id, status);

-- Existing audit and stock references used the former UUID key.
ALTER TABLE riwayat_audit ALTER COLUMN id_sumber TYPE VARCHAR(100) USING id_sumber::text;
UPDATE riwayat_audit a SET id_sumber = st.id
FROM surat_tugas st WHERE a.tabel_sumber = 'surat_tugas' AND a.id_sumber = st.slug::text;
ALTER TABLE mutasi_stok ALTER COLUMN referensi_id TYPE VARCHAR(100) USING referensi_id::text;
UPDATE mutasi_stok m SET referensi_id = st.id
FROM surat_tugas st WHERE m.jenis_referensi = 'surat_tugas' AND m.referensi_id = st.slug::text;

COMMIT;
