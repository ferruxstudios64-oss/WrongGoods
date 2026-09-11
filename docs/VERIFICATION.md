# Verification — 11 September 2026

Environment: Windows PowerShell, Node 24.18.0, pinned pnpm 11.19.0, Vinext 1.0.0-beta.5, Wrangler 4.92.0. Bundle verified as complete with original main at `e249dcd42487e02be38befeaf545dd487b482a01`; target remote advertised no branches before delivery.

## Automated checks

- Frozen-lockfile install succeeds. The pnpm lockfile is unchanged.
- TypeScript and production build pass. Compatibility date is pinned to the installed Worker's supported date.
- ESLint passes. Native-image use is intentional for local assets and authenticated previews; image optimisation must not expose/cache private media.
- **23 tests pass**, using the actual TypeScript handlers and SQLite SQL. They cover owner signature/issuer/audience/email rejection, unconfigured access, protected drafts and media, valid files, disguised/truncated/unsafe files, publication prerequisites, provider verification failure, revision conflicts, publication/archival, contact validation/persistence, explicit signup consent, duplicate signup, persistent throttling, checkout tampering, webhook signature/mode/product validation, event replay, failed/refunded orders, forged return parameters, expired status tokens and forbidden archive access.
- HTTP smoke script passes **24 checks each** against local production and the deployed preview: customer/owner/order routes, 404, sitemap, robots, private endpoints, concept checkout denial, foreign-origin denial and fixed recovery redirect. See `artifacts/http-local.json` and `artifacts/http-deployed.json`.

## Real browser checks

Chrome through agent-browser was used on the local dev server, the built Worker at `http://127.0.0.1:8787`, and the separate deployed preview.

- Desktop 1440×1000 and mobile 390×844 and 320×780: readable layout, no horizontal overflow, no broken images, one main heading, no framework error overlay.
- Search yields an appropriate empty state; Reset restores the catalogue. Department and tone controls work; search/filter state is encoded in the URL. Mobile menu opens, offers the correct navigation, and closes with Escape.
- DAYSHIFT product page shows its concept/AI-image disclosure and no purchase button. Other concept pages, contact, privacy, licensing, owner gate, order recovery and 404 routes render.
- Contact and launch signup were submitted through the browser on the local site. The success responses followed real D1 persistence; the test signup was also queried directly from local D1.
- An unauthenticated deployed `/order?status=paid` shows recovery, never a paid confirmation. Owner data remains inaccessible. The cloud preview has no database; form errors truthfully report that persistence is not connected.
- An isolated loopback owner fixture ran the **actual owner API handlers**, real SQLite persistence, private in-memory R2 and cryptographically signed fixture JWTs. Browser interactions created a draft, saved details, uploaded an actual ZIP and images, completed verified contents/price/licence, reviewed the product and explicitly published it. No real concept was released. The unit workflow separately confirms the published catalogue query and public-image gate update after publication and disappear after archival.

The optional harness is started with `node scripts/owner-browser-fixture.mjs` while `pnpm dev` runs. Open `http://127.0.0.1:5199/__fixture-login`. It is test-only, isolated from real D1/Cloudflare/merchant accounts, and never deployed. Pass absolute file paths to agent-browser uploads on Windows; relative daemon paths produced failed reads during testing.

## Evidence

- `artifacts/deployed-desktop.png`, `artifacts/deployed-mobile.png`
- `artifacts/production-mobile.png`, `artifacts/product-mobile.png`
- `artifacts/mobile-menu.png`, `artifacts/search-empty-desktop.png`
- `artifacts/contact-desktop.png`, `artifacts/owner-locked-mobile.png`
- `artifacts/owner-preview-fixture-desktop.png`, `artifacts/owner-published-fixture-mobile.png` — explicitly isolated test product, not launch evidence.

## Honest limits

No real Cloudflare Access application, D1 database or R2 bucket has been provisioned. No Lemon Squeezy store or credentials exist yet. Therefore real owner login, cloud uploads, merchant checkout, receipt delivery, provider entitlement/recovery and refund-related provider download behavior remain unverified. Application fixtures prove the integration boundary, not those external services. No automated marketing email was sent or simulated.

The preview is hosted at https://wronggoods-preview.64v2swksgt.workers.dev with live commerce disabled and no DNS/custom-domain changes. No paid plan or R2 billing was activated.

Initial Git push dry-run returned HTTP 403 for the local account `Tawseen`. The owner completed normal Git Credential Manager sign-in with `ferruxstudios64-oss`. Repository-local credential selection now uses that account, and the push dry-run succeeds. Remote commit verification is performed after the normal push and reported with delivery; no force push or credential-bearing remote URL is used.

Windows rebuild note: the running `pnpm start` Worker initially locked `dist`, causing `EPERM`. Stopping that process before the build resolved it. This is documented in the local setup instructions.


## Supabase migration ? 11 September 2026

- Connected to existing WrongGoods project in WG; organisation plan Free. Original schema and seeded catalogue retained.
- Applied the additive `wg_storefront` migration; one legacy product imported as an unpublished review draft. Verified server-only RPC grants and private schema isolation.
- Real PostgreSQL integration under service_role passed every prepared query, atomic rate counters, draft CRUD, asset metadata, inbox persistence, terminal refunds and missing-session rejection. All verification writes rolled back.
- 27 Node tests pass, including four new Supabase transport/auth/storage tests. Type checking, lint and production build pass.
- Local production HTTP smoke: 24 checks pass. Owner login browser screen verified at 390 px with no horizontal overflow or broken images. Screenshots in `artifacts/supabase-owner-*.png`.
- D1 read-only check found zero products, messages, signups and orders; retained resource is not deleted.
- Supabase security advisor: no warning/error findings; eight informational RLS-without-policy notices correspond to deliberately server-only tables.
- Pending: server key, real owner account/sign-in, authenticated storage requests and hosted Worker cutover. Local/mocked auth tests do not claim a real owner login succeeded.

## Priority landing replacement

Separate review Worker: https://wronggoods-landing-preview.64v2swksgt.workers.dev, version `03999105-6e96-42bd-b788-8f4bd6357308`. Existing live Worker `wrongergoods` and both custom domains remain unchanged pending review.

The candidate removes the old mockup/free-sample positioning. Browser checks at 1440, 390 and 320 px found no overflow or missing images; no JavaScript errors were reported. Essential content is immediately present without scroll-reveal code. A real hosted browser signup was independently verified in D1, then the synthetic row was precisely removed. Local persistence was separately checked. All 30 Node tests, typechecking, lint and the landing Worker bundle pass. Twelve deployed HTTP checks cover positioning, assets, privacy, noindex preview headers, invalid origins, missing consent, oversized bodies and unknown routes. See `artifacts/landing-http.json` and `artifacts/landing-*.png`.
