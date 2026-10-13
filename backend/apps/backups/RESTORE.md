# Restoring DRFMS from a backup

A backup is only worth having if you have restored from it. Practise these steps on a spare machine
at least once, and again after any major upgrade. **Never restore over a live system you have not
first backed up.**

## What is on the share

```
<share>\<folder>\
  database\drfms-YYYYMMDD-HHMMSS.dump        PostgreSQL dump (custom format); ".enc" added when encryption is on
  files\records\versions\...                 every stored document, same names as in DRFMS; ".enc" added when encrypted
```

The newest dump is the latest database state. `files\` holds every document ever backed up. It is
never pruned by a run, so it may contain files for records that have since been disposed of.

## 1. Get the files

Copy the dump you want, and the whole `files\` folder, from the share to the restore machine.

## 2. If the backup is encrypted

You need the encryption passphrase that was set on the Backup page. DRFMS cannot recover it.

```bash
docker compose exec -e DRFMS_BACKUP_PASSPHRASE='your passphrase' backend \
  python manage.py decrypt_backup /path/drfms-20261013-010000.dump.enc /path/drfms.dump
```

Documents are encrypted the same way, one file at a time. Decrypt each `.enc` file and drop the
`.enc` suffix. A wrong passphrase, or a damaged or incomplete file, is reported and nothing is written.

## 3. Restore the database

Check the dump is readable first (it lists the tables it holds):

```bash
pg_restore --list drfms.dump | head
```

Then restore into an empty database of the same PostgreSQL major version (or newer), with the
`pgvector` extension available:

```bash
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner < drfms.dump
```

## 4. Restore the documents

Copy the decrypted `files\` tree back into the document store: `/app/media/` in development, or the
MinIO bucket in production (for example with `mc mirror`). Keep the folder structure, since records
point to these paths.

## 5. Check

- Sign in, open a few records from different dates and download their files.
- Run `python manage.py migrate` to bring the schema to the version of the code you are running.
- Check the Audit log and the Backup page, then make a fresh backup straight away.

## Keep safe, outside DRFMS

- The encryption passphrase (if used).
- `SECRET_KEY` and the `.env` file. The share password and passphrase stored in DRFMS are encrypted
  with a key derived from `SECRET_KEY`; if it changes, DRFMS asks you to enter them again.
