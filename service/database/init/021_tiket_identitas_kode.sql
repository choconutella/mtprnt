BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tiket') IS NULL THEN
    RAISE EXCEPTION 'Tabel tiket tidak ditemukan; migrasi 021 tidak dapat dilanjutkan.';
  END IF;
  IF EXISTS (SELECT 1 FROM master_account WHERE kode_account IS NULL) THEN
    RAISE EXCEPTION 'Ada master_account tanpa kode_account.';
  END IF;
  IF EXISTS (SELECT 1 FROM master_customer WHERE kode_customer IS NULL) THEN
    RAISE EXCEPTION 'Ada master_customer tanpa kode_customer.';
  END IF;
  IF EXISTS (SELECT 1 FROM master_pengguna WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Ada master_pengguna tanpa user_id; migrasi owner/dibuat_oleh dihentikan.';
  END IF;
  IF EXISTS (SELECT 1 FROM master_account GROUP BY kode_account HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM master_customer GROUP BY kode_customer HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM master_pengguna GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Kode account/customer/user_id harus unik sebelum migrasi.';
  END IF;
  IF EXISTS (SELECT 1 FROM tiket GROUP BY nomor_tiket HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Nomor tiket tidak unik; migrasi dihentikan.';
  END IF;
END $$;

ALTER TABLE tiket DROP CONSTRAINT tiket_tiket_asal_id_fkey;
ALTER TABLE master_kontrak DROP CONSTRAINT IF EXISTS master_kontrak_tiket_id_fkey;
ALTER TABLE tiket DROP CONSTRAINT tiket_pkey;
ALTER TABLE tiket DROP CONSTRAINT tiket_account_id_fkey;
ALTER TABLE tiket DROP CONSTRAINT tiket_customer_id_fkey;
ALTER TABLE tiket DROP CONSTRAINT tiket_sales_id_fkey;
ALTER TABLE tiket DROP CONSTRAINT tiket_dibuat_oleh_fkey;
ALTER TABLE surat_tugas DROP CONSTRAINT IF EXISTS surat_tugas_tiket_id_fkey;
ALTER TABLE tiket DROP CONSTRAINT tiket_nomor_tiket_key;

ALTER TABLE tiket ADD COLUMN account_code VARCHAR(50), ADD COLUMN customer_code VARCHAR(50), ADD COLUMN owner_user_id VARCHAR(20), ADD COLUMN created_user_id VARCHAR(20), ADD COLUMN origin_tiket_id VARCHAR(100), ADD COLUMN new_id VARCHAR(100);
UPDATE tiket t SET
  account_code = a.kode_account,
  customer_code = c.kode_customer,
  owner_user_id = o.user_id,
  created_user_id = d.user_id,
  origin_tiket_id = asal.nomor_tiket,
  new_id = t.nomor_tiket
FROM master_account a, master_customer c, master_pengguna o, master_pengguna d, tiket asal
WHERE a.id = t.account_id AND c.id = t.customer_id AND o.id = t.sales_id AND d.id = t.dibuat_oleh AND asal.id = t.tiket_asal_id;
UPDATE tiket t SET
  account_code = a.kode_account,
  customer_code = c.kode_customer,
  owner_user_id = o.user_id,
  created_user_id = d.user_id,
  new_id = t.nomor_tiket
FROM master_account a, master_customer c, master_pengguna o, master_pengguna d
WHERE a.id = t.account_id AND c.id = t.customer_id AND o.id = t.sales_id AND d.id = t.dibuat_oleh AND t.tiket_asal_id IS NULL;

ALTER TABLE master_kontrak ADD COLUMN tiket_id_new VARCHAR(100);
UPDATE master_kontrak k SET tiket_id_new = t.nomor_tiket FROM tiket t WHERE t.id = k.tiket_id;
ALTER TABLE master_kontrak DROP COLUMN tiket_id;
ALTER TABLE master_kontrak RENAME COLUMN tiket_id_new TO tiket_id;

ALTER TABLE tiket RENAME COLUMN id TO slug;
ALTER TABLE tiket DROP COLUMN nomor_tiket;
ALTER TABLE tiket RENAME COLUMN new_id TO id;
ALTER TABLE tiket DROP COLUMN account_id, DROP COLUMN customer_id, DROP COLUMN sales_id, DROP COLUMN dibuat_oleh, DROP COLUMN tiket_asal_id;
ALTER TABLE tiket RENAME COLUMN account_code TO account_id;
ALTER TABLE tiket RENAME COLUMN customer_code TO customer_id;
ALTER TABLE tiket RENAME COLUMN owner_user_id TO owner;
ALTER TABLE tiket RENAME COLUMN created_user_id TO dibuat_oleh;
ALTER TABLE tiket RENAME COLUMN origin_tiket_id TO tiket_asal_id;
ALTER TABLE tiket ALTER COLUMN id SET NOT NULL;
ALTER TABLE tiket ADD CONSTRAINT tiket_pkey PRIMARY KEY (id);
ALTER TABLE tiket ADD CONSTRAINT tiket_slug_key UNIQUE (slug);
ALTER TABLE tiket ADD CONSTRAINT tiket_account_id_fkey FOREIGN KEY (account_id) REFERENCES master_account(kode_account) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE tiket ADD CONSTRAINT tiket_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES master_customer(kode_customer) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE tiket ADD CONSTRAINT tiket_owner_fkey FOREIGN KEY (owner) REFERENCES master_pengguna(user_id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE tiket ADD CONSTRAINT tiket_dibuat_oleh_fkey FOREIGN KEY (dibuat_oleh) REFERENCES master_pengguna(user_id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE tiket ADD CONSTRAINT tiket_tiket_asal_id_fkey FOREIGN KEY (tiket_asal_id) REFERENCES tiket(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE master_kontrak ADD CONSTRAINT master_kontrak_tiket_id_fkey FOREIGN KEY (tiket_id) REFERENCES tiket(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE surat_tugas ADD CONSTRAINT surat_tugas_tiket_id_fkey FOREIGN KEY (tiket_id) REFERENCES tiket(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE tiket ALTER COLUMN account_id TYPE VARCHAR(50), ALTER COLUMN customer_id TYPE VARCHAR(50), ALTER COLUMN owner TYPE VARCHAR(20), ALTER COLUMN dibuat_oleh TYPE VARCHAR(20), ALTER COLUMN tiket_asal_id TYPE VARCHAR(100);
ALTER TABLE tiket ALTER COLUMN slug SET NOT NULL;
CREATE INDEX idx_tiket_owner ON tiket(owner);
CREATE INDEX idx_tiket_account ON tiket(account_id);
CREATE INDEX idx_tiket_customer ON tiket(customer_id);

COMMIT;
