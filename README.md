# WrongGoods

WrongGoods storefront for fictional brands and graphic props for games and screen. Built with React, Next-compatible Vinext, TypeScript and Cloudflare Workers.

## Local development

Use Node 22.13+ and the package manager pinned in package.json. Install with `pnpm install --frozen-lockfile`, then `pnpm dev`. Run `pnpm build` for the production Worker and `pnpm start` to preview it. `pnpm exec tsc --noEmit` checks types.

## Catalogue and release workflow

`lib/catalog.ts` is the source of truth. The three initial collections are **concepts in development**, not downloadable products. DAYSHIFT imagery is an AI-generated concept preview, not a representation of a final delivered asset pack. Product pages distinguish planned contents from confirmed specifications.

To release a product:

1. Finish and QA the downloadable archive, actual file formats, included fonts and commercial-use rights.
2. Publish the exact licence, seller details, refund/cancellation terms and updated privacy notice. Obtain any necessary legal review for the intended selling markets.
3. Set up hosted checkout and secure file delivery with the chosen merchant provider. Verify the complete paid order, delivery and refund flow in its test environment.
4. Set the verified HTTPS checkout URL, confirmed GBP price, final contents and formats, and `status: 'available'` in the catalogue. Keep all provider secrets in deployment settings, never source control.
5. Test one genuine end-to-end release before enabling sales. Checkout validates availability server-side and only redirects to the explicit provider allowlist. Client-supplied prices and URLs are never accepted.

The current allowlist supports Stripe Payment Links and `wronggoods.lemonsqueezy.com`; it is intentionally narrow. Stripe links alone do not deliver files: configure fulfilment before publishing any product. Tax display and charged amount must match the final provider listing. There is no shopping cart, customer login, upload wizard or mailing-list backend yet; the current contact action truthfully opens an email draft.

## Deployment

Build using the pinned lockfile. Deploy the generated `dist/server/wrangler.json` through Cloudflare Wrangler with credentials configured in the hosting environment. Set up the domain and HTTPS in the provider dashboard. This repository commit does not deploy or change domain DNS.

## Brand sources

Palette: #0A0A0A, #F0EDE6, #D9DE21 from the supplied 2026 manual. Header wordmark is extracted as vector paths from page 9 of that manual, not retyped. The later approved offset-inner-O master is absent from the supplied assets: replace `public/brand/wordmark.svg` when that approved vector is supplied; do not invent its ratio. Display headings use self-hosted Anton under its bundled SIL Open Font License; body and editorial roles use system fallbacks. Product positioning follows the later fictional-brand direction over older mockup-marketplace copy.

## Security

`.env*`, private keys, runtime state and build output are ignored. No credentials are required for catalogue browsing. No analytics, customer data storage or marketing forms are enabled. Hosted checkout does not expose merchant secrets. See `docs/LAUNCH.md` for remaining launch requirements.
