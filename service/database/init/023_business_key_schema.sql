-- Multiprint business-key schema.
-- This migration is intended for the local resettable database. It preserves
-- master_pengguna and intentionally removes all other existing rows.
BEGIN;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', item.schema_name, item.table_name, item.constraint_name);
  END LOOP;
END $$;

TRUNCATE TABLE
  app_pengaturan,
  role_permission,
  detail_mutasi_stok,
  master_account,
  master_customer,
  master_gudang,
  master_kontrak,
  master_printer,
  master_printer_kategori,
  master_printer_model,
  master_suku_cadang,
  master_toner,
  mutasi_stok,
  riwayat_audit,
  stok_suku_cadang,
  stok_toner,
  surat_tugas,
  surat_tugas_item,
  surat_tugas_printer,
  surat_tugas_teknisi,
  tiket
RESTART IDENTITY;

-- master_pengguna is preserved. Its stable legacy user_id becomes the new key.
ALTER TABLE master_pengguna ADD COLUMN slug UUID DEFAULT gen_random_uuid();
ALTER TABLE master_pengguna ALTER COLUMN slug SET NOT NULL;
ALTER TABLE master_pengguna DROP CONSTRAINT master_pengguna_pkey;
ALTER TABLE master_pengguna DROP COLUMN id;
ALTER TABLE master_pengguna RENAME COLUMN user_id TO id;
ALTER TABLE master_pengguna ALTER COLUMN id SET NOT NULL;
ALTER TABLE master_pengguna ADD PRIMARY KEY (id);
ALTER TABLE master_pengguna ADD CONSTRAINT uq_master_pengguna_slug UNIQUE (slug);

-- Master tables use business codes as primary keys and UUID slugs for URLs.
ALTER TABLE master_account DROP CONSTRAINT IF EXISTS master_account_pkey;
ALTER TABLE master_account DROP COLUMN id;
ALTER TABLE master_account RENAME COLUMN kode_account TO id;
ALTER TABLE master_account ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_account ADD PRIMARY KEY (id);
ALTER TABLE master_account ADD CONSTRAINT uq_master_account_slug UNIQUE (slug);

ALTER TABLE master_customer DROP CONSTRAINT IF EXISTS master_customer_pkey;
ALTER TABLE master_customer DROP COLUMN id;
ALTER TABLE master_customer RENAME COLUMN kode_customer TO id;
ALTER TABLE master_customer ALTER COLUMN account_id TYPE VARCHAR(50) USING account_id::text;
ALTER TABLE master_customer ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_customer ADD PRIMARY KEY (id);
ALTER TABLE master_customer ADD CONSTRAINT uq_master_customer_slug UNIQUE (slug);

ALTER TABLE master_gudang DROP CONSTRAINT IF EXISTS master_gudang_pkey;
ALTER TABLE master_gudang DROP COLUMN id;
ALTER TABLE master_gudang RENAME COLUMN kode_gudang TO id;
ALTER TABLE master_gudang ALTER COLUMN teknisi_id TYPE VARCHAR(20) USING teknisi_id::text;
ALTER TABLE master_gudang ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_gudang ADD PRIMARY KEY (id);
ALTER TABLE master_gudang ADD CONSTRAINT uq_master_gudang_slug UNIQUE (slug);

ALTER TABLE master_printer_kategori DROP CONSTRAINT IF EXISTS master_printer_kategori_pkey;
ALTER TABLE master_printer_kategori DROP COLUMN id;
ALTER TABLE master_printer_kategori RENAME COLUMN kode_kategori TO id;
ALTER TABLE master_printer_kategori ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_printer_kategori ADD PRIMARY KEY (id);
ALTER TABLE master_printer_kategori ADD CONSTRAINT uq_master_printer_kategori_slug UNIQUE (slug);

ALTER TABLE master_printer_model DROP CONSTRAINT IF EXISTS master_printer_model_pkey;
ALTER TABLE master_printer_model DROP COLUMN id;
ALTER TABLE master_printer_model RENAME COLUMN kode_model TO id;
ALTER TABLE master_printer_model ALTER COLUMN kategori_id TYPE VARCHAR(50) USING kategori_id::text;
ALTER TABLE master_printer_model ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_printer_model ADD PRIMARY KEY (id);
ALTER TABLE master_printer_model ADD CONSTRAINT uq_master_printer_model_slug UNIQUE (slug);

ALTER TABLE master_printer DROP CONSTRAINT IF EXISTS master_printer_pkey;
ALTER TABLE master_printer DROP COLUMN id;
ALTER TABLE master_printer RENAME COLUMN mp_no TO id;
ALTER TABLE master_printer ALTER COLUMN model_id TYPE VARCHAR(50) USING model_id::text;
ALTER TABLE master_printer ALTER COLUMN gudang_id TYPE VARCHAR(50) USING gudang_id::text;
ALTER TABLE master_printer ALTER COLUMN account_id TYPE VARCHAR(50) USING account_id::text;
ALTER TABLE master_printer ALTER COLUMN customer_id TYPE VARCHAR(50) USING customer_id::text;
ALTER TABLE master_printer ALTER COLUMN kontrak_id TYPE VARCHAR(100) USING kontrak_id::text;
ALTER TABLE master_printer ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_printer ADD PRIMARY KEY (id);
ALTER TABLE master_printer ADD CONSTRAINT uq_master_printer_slug UNIQUE (slug);

ALTER TABLE master_kontrak DROP CONSTRAINT IF EXISTS master_kontrak_pkey;
ALTER TABLE master_kontrak DROP COLUMN id;
ALTER TABLE master_kontrak RENAME COLUMN nomor_kontrak TO id;
ALTER TABLE master_kontrak ALTER COLUMN customer_id TYPE VARCHAR(50) USING customer_id::text;
ALTER TABLE master_kontrak ALTER COLUMN tiket_id TYPE VARCHAR(100) USING tiket_id::text;
ALTER TABLE master_kontrak ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_kontrak ADD PRIMARY KEY (id);
ALTER TABLE master_kontrak ADD CONSTRAINT uq_master_kontrak_slug UNIQUE (slug);

ALTER TABLE master_toner DROP CONSTRAINT IF EXISTS master_toner_pkey;
ALTER TABLE master_toner DROP COLUMN id;
ALTER TABLE master_toner RENAME COLUMN kode_toner TO id;
ALTER TABLE master_toner ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_toner ADD PRIMARY KEY (id);
ALTER TABLE master_toner ADD CONSTRAINT uq_master_toner_slug UNIQUE (slug);

ALTER TABLE master_suku_cadang DROP CONSTRAINT IF EXISTS master_suku_cadang_pkey;
ALTER TABLE master_suku_cadang DROP COLUMN id;
ALTER TABLE master_suku_cadang RENAME COLUMN kode_suku_cadang TO id;
ALTER TABLE master_suku_cadang ADD COLUMN slug UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE master_suku_cadang ADD PRIMARY KEY (id);
ALTER TABLE master_suku_cadang ADD CONSTRAINT uq_master_suku_cadang_slug UNIQUE (slug);

-- Transactional references now point to business keys.
ALTER TABLE mutasi_stok ALTER COLUMN gudang_asal_id TYPE VARCHAR(50) USING gudang_asal_id::text;
ALTER TABLE mutasi_stok ALTER COLUMN gudang_tujuan_id TYPE VARCHAR(50) USING gudang_tujuan_id::text;
ALTER TABLE mutasi_stok ALTER COLUMN dibuat_oleh TYPE VARCHAR(20) USING dibuat_oleh::text;

ALTER TABLE detail_mutasi_stok ALTER COLUMN toner_id TYPE VARCHAR(50) USING toner_id::text;
ALTER TABLE detail_mutasi_stok RENAME COLUMN printer_id TO mp_no;
ALTER TABLE detail_mutasi_stok ALTER COLUMN mp_no TYPE VARCHAR(150) USING mp_no::text;
ALTER TABLE detail_mutasi_stok ALTER COLUMN suku_cadang_id TYPE VARCHAR(50) USING suku_cadang_id::text;

ALTER TABLE stok_toner ALTER COLUMN gudang_id TYPE VARCHAR(50) USING gudang_id::text;
ALTER TABLE stok_toner ALTER COLUMN toner_id TYPE VARCHAR(50) USING toner_id::text;
ALTER TABLE stok_suku_cadang ALTER COLUMN gudang_id TYPE VARCHAR(50) USING gudang_id::text;
ALTER TABLE stok_suku_cadang ALTER COLUMN suku_cadang_id TYPE VARCHAR(50) USING suku_cadang_id::text;

ALTER TABLE tiket ALTER COLUMN kontrak_id TYPE VARCHAR(100) USING kontrak_id::text;

ALTER TABLE surat_tugas ALTER COLUMN kontrak_id TYPE VARCHAR(100) USING kontrak_id::text;
ALTER TABLE surat_tugas ALTER COLUMN unit_asal_id TYPE VARCHAR(150) USING unit_asal_id::text;
ALTER TABLE surat_tugas ALTER COLUMN pic_warehouse_id TYPE VARCHAR(20) USING pic_warehouse_id::text;
ALTER TABLE surat_tugas ALTER COLUMN disetujui_oleh TYPE VARCHAR(20) USING disetujui_oleh::text;
ALTER TABLE surat_tugas ALTER COLUMN validasi_warehouse_oleh TYPE VARCHAR(20) USING validasi_warehouse_oleh::text;
ALTER TABLE surat_tugas ALTER COLUMN validasi_kepala_teknisi_oleh TYPE VARCHAR(20) USING validasi_kepala_teknisi_oleh::text;
ALTER TABLE surat_tugas ALTER COLUMN dibuat_oleh TYPE VARCHAR(20) USING dibuat_oleh::text;

ALTER TABLE surat_tugas_printer ALTER COLUMN model_id TYPE VARCHAR(50) USING model_id::text;
ALTER TABLE surat_tugas_teknisi ALTER COLUMN teknisi_id TYPE VARCHAR(20) USING teknisi_id::text;
ALTER TABLE surat_tugas_item ALTER COLUMN gudang_id TYPE VARCHAR(50) USING gudang_id::text;
ALTER TABLE surat_tugas_item ALTER COLUMN toner_id TYPE VARCHAR(50) USING toner_id::text;
ALTER TABLE surat_tugas_item RENAME COLUMN printer_id TO mp_no;
ALTER TABLE surat_tugas_item ALTER COLUMN mp_no TYPE VARCHAR(150) USING mp_no::text;
ALTER TABLE surat_tugas_item ALTER COLUMN suku_cadang_id TYPE VARCHAR(50) USING suku_cadang_id::text;
ALTER TABLE riwayat_audit ALTER COLUMN pengguna_id TYPE VARCHAR(20) USING pengguna_id::text;

-- Foreign keys matching database-schema-edit.md.
ALTER TABLE master_customer ADD CONSTRAINT master_customer_account_fkey FOREIGN KEY (account_id) REFERENCES master_account(id) ON UPDATE CASCADE;
ALTER TABLE master_gudang ADD CONSTRAINT master_gudang_teknisi_fkey FOREIGN KEY (teknisi_id) REFERENCES master_pengguna(id) ON DELETE RESTRICT;
ALTER TABLE master_printer_model ADD CONSTRAINT master_printer_model_kategori_fkey FOREIGN KEY (kategori_id) REFERENCES master_printer_kategori(id) ON DELETE RESTRICT;
ALTER TABLE master_printer ADD CONSTRAINT master_printer_model_fkey FOREIGN KEY (model_id) REFERENCES master_printer_model(id) ON DELETE RESTRICT;
ALTER TABLE master_printer ADD CONSTRAINT master_printer_gudang_fkey FOREIGN KEY (gudang_id) REFERENCES master_gudang(id) ON DELETE RESTRICT;
ALTER TABLE master_printer ADD CONSTRAINT master_printer_account_fkey FOREIGN KEY (account_id) REFERENCES master_account(id) ON DELETE RESTRICT;
ALTER TABLE master_printer ADD CONSTRAINT master_printer_customer_fkey FOREIGN KEY (customer_id) REFERENCES master_customer(id) ON DELETE RESTRICT;
ALTER TABLE master_printer ADD CONSTRAINT master_printer_kontrak_fkey FOREIGN KEY (kontrak_id) REFERENCES master_kontrak(id) ON DELETE RESTRICT;
ALTER TABLE master_printer ADD CONSTRAINT master_printer_st_fkey FOREIGN KEY (surat_tugas_aktif_id) REFERENCES surat_tugas(id) ON UPDATE CASCADE;
ALTER TABLE master_kontrak ADD CONSTRAINT master_kontrak_customer_fkey FOREIGN KEY (customer_id) REFERENCES master_customer(id);
ALTER TABLE master_kontrak ADD CONSTRAINT master_kontrak_tiket_fkey FOREIGN KEY (tiket_id) REFERENCES tiket(id);
ALTER TABLE mutasi_stok ADD CONSTRAINT mutasi_stok_asal_fkey FOREIGN KEY (gudang_asal_id) REFERENCES master_gudang(id);
ALTER TABLE mutasi_stok ADD CONSTRAINT mutasi_stok_tujuan_fkey FOREIGN KEY (gudang_tujuan_id) REFERENCES master_gudang(id);
ALTER TABLE mutasi_stok ADD CONSTRAINT mutasi_stok_pengguna_fkey FOREIGN KEY (dibuat_oleh) REFERENCES master_pengguna(id);
ALTER TABLE detail_mutasi_stok ADD CONSTRAINT detail_mutasi_toner_fkey FOREIGN KEY (toner_id) REFERENCES master_toner(id);
ALTER TABLE detail_mutasi_stok ADD CONSTRAINT detail_mutasi_printer_fkey FOREIGN KEY (mp_no) REFERENCES master_printer(id);
ALTER TABLE detail_mutasi_stok ADD CONSTRAINT detail_mutasi_suku_fkey FOREIGN KEY (suku_cadang_id) REFERENCES master_suku_cadang(id);
ALTER TABLE stok_toner ADD CONSTRAINT stok_toner_gudang_fkey FOREIGN KEY (gudang_id) REFERENCES master_gudang(id);
ALTER TABLE stok_toner ADD CONSTRAINT stok_toner_toner_fkey FOREIGN KEY (toner_id) REFERENCES master_toner(id);
ALTER TABLE stok_suku_cadang ADD CONSTRAINT stok_suku_gudang_fkey FOREIGN KEY (gudang_id) REFERENCES master_gudang(id);
ALTER TABLE stok_suku_cadang ADD CONSTRAINT stok_suku_fkey FOREIGN KEY (suku_cadang_id) REFERENCES master_suku_cadang(id);
ALTER TABLE tiket ADD CONSTRAINT tiket_account_fkey FOREIGN KEY (account_id) REFERENCES master_account(id);
ALTER TABLE tiket ADD CONSTRAINT tiket_customer_fkey FOREIGN KEY (customer_id) REFERENCES master_customer(id);
ALTER TABLE tiket ADD CONSTRAINT tiket_kontrak_fkey FOREIGN KEY (kontrak_id) REFERENCES master_kontrak(id);
ALTER TABLE tiket ADD CONSTRAINT tiket_owner_fkey FOREIGN KEY (owner) REFERENCES master_pengguna(id);
ALTER TABLE tiket ADD CONSTRAINT tiket_dibuat_oleh_fkey FOREIGN KEY (dibuat_oleh) REFERENCES master_pengguna(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_tiket_fkey FOREIGN KEY (tiket_id) REFERENCES tiket(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_kontrak_fkey FOREIGN KEY (kontrak_id) REFERENCES master_kontrak(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_unit_asal_fkey FOREIGN KEY (unit_asal_id) REFERENCES master_printer(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_printer_fkey FOREIGN KEY (mp_no) REFERENCES master_printer(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_account_fkey FOREIGN KEY (account_id) REFERENCES master_account(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_customer_fkey FOREIGN KEY (customer_id) REFERENCES master_customer(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_gudang_fkey FOREIGN KEY (gudang_id) REFERENCES master_gudang(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_pic_fkey FOREIGN KEY (pic_warehouse_id) REFERENCES master_pengguna(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_disetujui_fkey FOREIGN KEY (disetujui_oleh) REFERENCES master_pengguna(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_validasi_warehouse_fkey FOREIGN KEY (validasi_warehouse_oleh) REFERENCES master_pengguna(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_validasi_kepala_fkey FOREIGN KEY (validasi_kepala_teknisi_oleh) REFERENCES master_pengguna(id);
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_dibuat_fkey FOREIGN KEY (dibuat_oleh) REFERENCES master_pengguna(id);
ALTER TABLE surat_tugas_printer ADD CONSTRAINT surat_tugas_printer_st_fkey FOREIGN KEY (surat_tugas_id) REFERENCES surat_tugas(id) ON DELETE CASCADE;
ALTER TABLE surat_tugas_printer ADD CONSTRAINT surat_tugas_printer_unit_fkey FOREIGN KEY (mp_no) REFERENCES master_printer(id);
ALTER TABLE surat_tugas_printer ADD CONSTRAINT surat_tugas_printer_model_fkey FOREIGN KEY (model_id) REFERENCES master_printer_model(id);
ALTER TABLE surat_tugas_teknisi ADD CONSTRAINT surat_tugas_teknisi_st_fkey FOREIGN KEY (surat_tugas_id) REFERENCES surat_tugas(id) ON DELETE CASCADE;
ALTER TABLE surat_tugas_teknisi ADD CONSTRAINT surat_tugas_teknisi_user_fkey FOREIGN KEY (teknisi_id) REFERENCES master_pengguna(id);
ALTER TABLE surat_tugas_item ADD CONSTRAINT surat_tugas_item_st_fkey FOREIGN KEY (surat_tugas_id) REFERENCES surat_tugas(id) ON DELETE CASCADE;
ALTER TABLE surat_tugas_item ADD CONSTRAINT surat_tugas_item_gudang_fkey FOREIGN KEY (gudang_id) REFERENCES master_gudang(id);
ALTER TABLE surat_tugas_item ADD CONSTRAINT surat_tugas_item_toner_fkey FOREIGN KEY (toner_id) REFERENCES master_toner(id);
ALTER TABLE surat_tugas_item ADD CONSTRAINT surat_tugas_item_printer_fkey FOREIGN KEY (mp_no) REFERENCES master_printer(id);
ALTER TABLE surat_tugas_item ADD CONSTRAINT surat_tugas_item_suku_fkey FOREIGN KEY (suku_cadang_id) REFERENCES master_suku_cadang(id);
ALTER TABLE riwayat_audit ADD CONSTRAINT riwayat_audit_pengguna_fkey FOREIGN KEY (pengguna_id) REFERENCES master_pengguna(id);

CREATE INDEX idx_master_printer_slug ON master_printer(slug);
CREATE INDEX idx_master_account_slug ON master_account(slug);
CREATE INDEX idx_master_customer_slug ON master_customer(slug);
CREATE INDEX idx_master_pengguna_slug ON master_pengguna(slug);
CREATE INDEX idx_master_gudang_slug ON master_gudang(slug);
CREATE INDEX idx_master_printer_model_slug ON master_printer_model(slug);
CREATE INDEX idx_master_printer_kategori_slug ON master_printer_kategori(slug);
CREATE INDEX idx_master_kontrak_slug ON master_kontrak(slug);
CREATE INDEX idx_master_toner_slug ON master_toner(slug);
CREATE INDEX idx_master_suku_cadang_slug ON master_suku_cadang(slug);

COMMIT;
