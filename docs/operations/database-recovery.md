# Database backup and recovery runbook

## Objectives

- Recovery point objective (RPO): 24 hours maximum; 15 minutes when Supabase PITR is enabled.
- Recovery time objective (RTO): four hours.
- Keep at least 30 daily encrypted backups in storage separate from Supabase.
- Perform and record a restore drill every quarter.

## Required production setup

1. Enable Supabase managed backups and Point-in-Time Recovery where the project plan supports it.
2. Store `DATABASE_URL` or `SUPABASE_DB_URL` only in the backup runner's secret store.
3. Install PostgreSQL client tools (`pg_dump`, `pg_restore`, and `psql`).
4. Run `npm run backup:database` daily from a protected runner.
5. Encrypt the resulting `.dump` and `.json` files before copying them to separate object storage.
6. Alert operations if the command fails, the integrity check fails, or no new backup appears within 26 hours.

Never commit a database dump or place one in a public CI artifact.

## Create and verify a backup

```bash
DATABASE_URL='postgresql://...' npm run backup:database
```

The command creates a custom-format dump under `.tmp/backups`, verifies that `pg_restore` can read its catalog, and writes a SHA-256 metadata file. The database password is passed through `PGPASSWORD`, not command-line arguments.

## Restore drill

Create a disposable local PostgreSQL database. Never use the production URL as the restore target.

```bash
BACKUP_FILE='.tmp/backups/minerval-....dump' \
RESTORE_TEST_DATABASE_URL='postgresql://localhost/minerval_restore_test' \
RESTORE_CONFIRMATION='RESTORE_TO_DISPOSABLE_DATABASE' \
npm run restore:verify
```

The verifier refuses the production database, restores with ownership removed, and confirms that `schools`, `students`, `payment_requests`, and `school_payouts` can be queried.

## Quarterly evidence

Record the date, backup timestamp, checksum, restore duration, row counts, tester, and any corrective action. Delete the disposable restored database immediately after the drill.

## Incident recovery

1. Stop payment and payout initiation while preserving callback endpoints.
2. Record the incident time and determine the last known-good point.
3. Restore into a new Supabase project or isolated database first.
4. Validate memberships, students, successful payments, payout reservations, Stripe subscriptions, and reconciliation history.
5. Rotate service-role, database, proxy, callback, and webhook secrets if compromise is suspected.
6. Switch traffic only after financial totals are reconciled against Stripe and SerdiPay.
7. Keep the original database read-only until the incident review is complete.
