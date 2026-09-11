# WrongGoods prelaunch landing

This standalone landing corrects the old business model on the live domain while the full storefront's Supabase setup is pending. It uses the existing approved D1 database for real release-list persistence. No checkout or free-file promise is presented. Original DAYSHIFT imagery is explicitly labelled AI concept artwork.

## Review

Preview: https://wronggoods-landing-preview.64v2swksgt.workers.dev

Local: http://127.0.0.1:8790

```powershell
pnpm exec wrangler dev --config landing/wrangler.preview.jsonc --local --persist-to .wrangler/state --ip 127.0.0.1 --port 8790 --inspector-port 0
node landing/verify.mjs http://127.0.0.1:8790
```

If starting with empty local state, apply the local migrations once using `pnpm exec wrangler d1 migrations apply DB --local --config landing/wrangler.preview.jsonc --persist-to .wrangler/state`. This does not change cloud data.

## Preview and approved live deployment

The live Worker is `wrongergoods`; both `wronggoods.com` and `www.wronggoods.com` are already its custom domains. The preview is a separate Worker with no domain routes.

```powershell
pnpm exec wrangler deploy --config landing/wrangler.preview.jsonc
node landing/verify.mjs https://wronggoods-landing-preview.64v2swksgt.workers.dev
```

After the owner has reviewed the concrete preview and approved replacing the live site:

```powershell
pnpm exec wrangler deploy --config landing/wrangler.production.jsonc
node landing/verify.mjs https://wronggoods.com
```

The production configuration retains the same two custom-domain names, adds the existing D1 binding, and replaces the static page with the reviewed assets and signup handler. It enables no paid plan, R2 bucket or live commerce. Read the deployment output for any unexpected proposed domain change and stop if one appears.

Before replacement, live version `a5ce4d5e-3081-43a6-a901-3f6370e655fc` was at 100% in deployment `e9d660f4-108b-4a1e-9df5-4a1911f7a5c4`. Recheck the current deployment immediately before cutover in case another editor has changed it. Local public HTML/CSS/JS and most old image assets are backed up under ignored `.sites-runtime/live-domain-backup`; the original Worker source could not be exported with the current OAuth scheme. The recorded Cloudflare version is the primary rollback reference.

## Signup handling and later Supabase cutover

The form requires explicit consent. Its server endpoint validates origin, body, email and consent, applies persistent rate limits, and only then saves to `launch_signups`. Duplicate addresses are not added twice. It never stores signups in browser localStorage or opens a mail application after submission. No automatic email is sent by the form; an actual mailing service or owner workflow is required for future release messages.

The full storefront's previous D1-backed owner inbox can read this table once owner access is configured. When Supabase is connected, migrate all real D1 signup records and switch the landing's backend deliberately. Do not discard D1 or assume it is empty after this landing starts collecting addresses.

## Verification

Desktop 1440 px, mobile 390 px and narrow 320 px checked in a real browser with no overflow or missing images. Actual browser signups were independently found in local and remote D1 with consent version `2026-09-11`; only those synthetic records were removed afterward. Node tests cover persistence, deduplication, missing consent, origin checks, storage failures and preview indexing. The asset Worker bundles successfully and repository typechecking/lint pass.

See `artifacts/landing-*.png`, `artifacts/landing-http.json`, and [design decisions](../docs/LANDING-DESIGN.md). The exact approved offset-O master remains an external dependency; no replacement ratio or trademark claim is invented.
