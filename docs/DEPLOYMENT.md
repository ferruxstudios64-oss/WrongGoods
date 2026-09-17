# Preview deployment

Worker: `wronggoods-preview` at https://wronggoods-preview.64v2swksgt.workers.dev. No existing live Worker was replaced; no custom-domain routes or DNS records were added. Live payments remain disabled.

## Supabase cutover

Follow [Supabase setup](SUPABASE.md) for the current migration, owner account and server credential steps. The additive database migration is applied and verified, but the currently deployed Worker still uses the approved D1 database until credentials are supplied and cutover is verified. R2 is disabled by the owner's decision. Cloudflare Access setup has been superseded by Supabase Auth.

The deployment target is tracked in `deploy/preview.json`. The D1 identifier is retained for inspection and rollback, not automatically rebound during Supabase deployment. Keep the old database until post-cutover verification and any late-arriving records have been reconciled.

```powershell
node scripts/configure-supabase.mjs --configure
pnpm build
pnpm preview:prepare
node scripts/configure-supabase.mjs --upload-secrets
pnpm exec wrangler deploy --config dist/server/wrangler.preview.json
```

Never deploy `dist/server/wrangler.json`: it contains local fallback bindings. The preparation script emits a separate preview configuration with no DNS routes and live commerce disabled. It does not create paid resources or delete databases. Stop the local production Worker before rebuilding on Windows.

## CLI authentication

Use `pnpm exec wrangler login` and complete the browser flow while its terminal process is still running. Verify with `pnpm exec wrangler whoami`. A refused `localhost:8976` callback usually means the login listener stopped; start a fresh login rather than reloading the expired callback. Never put tokens in Git URLs or chat.

## Runtime settings

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Public key used for Auth requests |
| `SUPABASE_SECRET_KEY` | Server-only privileged key, stored as a Worker secret |
| `SUPABASE_PRIVATE_BUCKET` | Dedicated private studio bucket |
| `OWNER_EMAILS` | Approved owner email allowlist, stored as a Worker secret |
| `LEMONSQUEEZY_API_KEY` | Server-only merchant credential |
| `LEMONSQUEEZY_STORE_ID` | Numeric store ID |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Server-only webhook HMAC secret |
| `COMMERCE_LIVE_ENABLED` | Exactly `true` allows live mode; preview is `false` |

The legacy `DB`, `BUCKET`, `CF_ACCESS_ISSUER` and `CF_ACCESS_AUD` are supported for offline fixtures and the earlier deployment only. Supabase mode does not fall back to D1 or Access if its requests fail. Production domain changes and a live trading launch remain separate approvals.
# Permanent GitHub-to-Cloudflare deployment

The production landing deploys automatically after verified changes to `main` that affect the landing, migrations, package lock, or deployment workflow. The workflow is `.github/workflows/deploy-landing.yml` and retains the existing `landing/wrangler.production.jsonc` Worker, routes, D1 binding, and custom domains.

Configure these encrypted GitHub Actions repository secrets once:

- `CLOUDFLARE_API_TOKEN`: a scoped Cloudflare API token with Workers Scripts edit access, D1 edit access, and the minimum zone permissions needed for the existing `wronggoods.com` Worker routes.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID that owns the Worker and D1 database.

Do not store either value in the repository, issues, workflow logs, or chat. Future deployments require no local Wrangler login: commit the verified change to `main`, then monitor the `Deploy WrongGoods landing` action. A failed verification step blocks production deployment.
