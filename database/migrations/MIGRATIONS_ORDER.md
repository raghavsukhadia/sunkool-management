# Migration order for staging / production

Apply these SQL files in order on a fresh/staging Supabase database. Review each file before applying.

All paths below are relative to the repo root; files live in `database/migrations/`.

Recommended order:

1. `database/migrations/supabase-schema.sql` — base schema and enums
2. `database/migrations/inventory-schema.sql`
3. `database/migrations/product-categories-schema.sql`
4. `database/migrations/add-internal-order-number.sql`
5. `database/migrations/add-partial-order-status.sql`
6. `database/migrations/add-shipment-status.sql`
7. `database/migrations/add-partial-payment-status.sql`
8. `database/migrations/dispatch-schema.sql`
9. `database/migrations/production-lists-migration.sql`
10. `database/migrations/production-records-migration.sql`
11. `database/migrations/inventory-sub-items-migration.sql`
12. `database/migrations/dispatch-courier-tracking-migration.sql`
13. `database/migrations/add-dispatch-items-unique-constraint.sql`
14. `database/migrations/orders-payment-production-migration.sql`
15. `database/migrations/invoice-attachments-migration.sql`
16. `database/migrations/order-payments-migration.sql`
17. `database/migrations/orders-customer-cash-discount-migration.sql`
18. `database/migrations/fix-order-delete-cascade.sql` (or `fix-order-delete-cascade-simple.sql` as appropriate)
19. `database/migrations/fix-sub-items-serial-numbers.sql` / `database/migrations/prevent-sub-items-serial-numbers.sql`
20. `database/migrations/storage-production-pdfs-policies.sql`
21. `database/migrations/database-updates.sql` (final catch-all updates)
22. **Order status stages (run in two separate steps):**
    - 22a. `database/migrations/order-status-stages-part1-enum.sql` — adds new enum values (New Order, In Progress, Ready for Dispatch, Invoiced, In Transit, Void). **Run and commit/finish this step first.**
    - 22b. `database/migrations/order-status-stages-part2-data.sql` — migrates existing order statuses and sets default. **Run only after part 1 has been applied** (Postgres requires new enum values to be committed before use).
23. `database/migrations/remove-rewards-system.sql` — removes rewards policies/indexes/table when decommissioning Rewards.

Notes:
- Run these on a staging Supabase instance first and verify application behavior before running on production.
- Use `supabase db remote set <CONNECTION_STRING>` or `psql` to apply files. For large schemas, prefer the Supabase SQL editor.
- Backup the database (export SQL snapshot) before applying migrations to production.

Example commands (local dev / supabase CLI):

```bash
# Set up supabase remote (optional)
supabase db remote set "postgresql://<user>:<pass>@<host>:5432/postgres"

# Apply in order
psql "$DATABASE_URL" -f database/migrations/supabase-schema.sql
psql "$DATABASE_URL" -f database/migrations/inventory-schema.sql
# ... repeat for each file in the recommended order
```

If you want, I can prepare a single combined SQL file that runs them in order (with safety checks) and add it to the repo.

