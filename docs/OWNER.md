# WrongGoods owner guide

## Sign in

Open `/owner` and enter your approved email and Supabase password. The server checks the email is confirmed and allowed, validates the token with Supabase Auth, and checks that its session still exists. The HTTP-only session cookie lasts at most one hour; sign in again after it expires. No refresh token is stored in the browser. **Sign out** revokes that session and clears the cookie.

First create the owner account in Supabase Authentication ? Users using an email whose inbox you control. Account provisioning and password resets are performed by the project administrator. There is no public owner registration or local authentication bypass. See [Supabase setup](SUPABASE.md).

## Prepare a collection

1. Select **New draft**. The server creates a private record; the list shows it only after storage succeeds.
2. In **The goods**, enter the name, URL slug, reference code, description, category and tone. Use a unique lowercase slug with hyphens. Save before switching collections.
3. In **Files & images**, upload JPEG, PNG or WebP product images (10 MB each) and a finished ZIP archive (25 MB). Use **Remove image** to remove an incorrect image. Uploading another ZIP replaces the attached archive. Inspect the ZIP yourself, including licences for any third-party material. Server format validation cannot establish artistic quality or the truth of compatibility claims.
4. List the verified contents and formats, one item per line. State exactly which software and versions you tested, or explain compatibility limits. Concept artwork alone is not a finished product.
5. In **Selling details**, enter the GBP price, approved licence terms and the matching Lemon Squeezy variant ID. Configure the same price in Lemon Squeezy and attach the customer download there. The private archive in WrongGoods is not automatically copied into Lemon Squeezy.
6. In **Preview & publish**, inspect the image, description, contents, formats, compatibility, price and licence. Save any unsaved changes. Complete all release checks.
7. Confirm that you have inspected the archive, matched the provider download, verified the claims and approved the terms. Select **Publish collection**. Server validation also checks the connected provider variant. Publication success appears only when the server has saved it.

New records are drafts. Saving and uploading do not publish them. The first uploaded image is the primary storefront image. Draft images require owner authorisation; paid archives always remain private.

## Edit or withdraw a release

Select the collection. A published collection is read-only until you select **Archive collection** and confirm. Archiving removes it from sale while preserving its record for existing orders. Edit the archived record, save, inspect its preview and explicitly publish again when ready. Publishing an archived collection reactivates it.

If another browser changes the same record, the server rejects a stale revision. Reload the studio to obtain the current version before editing again. Unsaved edits have not reached storage; the browser warns when you leave with changes.

## Customer correspondence

Open **Inbox & subscribers** to read persisted enquiries and active launch-update consent records. **Reply by email** opens your mail application; the storefront does not automatically send a reply. Use **Unsubscribe** to remove a subscription after a customer request. The success message appears only after the server accepts the change. Do not send unrelated marketing to the launch-update list.

## Orders and downloads

Checkout and customer downloads are handled by Lemon Squeezy. `/order` checks a browser-bound order reference; a query string cannot prove payment. A signed provider event is required for a confirmed state. Test orders are labelled. Pending or unavailable states do not claim that a charge succeeded or failed.

**Recover an order** opens the provider's order portal. Customers use their checkout email to request a secure sign-in link. A receipt also supplies provider download access. Support enquiries should include an order number, never card details.

Before live trading, complete a sandbox purchase, confirm its webhook, inspect the delivered archive and exercise order recovery. Actual products, final trading terms, seller details, provider account approval and live credentials remain external launch requirements.
