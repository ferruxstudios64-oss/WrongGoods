# WrongGoods

An independent label for original fictional brands, packaging, signage and graphic props for games, film and invented worlds.

React + TypeScript, Next-compatible Vinext and Cloudflare Workers. The recovered starting commit is `e249dcd42487e02be38befeaf545dd487b482a01`. The pinned pnpm lockfile and working stack are retained.

## Priority: corrected live-domain landing

The approved prelaunch landing is live at **https://wronggoods.com** and **https://www.wronggoods.com**. It explains the fictional-brand model and saves release signups to the approved D1 database. The separate review copy remains at https://wronggoods-landing-preview.64v2swksgt.workers.dev. See [landing deployment and verification](landing/README.md).

## Run on Windows

Use Node 24 (verified) or Node 22.13+, and pnpm. The project selects `pnpm@11.19.0` through `packageManager`.

```powershell
cd C:\Users\User\Desktop\WG\storefront
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Development: **http://localhost:5173**. Use the explicit address and port. Leave the process running. A clean first start can spend about a minute preparing dependencies. Without Supabase settings, local D1 and R2 state lives in ignored `.wrangler/state`; this does not create cloud resources or charges.

```powershell
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm start
```

Production preview: **http://127.0.0.1:8787**. The pinned Worker binary uses compatibility date `2026-05-15`; do not set a date newer than its supported runtime. Normal install/dev/build/test commands need no Bash. The legacy managed-Linux scripts remain available for that environment.

On Windows, stop `pnpm start` with Ctrl+C before rebuilding: its running Worker can hold a lock on `dist` and cause `EPERM`. Restart it after the build. `pnpm dev` may remain running.

## Implemented workflows

- Server-backed published catalogue, original concept previews, search, department/tone filters, product galleries, precise release information and useful empty states.
- Owner wizard at `/owner`: private drafts, validated image and ZIP uploads, preview, explicit publication, archival and revision-conflict protection. Supabase Auth validates the owner email and an active server session on each privileged request.
- Contact form, persisted launch-update consent and private owner inbox/subscriber removal at `/owner/inbox`. No automated marketing sender is configured.
- Lemon Squeezy hosted checkout integration, signed and idempotent order/refund webhooks, browser-bound verified status, and provider-managed customer download/recovery. Test mode is the default.
- Private Supabase Storage review archives and draft images; only images currently referenced by published products have public image routes. Private archive routes never provide paid files directly.

The private review ZIP must also be uploaded to the matching Lemon Squeezy variant. Its API does not provide product-file upload. Publication checks the provider store, variant, payment mode, fixed GBP price and matching published download filename, plus the owner's explicit confirmation of matching content. This is a documented two-service release step, not automatic archive synchronisation.

## Current preview and limits

Cloud preview: **https://wronggoods-preview.64v2swksgt.workers.dev**. The currently deployed version uses the approved D1 database; contact and signup persistence were verified. R2 is disabled and live payments remain off. The Supabase migration is applied and verified, with the original catalogue preserved and DAYSHIFT imported as a private review draft. Switching the Worker requires the server key and owner account described in [Supabase setup](docs/SUPABASE.md). No real product has been released.

See [deployment setup](docs/DEPLOYMENT.md), [owner guide](docs/OWNER.md), [launch dependencies](docs/LAUNCH.md), [security/commerce design](docs/ARCHITECTURE.md), and [verification evidence](docs/VERIFICATION.md).

## Brand and product honesty

DAYSHIFT, PUBLIC NOTICE and FALSE AUTHORITY are concept previews, not completed archives. DAYSHIFT imagery is AI-generated art direction. The separate `references` folder/PDF and the later approved offset-O master were absent from this handover. The existing wordmark is the earlier PDF extraction; it is not claimed as the approved final mark. Replace it only when the exact master or documented construction is supplied. Anton's licence is included in `public/fonts`.

Do not commit credentials, `.env*`, `.dev.vars*`, archives, authentication state, local databases, dependencies or build output. Environment variable **names** are documented in Markdown; no environment example is committed.
