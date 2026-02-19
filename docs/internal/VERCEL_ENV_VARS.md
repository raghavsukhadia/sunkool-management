# Vercel & Supabase Environment Variables

Set the following environment variables in your Vercel project (Production and Preview as appropriate).

Required (frontend + runtime)
- NEXT_PUBLIC_SUPABASE_URL — Your Supabase project URL (e.g. https://xyzcompany.supabase.co)
- NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon/public API key

Recommended (server-side / optional)
- SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (keep this server-only). Required for server actions that need elevated privileges (be careful with RLS).
- NEXT_PRIVATE_SOME_API_KEY — Any other private API keys used by server actions (mailer, 3rd-party services)

Notes:
- Prefix `NEXT_PUBLIC_` keys are safe to expose to the browser (they are public keys). Keep service role keys secret in Vercel (Environment Variable type: Secret).
- In `lib/supabase/client.ts` the code already expects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- In `lib/supabase/server.ts` the server-side client currently reads the same NEXT_PUBLIC_* variables — consider switching to `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PRIVATE_KEY` on server for privileged operations.

Vercel setup:
1. Go to your Vercel project → Settings → Environment Variables.
2. Add variables listed above for Production, Preview, and Development as needed.
3. For secrets (service role key), mark them as Environment Variable type "Secret".

Deployment tip:
- After adding env vars, trigger a redeploy on Vercel to ensure they are applied to the build/runtime.

