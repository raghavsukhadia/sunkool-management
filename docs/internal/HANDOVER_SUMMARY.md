# Handover Summary — Changes applied

This summary lists the code changes and actions performed to prepare the repository for handover and deployment.

## Key code changes
- app/actions/orders.ts
  - Allow `addOrderPayment` when there are dispatch records even if `order_status` is stale.
  - Added a rollback step: if updating `orders.order_status` fails after creating a dispatch, the code now attempts to delete the created `dispatch_items` and `dispatches` record and returns an error.

- app/dashboard/orders/[id]/page.tsx
  - Reworked the Payment tab layout: added Payment Overview (Order Total, Total Paid, Amount Due), improved Payment Summary, Payment History UI, and a Select for payment method.
  - Centralized predicate `canRecordPayment` to allow recording payments when `order_status` indicates dispatch OR there are dispatch records.

- Database/
  - Added `MIGRATIONS_ORDER.md` with the recommended migration application order.
  - Added two migration files (invoice-attachments-migration.sql, order-payments-migration.sql) — review before applying.

- VERCEL_ENV_VARS.md — new file listing recommended environment variables for Vercel & Supabase.

## Automated checks
- `npm run build` completed successfully in this environment.
- `next build` output shows all routes compiled and no blocking TypeScript errors.

## What I could not complete automatically
- Pushing the branch and creating a GitHub PR from this environment failed due to missing Git credentials / authentication for `git push`. Please push the current branch and open a PR using the instructions below.

## How to push and open a PR (run locally)
```bash
# Push branch
git push -u origin HEAD

# Create PR using GitHub CLI (recommended)
gh pr create --title "fix(payment): enable payments when dispatch records exist; improve reliability" --body "$(cat <<'EOF'\nSummary:\n- Allow recording payments when dispatch records exist.\n- Rollback dispatch on order status update failure.\n- Improve payment UI and add migration/docs.\n\nTest plan:\n- Create order -> produce -> create dispatch -> record payment\n- Verify payment history and payment summary update\nEOF\n)"
```

If you prefer, push the branch and create the PR via GitHub web UI.

## Next recommended steps
1. Apply `Database/MIGRATIONS_ORDER.md` in a staging Supabase project and run smoke tests.
2. Configure Vercel environment variables (see `VERCEL_ENV_VARS.md`).
3. Push branch and open PR for review; run Vercel preview deployment.
4. After approval, merge to `main` and deploy to production.

