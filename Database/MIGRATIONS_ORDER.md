# Migration order for staging / production

Apply these SQL files in order on a fresh/staging Supabase database. Review each file before applying.

Recommended order:

1. `Database/supabase-schema.sql` — base schema and enums
2. `Database/inventory-schema.sql`
3. `Database/product-categories-schema.sql`
4. `Database/add-internal-order-number.sql`
5. `Database/add-partial-order-status.sql`
6. `Database/add-shipment-status.sql`
7. `Database/add-partial-payment-status.sql`
8. `Database/dispatch-schema.sql`
9. `Database/production-lists-migration.sql`
10. `Database/production-records-migration.sql`
11. `Database/inventory-sub-items-migration.sql`
12. `Database/production-records-migration.sql`
13. `Database/dispatch-courier-tracking-migration.sql`
14. `Database/add-dispatch-items-unique-constraint.sql`
15. `Database/orders-payment-production-migration.sql`
16. `Database/invoice-attachments-migration.sql`
17. `Database/order-payments-migration.sql`
18. `Database/orders-customer-cash-discount-migration.sql`
19. `Database/fix-order-delete-cascade.sql` (or `fix-order-delete-cascade-simple.sql` as appropriate)
20. `Database/fix-sub-items-serial-numbers.sql` / `Database/prevent-sub-items-serial-numbers.sql`
21. `Database/dispatch-schema.sql` (if additional patching required)
22. `Database/storage-production-pdfs-policies.sql`
23. `Database/database-updates.sql` (final catch-all updates)

Notes:
- Run these on a staging Supabase instance first and verify application behavior before running on production.
- Use `supabase db remote set <CONNECTION_STRING>` or `psql` to apply files. For large schemas, prefer the Supabase SQL editor.
- Backup the database (export SQL snapshot) before applying migrations to production.

Example commands (local dev / supabase CLI):

```bash
# Set up supabase remote (optional)
supabase db remote set "postgresql://<user>:<pass>@<host>:5432/postgres"

# Apply in order
psql "$DATABASE_URL" -f Database/supabase-schema.sql
psql "$DATABASE_URL" -f Database/inventory-schema.sql
# ... repeat for each file in the recommended order
```

If you want, I can prepare a single combined SQL file that runs them in order (with safety checks) and add it to the repo.

