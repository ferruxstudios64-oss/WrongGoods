# Supabase connection and handover

Project: **WrongGoods**, ref `ggxybgbnkyozweoyppxz`, organisation **WG**, Free plan verified 11 September 2026. No upgrade or billing activation was performed.

## Applied and tested

`supabase/migrations/20260911161408_storefront_runtime.sql` is applied remotely. It creates a private `wg_storefront` schema and server-only transaction RPC. All original `public` tables, rows and buckets are preserved. DAYSHIFT is copied into the studio as a draft requiring verified files, contents, compatibility, licence and provider setup. Its original seeded published record remains unchanged in the legacy schema.

The approved Cloudflare D1 database is retained, not deleted. At the migration check it contained zero products, enquiries, subscribers or orders. Recheck immediately before cutover; migrate any newly received records rather than assuming it remains empty. R2 stays disabled.

## Two local setup steps

1. In Supabase → WrongGoods → Settings → API Keys, obtain a **secret key**. Save it as `SUPABASE_SECRET_KEY="…"` in the ignored `.dev.vars` at the project root. A legacy `service_role` key is also supported. Never use a publishable/anon key for privileged access and never send the secret in chat. URL, publishable key, bucket name and approved owner email are already configured locally.
2. In Authentication → Users → Add user → Create user, create the approved owner account with a password chosen privately. Confirm only an email whose inbox you control. There were no Auth users at the initial inspection. The website's owner password is this account password, not your Supabase dashboard password.

The application uses email/password login. Account creation and password recovery are administrator-managed for this single-owner studio. No test identity or email-delivery claim substitutes for a real sign-in.

## Finish deployment

Stop the local production Worker before building on Windows.

```powershell
node scripts/configure-supabase.mjs --configure
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm preview:prepare
node scripts/configure-supabase.mjs --upload-secrets
pnpm exec wrangler deploy --config dist/server/wrangler.preview.json
```

The configuration script verifies the server key and RPC, creates `wronggoods-studio` as a private bucket with 25 MB object limit and accepted PNG/JPEG/WebP/ZIP types, and refuses a public bucket. The separate bucket does not inherit the legacy buckets' admin policies. It uploads only the server key and owner allowlist as Worker secrets; secret values are never printed. No DNS routes, R2 resources, plan upgrades or live payments are enabled.

`preview:prepare` records Supabase settings from `deploy/preview.json` and removes Worker D1/R2 bindings. It refuses to prepare cutover without a local server key. It does not delete the retained D1 database or any Supabase data. Publication still requires an actual ready Lemon Squeezy variant and matching delivery file.

After deployment, sign in at `/owner`, create a disposable draft, upload an image and ZIP, verify anonymous users cannot read them, save and reload the draft, and sign out. Verify contact/signup persistence in Supabase and inspect that the client bundle contains no secret key. Remove only synthetic verification records.

## Local development

`pnpm dev` reads root `.dev.vars`; `pnpm start` explicitly loads its absolute path because its Wrangler configuration lives under `dist/server`. With `SUPABASE_URL` configured, requests use the real Supabase project. Without Supabase settings the original local D1/R2 fixtures remain available. Never test destructive operations against real product records.

## Further schema changes

Use the pinned CLI via `pnpm dlx supabase@2.81.3` (discover command flags with `--help`). Create a new migration with `migration new` before writing it. The generator `scripts/build-supabase-migration.mjs` reproduces the initial fixed-operation mapping; **do not rewrite an already applied migration to deploy a later change**. Put later function/schema updates in a new migration. Regenerate and review the operation mapping when changing repository SQL.

Run `node scripts/supabase-regression.mjs` to produce `.sites-runtime/supabase-regression.sql`, a rollback-only integration check. Execute it against the intended project, then run Supabase security advisors. The private schema intentionally has no browser RLS policies; see [the informational advisor notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
