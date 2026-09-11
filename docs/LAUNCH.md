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

The preview has no cloud D1/R2 bindings. Browsing works; cloud contact/signup report unavailable. Owner login, upload and sales remain locked. Cloudflare CLI OAuth login is verified, but R2 is not enabled and D1 contains no databases. The application code is implemented; this is **not a live trading launch**.

## Remaining owner inputs and approvals — one checklist

1. **Cloud services:** approve provisioning `wronggoods-preview` D1 and a Standard private `wronggoods-private-preview` R2 bucket; enable R2 in the Cloudflare dashboard after reviewing its billing terms. Confirm the intended Cloudflare plan. No public bucket/custom domain will be used.
2. **Owner sign-in:** choose the approved owner email(s), configure Cloudflare Access for `/owner*` and `/api/owner/*`, and supply the issuer/audience through deployment settings. Test a real sign-in and sign-out.
3. **Commerce:** create/approve a Lemon Squeezy store, complete merchant onboarding and tax settings, create a GBP sandbox product/variant, upload the same finished archive there, and enter API/webhook secrets locally. Verify sandbox payment, failed/cancelled checkout, webhook delivery, correct files, recovery and refund behavior with the real provider. No live mode before this passes.
4. **Products and policies:** supply actual archives, inspected contents, tested compatibility, prices, approved product licence terms, seller details, refund/cancellation policy and data-retention decisions. Initial concepts stay unavailable until verified.
5. **Brand assets:** supply the references/PDF and exact approved offset-O master or documented ratio. No ratio has been invented.
6. **Trading launch:** approve the concrete production deployment and `wronggoods.com` DNS/domain changes after a working cloud owner workflow and sandbox commerce sign-off.

The provider controls download entitlement and customer authentication. Local tests prove the integration's order-state handling, not the provider's real-world delivery or refund-access behavior. Automated mailing is also a later provider setup step; collected consent must be honoured and each campaign must offer unsubscribe.
