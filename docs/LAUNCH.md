# Launch checklist

## Completed and verified locally

- Recovered and verified the complete Git bundle and original main commit; inspected the previously empty target remote.
- Retained Vinext/React/TypeScript and the pnpm lockfile; Windows installation, type checks, tests and production build work.
- Desktop/mobile storefront, search, combined department/tone filters, shareable filter URLs, empty recovery, product pages and galleries.
- Owner authentication boundary, private draft workflow, upload validation, private preview, publication checks, revisions and archival.
- Persistent signup consent and contact inbox, owner-only correspondence and unsubscribe management.
- Hosted-checkout adapter, signed payment/refund processing, duplicate-event handling, honest status pages and provider recovery.
- Browser verification of local production and cloud preview. Authenticated owner browser work uses an isolated, signed test identity and actual SQLite, not a real Cloudflare Access login.
- Separate Cloudflare preview deployed. No DNS changes, real charges, paid-plan activation or merchant setup.

## Current cloud preview

https://wronggoods-preview.64v2swksgt.workers.dev

The deployed preview currently uses D1 for contact/signup persistence; both were verified and synthetic test records removed. R2 remains disabled. The additive Supabase migration has been applied and tested, with existing catalogue data preserved. The Worker switch is pending a locally supplied server key and owner account. This is **not a live trading launch**.

## Remaining owner inputs and approvals — one checklist

1. **Supabase connection:** save `SUPABASE_SECRET_KEY` locally, configure the private studio bucket, upload the Worker secret, then deploy the reviewed Supabase configuration. Follow [the setup guide](SUPABASE.md). No Cloudflare billing or R2 activation is needed.
2. **Owner sign-in:** create the approved owner account in Supabase Authentication and exercise real sign-in, upload, draft persistence and sign-out. Cloudflare Access is superseded.
3. **Commerce:** create/approve a Lemon Squeezy store, complete merchant onboarding and tax settings, create a GBP sandbox product/variant, upload the same finished archive there, and enter API/webhook secrets locally. Verify sandbox payment, failed/cancelled checkout, webhook delivery, correct files, recovery and refund behavior with the real provider. No live mode before this passes.
4. **Products and policies:** supply actual archives, inspected contents, tested compatibility, prices, approved product licence terms, seller details, refund/cancellation policy and data-retention decisions. Initial concepts stay unavailable until verified.
5. **Brand assets:** supply the references/PDF and exact approved offset-O master or documented ratio. No ratio has been invented.
6. **Trading launch:** approve the concrete production deployment and `wronggoods.com` DNS/domain changes after a working cloud owner workflow and sandbox commerce sign-off.

The provider controls download entitlement and customer authentication. Local tests prove the integration's order-state handling, not the provider's real-world delivery or refund-access behavior. Automated mailing is also a later provider setup step; collected consent must be honoured and each campaign must offer unsubscribe.
