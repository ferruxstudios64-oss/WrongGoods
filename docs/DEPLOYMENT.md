# Cloudflare deployment

## Current preview

Worker: `wronggoods-preview` at https://wronggoods-preview.64v2swksgt.workers.dev.

No existing live Worker was replaced. No custom-domain routes or DNS records were added. The initial preview has no D1/R2 bindings. Unconfigured features fail closed with useful feedback; live payments are explicitly disabled.

## Authentication

Run `pnpm exec wrangler login` from the project and finish the browser OAuth flow. Keep the terminal process running until it reports success. Its callback is `localhost:8976`; a refused callback usually means the login listener stopped. Start a fresh login instead of repeatedly reloading an expired callback. Verify with `pnpm exec wrangler whoami`. Never put tokens in a Git URL or chat.

## Prepare the separate preview

```powershell
pnpm build
pnpm preview:prepare
pnpm exec wrangler deploy --config dist/server/wrangler.preview.json
```

`preview:prepare` writes ignored build configuration, fixes the Worker name, removes domain routes, disables live commerce and removes the local placeholder bindings. It never creates cloud resources. Do **not** deploy `dist/server/wrangler.json` with its placeholder database ID.

## Enable persistence after resource/billing approval

First inspect the Cloudflare plan and current allowances. D1 is offered on Workers Free with enforced daily limits; paid-plan overages and R2 usage can incur charges. R2 must be activated by the account owner. On Standard storage its documented free allowance includes 10 GB-month, one million Class A and ten million Class B operations monthly; excess storage is $0.015/GB-month and operations are separately billed. No billing activation was performed here. See [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Once approved:

```powershell
pnpm exec wrangler d1 create wronggoods-preview
pnpm exec wrangler r2 bucket create wronggoods-private-preview
```

Keep the R2 bucket private: do not enable `r2.dev`, public access or a custom bucket domain. Set `WRONGGOODS_PREVIEW_DATABASE_ID` to the returned database UUID and `WRONGGOODS_PREVIEW_BUCKET` to the private bucket name in the local shell. These are resource identifiers, not credentials. Then:

```powershell
pnpm preview:prepare
pnpm exec wrangler d1 migrations apply DB --remote --config dist/server/wrangler.preview.json
pnpm exec wrangler deploy --config dist/server/wrangler.preview.json
```

Inspect the migration target before applying it. These SQL files create new catalogue, asset, order-status, consent, inbox and rate-limit tables. Production must use a separate real database/bucket and an explicit reviewed deployment configuration. Never reuse the local placeholder UUID. Set preview resource variables again before regenerating config; omitted identifiers intentionally remove the corresponding bindings.

## Owner access

Configure a Cloudflare Access self-hosted application protecting both `/owner*` and `/api/owner/*` on the intended hostname. Use the same application audience for both paths, an explicit owner-email Allow policy, and your normal identity provider or email OTP. No Bypass policy. Keep checkout/webhooks/public catalogue outside the owner Access policy. Workers.dev availability for Access setup depends on the dashboard flow; use an approved dedicated hostname if required, and seek domain-change approval first.

The server verifies RS256 signatures from the configured Cloudflare JWKS, issuer, audience, timestamps and owner email on every privileged request. Merely sending an email header does not grant access. Direct calls to a Worker hostname still require a valid token even if the Access gateway is absent.

## Deployment settings — names only

| Name | Purpose |
| --- | --- |
| `DB` | D1 binding |
| `BUCKET` | Private R2 binding |
| `CF_ACCESS_ISSUER` | HTTPS Cloudflare Access team issuer |
| `CF_ACCESS_AUD` | Access application audience |
| `OWNER_EMAILS` | Comma-separated approved owner email allowlist |
| `LEMONSQUEEZY_API_KEY` | Server-only merchant API credential |
| `LEMONSQUEEZY_STORE_ID` | Numeric store ID |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Server-only HMAC signing secret |
| `COMMERCE_LIVE_ENABLED` | Exactly `true` permits live provider mode; all other values mean sandbox |
| `WRONGGOODS_PREVIEW_DATABASE_ID` | Local config-generation variable, not a Worker secret |
| `WRONGGOODS_PREVIEW_BUCKET` | Local config-generation variable, not a Worker secret |

Use Cloudflare dashboard Worker settings or interactive `pnpm exec wrangler secret put NAME --name wronggoods-preview` for secret values. For local development use an ignored `.dev.vars` file with the same Worker setting names; never commit it. This repository deliberately supplies no environment example or login shortcut.

Preview config always sets `COMMERCE_LIVE_ENABLED` to `false`. Enabling real trading requires a separately reviewed production configuration, not changing the preview generator casually.

## Lemon Squeezy sandbox

Create a GBP store and an ordinary fixed-price, one-time digital product. Attach the finished ZIP to its variant through the provider dashboard. Enter the numeric variant ID in the WrongGoods wizard. The provider's file-upload step is required: there is no file-upload API to automate it.

Add a webhook for `order_created` and `order_refunded` to `https://YOUR-HOST/api/webhooks/lemonsqueezy`, using a dedicated signing secret and sandbox mode. Leave `COMMERCE_LIVE_ENABLED` disabled. Perform a sandbox checkout, inspect the receipt and downloaded ZIP, and recover the order using the checkout email. Replay an event and test refunds before launch. The browser return URL alone never marks an order paid.

Lemon Squeezy has transaction fees and merchant onboarding requirements. No account, payment method, paid subscription or charge was created by this implementation. Review [current provider pricing](https://www.lemonsqueezy.com/pricing) before committing to the service.

## Rollback and operations

Keep the prior Worker deployment version. Roll back the Worker through the dashboard if a release fails; do not delete D1/R2 data or force-push history. Archive a product to take it off sale. Replaced/removed R2 objects remain private and may be retained; review unreferenced objects before any lifecycle cleanup. A blanket expiry rule would delete active assets and must not be used.

Complete `node scripts/smoke.mjs https://YOUR-HOST` and the owner/provider sandbox steps after configuration. No live DNS change is included in these instructions or the current deployment.
