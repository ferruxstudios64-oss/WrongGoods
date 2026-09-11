# Architecture and trust boundaries

## Managed services

Cloudflare D1 holds catalogue drafts, asset metadata, limited checkout status, contact enquiries and consent. R2 privately holds uploaded review ZIPs and product images. Cloudflare Access handles owner identity. Lemon Squeezy owns card processing, merchant checkout, receipts, authenticated customer recovery and paid-file delivery. No custom payment processor, cart or customer password database is built.

The owner wizard is bespoke because the requested preview/publish workflow must apply WrongGoods product rules. Authentication, database, file storage and customer fulfilment are managed. This keeps the operational boundary small without introducing another CMS or database vendor.

## Product publication

An explicit server-authorized publication operation validates fields and stored files, then queries the provider's store/product/variant/files. GBP price, mode, fixed one-time purchase and matching published filename must agree. The owner separately attests the file contents actually match; filename and metadata checks are not a cryptographic equivalence guarantee. Products are editable only as drafts/archived records. Revision checks prevent stale writes from overwriting newer work.

Only published records reach the live catalogue. A database failure displays an availability notice while retaining the original concept previews. Customer pages receive public product descriptions and image URLs; private storage keys and archives are not exposed. Concept entries cannot use checkout.

## Uploads and private assets

Server authorization runs before parsing uploads. Images must be PNG/JPEG/WebP, up to 10 MB; SVG/HTML are rejected. ZIPs are limited to 25 MB to respect the buffered Worker memory budget. ZIP structure, central directory, local headers, unsafe/duplicate paths, encryption, unsupported compression and extreme expanded size are checked. ZIP64 and multi-disk archives are not accepted. Checks reject truncated signatures and disguised formats; they do not replace decompression, malware scanning or owner inspection.

R2 object keys are server generated. Only current published-image references can be served anonymously, with `nosniff` and no-store headers. Archive downloads are never served from R2 to anonymous users, even with a guessed order number. Draft preview routes require the signed owner identity. Removed file metadata makes old objects unreachable; garbage collection is an explicit later operation.

## Payment and recovery

The checkout endpoint accepts a slug, not a price or URL. It rechecks the provider and records a checkout binding before creating the hosted session. Same-origin checks and persistent rate limits protect public creation. A two-hour random, HTTP-only cookie authenticates access to this browser's status; only its hash is stored in D1.

The webhook verifies HMAC over the raw request body before accepting a paid/refunded order. Store, variant, product and sandbox/live mode must match the recorded checkout. D1 transactional writes and event digests make replay idempotent. Refund is terminal for the local status mirror, so a delayed paid event cannot revive it. The mirror contains no card details and does not itself grant provider-file access.

Customers recover orders at [Lemon Squeezy My Orders](https://docs.lemonsqueezy.com/help/online-store/my-orders) through email authentication. Provider download links are not returned by our public APIs. Provider entitlement and refund-related file access must be exercised in a real sandbox account; isolated application tests cannot establish those third-party behaviors.

## Contact and release updates

JSON validation, same-origin checks, consent, honeypot and persistent request limits apply. Success is returned only after D1 reports a successful write. Enquiries and subscriber records require owner authorization. No automated email, subscription confirmation email or campaign sender is simulated. The owner can reply via their mail application and remove subscribers; configure a compliant campaign/unsubscribe service before sending launch emails.

## Test isolation

Node tests compile the actual TypeScript handlers and execute real SQLite queries with test R2/JWKS/provider adapters. Cryptographically signed fixture tokens exercise authorization; application routes contain no test bypass. The optional owner browser harness is a separate loopback-only test server using in-memory fixture data. It is excluded from application routing and never deployed.
